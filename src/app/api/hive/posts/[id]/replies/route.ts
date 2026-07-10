// Add a reply to a post. Two shapes:
//   • the post author following up (COMMENT). If they mark `stillStuck`, the
//     next AI attempt runs in after() — or the post escalates to a mentor once
//     the AI has spent all three attempts.
//   • a peer/mentor answering (ANSWER). Phase 3 runs AI Bee-Approved
//     verification on peer answers in after().
import { after } from 'next/server'
import { requireHiveUser } from '@/lib/hive/roles'
import { hiveError } from '@/lib/hive/errors'
import { prisma } from '@/lib/prisma'
import { serializeReply } from '@/lib/hive/serialize'
import { runNextAiAttemptOrEscalate } from '@/lib/hive/attempts'
import { runPeerVerification } from '@/lib/hive/verify'
import { notifyFollowers, notifyUser } from '@/lib/hive/notify'
import { awardXp } from '@/lib/gamification/award'
import { hiveReplyXp } from '@/lib/gamification/reasons'
import { MAX_BODY_LEN, MAX_IMAGES_PER_POST, DAILY_XP_REPLIES } from '@/lib/hive/constants'
import type { HiveAuthorType, HiveReplyKind } from '@/generated/prisma/client'

export const maxDuration = 60

function startOfTodayUTC(): Date {
  const d = new Date()
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()))
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { user, error } = await requireHiveUser()
  if (error) return hiveError(error)

  const { id } = await params

  let body = ''
  let images: string[] = []
  let stillStuck = false
  try {
    const json = await request.json()
    if (typeof json?.body === 'string') body = json.body.trim().slice(0, MAX_BODY_LEN)
    if (Array.isArray(json?.images)) {
      images = json.images
        .filter((u: unknown): u is string => typeof u === 'string')
        .slice(0, MAX_IMAGES_PER_POST)
    }
    stillStuck = json?.stillStuck === true
  } catch {
    return hiveError('VALIDATION', 'Invalid request body.')
  }
  if (body.length < 2) return hiveError('VALIDATION', 'Write a reply first.')

  const post = await prisma.hivePost.findUnique({
    where: { id },
    select: { id: true, title: true, authorId: true, status: true, acceptedReplyId: true },
  })
  if (!post) return hiveError('NOT_FOUND')
  if (post.status === 'ARCHIVED') return hiveError('CONFLICT', 'This post is archived.')

  const isAuthor = post.authorId === user.id
  const authorType: HiveAuthorType = user.role === 'MENTOR' || user.role === 'ADMIN' ? 'MENTOR' : 'STUDENT'
  // The asker's own follow-up is a COMMENT; anyone else is answering.
  const kind: HiveReplyKind = isAuthor ? 'COMMENT' : 'ANSWER'

  const reply = await prisma.hiveReply.create({
    data: {
      postId: post.id,
      authorType,
      authorId: user.id,
      kind,
      body,
      images,
      stillStuck: isAuthor && stillStuck,
    },
    include: {
      author: { select: { id: true, name: true, image: true, role: true } },
      _count: { select: { reactions: true } },
    },
  })

  await prisma.hivePostEvent.create({
    data: {
      postId: post.id,
      type: isAuthor ? 'author_reply' : authorType === 'MENTOR' ? 'mentor_reply' : 'peer_reply',
      meta: { replyId: reply.id, stillStuck: isAuthor && stillStuck },
    },
  })

  // Reward helping, not asking. Beyond the daily cap we still write a 0-XP
  // ledger row so badge progress counts every real reply.
  if (!isAuthor) {
    const earnedToday = await prisma.xpEvent.count({
      where: { userId: user.id, reason: 'hive_reply_posted', amount: { gt: 0 }, createdAt: { gte: startOfTodayUTC() } },
    })
    const amount = earnedToday < DAILY_XP_REPLIES ? hiveReplyXp() : 0
    try {
      await awardXp({
        userId: user.id,
        reason: 'hive_reply_posted',
        sourceId: reply.id,
        amount,
        meta: { postId: post.id },
      })
    } catch {
      // XP is best-effort
    }
  }

  if (isAuthor && stillStuck) {
    // Flip to AI_WORKING now so the thread shows "Bee is thinking…" immediately;
    // runNextAiAttemptOrEscalate re-checks state before doing anything.
    await prisma.hivePost.updateMany({
      where: { id: post.id, status: 'OPEN' },
      data: { status: 'AI_WORKING' },
    })
    after(() => runNextAiAttemptOrEscalate(post.id))
  } else if (!isAuthor) {
    // A classmate's answer gets checked by the AI before it can wear the
    // Bee-Approved mark. Mentors are trusted; their answers skip verification.
    if (authorType === 'STUDENT') after(() => runPeerVerification(reply.id))
    if (post.authorId) {
      after(() =>
        notifyUser({
          userId: post.authorId!,
          postId: post.id,
          type: 'reply',
          title: authorType === 'MENTOR' ? 'A mentor replied to your question' : 'Someone answered your question',
          body: post.title,
        }),
      )
    }
  }
  after(() =>
    notifyFollowers(post.id, user.id, {
      type: 'reply',
      title: 'New reply on a post you follow',
      body: post.title,
    }),
  )

  return Response.json(
    {
      reply: serializeReply(reply, {
        acceptedReplyId: post.acceptedReplyId,
        myReactionKeys: new Set<string>(),
        staff: authorType === 'MENTOR',
      }),
    },
    { status: 201 },
  )
}
