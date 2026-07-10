// The asker accepts an answer. This resolves the post and is the strongest
// quality signal in the Hive: it awards the answerer, closes the loop for the
// asker, and (Phase 4) archives the thread into the Honeycomb knowledge base.
//
// Accepting an AI answer is allowed and resolves the post — there is simply no
// one to award.
import { after } from 'next/server'
import { requireHiveUser } from '@/lib/hive/roles'
import { hiveError } from '@/lib/hive/errors'
import { prisma } from '@/lib/prisma'
import { awardXp } from '@/lib/gamification/award'
import { hiveAcceptedXp, hiveResolvedAskerXp } from '@/lib/gamification/reasons'
import { notifyUser } from '@/lib/hive/notify'
import { archiveToHoneycomb } from '@/lib/hive/archive'

export const maxDuration = 60

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { user, error } = await requireHiveUser()
  if (error) return hiveError(error)

  const { id } = await params

  let replyId = ''
  try {
    const json = await request.json()
    if (typeof json?.replyId === 'string') replyId = json.replyId
  } catch {
    return hiveError('VALIDATION', 'Invalid request body.')
  }
  if (!replyId) return hiveError('VALIDATION', 'Missing replyId.')

  const post = await prisma.hivePost.findUnique({
    where: { id },
    select: { id: true, title: true, authorId: true, status: true, acceptedReplyId: true },
  })
  if (!post) return hiveError('NOT_FOUND')
  if (post.authorId !== user.id) return hiveError('FORBIDDEN', 'Only the person who asked can accept an answer.')
  if (post.acceptedReplyId) return hiveError('CONFLICT', 'An answer has already been accepted.')
  if (post.status === 'ARCHIVED') return hiveError('CONFLICT', 'This post is archived.')

  const reply = await prisma.hiveReply.findUnique({
    where: { id: replyId },
    select: { id: true, postId: true, authorId: true, authorType: true },
  })
  if (!reply || reply.postId !== post.id) return hiveError('NOT_FOUND', 'That reply is not on this post.')
  if (reply.authorId === user.id) return hiveError('VALIDATION', 'You cannot accept your own reply.')

  const now = new Date()
  // `resolvedBy` is the headline metric: did the AI carry the question, or did
  // a human have to? An AI reply on an escalated post still counts as AI —
  // whoever wrote the answer the asker accepted is who solved it.
  const resolvedBy = reply.authorType === 'AI' ? 'AI' : reply.authorType === 'MENTOR' ? 'MENTOR' : 'PEER'

  await prisma.hivePost.update({
    where: { id: post.id },
    data: { acceptedReplyId: reply.id, status: 'RESOLVED', resolvedAt: now, resolvedBy },
  })
  await prisma.hivePostEvent.create({
    data: { postId: post.id, type: 'resolved', meta: { replyId: reply.id } },
  })

  // Award the answerer (AI answers have no author to award).
  if (reply.authorId) {
    try {
      await awardXp({
        userId: reply.authorId,
        reason: 'hive_answer_accepted',
        sourceId: reply.id,
        amount: hiveAcceptedXp(),
        meta: { postId: post.id },
      })
    } catch {
      // XP is best-effort
    }
    await notifyUser({
      userId: reply.authorId,
      postId: post.id,
      type: 'accepted',
      title: 'Your answer was accepted 🎉',
      body: post.title,
    })
  }

  // And the asker, for closing the loop.
  try {
    await awardXp({
      userId: user.id,
      reason: 'hive_question_resolved',
      sourceId: post.id,
      amount: hiveResolvedAskerXp(),
      meta: { replyId: reply.id },
    })
  } catch {
    // XP is best-effort
  }

  // Distil the thread into a Honeycomb entry. This is what exempts the post
  // from the 3-day sweep — resolved knowledge is the only thing that survives.
  after(() => archiveToHoneycomb(post.id))

  return Response.json({ ok: true })
}
