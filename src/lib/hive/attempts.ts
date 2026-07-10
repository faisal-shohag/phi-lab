// The Hive answer cycle. Runs in the background (Next's `after()`), never in
// the request's critical path.
//
//   attempt 1  direct fix                    (on post creation)
//   attempt 2  different angle               (student pressed "still stuck")
//   attempt 3  clarifying questions, no fix  (student pressed "still stuck")
//   then       escalate to a human mentor
//
// An attempt is *claimed* with a conditional updateMany on aiAttemptCount, so
// two concurrent triggers can never produce two replies for the same attempt —
// the same "idempotency from a constraint" spirit as the XpEvent ledger.
import { prisma } from '@/lib/prisma'
import { answerAttempt, type ThreadMessage } from './ai'
import { PROVIDER_ENUM } from './providers'
import { notifyFollowers, notifyMentors, notifyUser } from './notify'
import { invalidatePost } from './detail'
import { MAX_AI_ATTEMPTS } from './constants'

/** Below this, attempt 1 hands over rather than risk a confidently wrong fix. */
const LOW_CONFIDENCE = 40

export async function escalatePost(postId: string, reason: string): Promise<void> {
  const post = await prisma.hivePost.findUnique({
    where: { id: postId },
    select: { id: true, title: true, authorId: true, status: true },
  })
  if (!post) return
  if (post.status === 'RESOLVED' || post.status === 'ARCHIVED' || post.status === 'ESCALATED') return

  // How much work the AI actually did before handing over. Counting *replies*
  // rather than aiAttemptCount matters: an attempt is claimed before the model
  // runs, so a post whose first generation failed has aiAttemptCount = 1 but
  // zero AI replies — that's a direct hand-over, not a partial one.
  const aiReplies = await prisma.hiveReply.count({ where: { postId, authorType: 'AI' } })

  await prisma.hivePost.update({
    where: { id: postId },
    data: {
      status: 'ESCALATED',
      escalatedAt: new Date(),
      escalationReason: reason,
      escalatedAfterAiReplies: aiReplies,
    },
  })
  await prisma.hivePostEvent.create({
    data: { postId, type: 'escalated', meta: { reason, aiReplies } },
  })
  invalidatePost(postId)

  await notifyMentors(postId, {
    type: 'escalated',
    title: 'A post needs a mentor',
    body: post.title,
  })
  if (post.authorId) {
    await notifyUser({
      userId: post.authorId,
      postId,
      type: 'escalated',
      title: 'A mentor is on the way',
      body: 'Your question has been handed to a human mentor.',
    })
  }
}

/** Build the thread transcript the model sees for the next attempt. */
async function threadFor(postId: string): Promise<ThreadMessage[]> {
  const replies = await prisma.hiveReply.findMany({
    where: { postId },
    orderBy: { createdAt: 'asc' },
    include: { author: { select: { name: true } } },
  })
  return replies.map((r) => ({
    who:
      r.authorType === 'AI'
        ? `Hive AI (attempt ${r.aiAttempt ?? '?'})`
        : r.authorType === 'MENTOR'
          ? `Mentor ${r.author?.name ?? ''}`.trim()
          : `Student ${r.author?.name ?? ''}`.trim(),
    body: r.body,
  }))
}

/**
 * Generate and post AI attempt `n`. No-ops if another worker already claimed
 * that attempt, or the post has moved on (resolved/escalated/archived).
 */
export async function runAiAttempt(postId: string, n: number): Promise<void> {
  if (n < 1 || n > MAX_AI_ATTEMPTS) return

  // Claim the attempt: only succeeds if the counter is exactly n-1 and the post
  // is still in play.
  const claimed = await prisma.hivePost.updateMany({
    where: { id: postId, aiAttemptCount: n - 1, status: { in: ['OPEN', 'AI_WORKING'] }, type: 'QUESTION' },
    data: { aiAttemptCount: n, status: 'AI_WORKING' },
  })
  if (claimed.count === 0) return
  invalidatePost(postId) // status just flipped to AI_WORKING — let the poll see it now

  const post = await prisma.hivePost.findUnique({
    where: { id: postId },
    select: { id: true, title: true, body: true, topic: true, authorId: true },
  })
  if (!post) return

  try {
    const thread = await threadFor(postId)
    const answer = await answerAttempt(post, thread, n, { postId, userId: post.authorId ?? undefined })

    const isClarifying = n === MAX_AI_ATTEMPTS
    const reply = await prisma.hiveReply.create({
      data: {
        postId,
        authorType: 'AI',
        kind: isClarifying ? 'CLARIFYING_QUESTION' : 'ANSWER',
        body: answer.body,
        aiAttempt: n,
        aiProvider: PROVIDER_ENUM[answer.provider],
      },
    })
    await prisma.hivePostEvent.create({
      data: {
        postId,
        type: `ai_attempt_${n}`,
        meta: {
          replyId: reply.id,
          confidence: answer.confidence,
          angle: answer.usedAngle,
          provider: answer.provider,
        },
      },
    })

    // A low-confidence first answer is a hand-over signal, not a solution.
    if (n === 1 && answer.confidence < LOW_CONFIDENCE) {
      await escalatePost(postId, `low confidence (${answer.confidence}) on first attempt`)
      return
    }

    // The ball is back with the student.
    await prisma.hivePost.updateMany({
      where: { id: postId, status: 'AI_WORKING' },
      data: { status: 'OPEN' },
    })

    if (post.authorId) {
      await notifyUser({
        userId: post.authorId,
        postId,
        type: 'reply',
        title: 'Hive AI replied to your question',
        body: post.title,
      })
    }
    await notifyFollowers(postId, post.authorId, {
      type: 'reply',
      title: 'New answer on a post you follow',
      body: post.title,
    })
  } catch (err) {
    // Never leave the post stuck spinning: record the failure and hand it to a
    // human rather than silently dropping it.
    await prisma.hivePostEvent.create({
      data: {
        postId,
        type: 'ai_error',
        meta: { attempt: n, message: err instanceof Error ? err.message : 'unknown' },
      },
    })
    await prisma.hivePost.updateMany({
      where: { id: postId, status: 'AI_WORKING' },
      data: { status: 'OPEN' },
    })
    await escalatePost(postId, 'the AI could not generate an answer')
  } finally {
    // Covers the reply-created, low-confidence-escalated, and error paths in
    // one place — this is what the 4s AI_WORKING poll in post-thread.tsx reads.
    invalidatePost(postId)
  }
}

/**
 * The student says they're still stuck: try the next angle, or hand over to a
 * mentor once the AI has spent all three attempts.
 */
export async function runNextAiAttemptOrEscalate(postId: string): Promise<void> {
  const post = await prisma.hivePost.findUnique({
    where: { id: postId },
    select: { aiAttemptCount: true, status: true },
  })
  if (!post) return
  if (post.status === 'RESOLVED' || post.status === 'ARCHIVED' || post.status === 'ESCALATED') return

  if (post.aiAttemptCount >= MAX_AI_ATTEMPTS) {
    await escalatePost(postId, `still stuck after ${MAX_AI_ATTEMPTS} AI attempts`)
    return
  }
  await runAiAttempt(postId, post.aiAttemptCount + 1)
}
