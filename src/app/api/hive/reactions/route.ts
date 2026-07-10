// Toggle a 🍯 nectar reaction on a post or a reply.
//
// `targetKey` ("post:<id>" / "reply:<id>") carries the uniqueness, because a
// composite unique over the two nullable FK columns wouldn't work: Postgres
// treats NULLs as distinct, so (user, null, replyId) rows would never collide.
//
// Nectar grants no XP by design — it's a signal, not a currency, so it can't be
// farmed. It only ranks the weekly leaderboard.
import { requireHiveUser } from '@/lib/hive/roles'
import { hiveError } from '@/lib/hive/errors'
import { prisma } from '@/lib/prisma'
import { invalidatePost } from '@/lib/hive/detail'

export async function POST(request: Request) {
  const { user, error } = await requireHiveUser()
  if (error) return hiveError(error)

  let targetType = ''
  let targetId = ''
  try {
    const json = await request.json()
    if (json?.targetType === 'post' || json?.targetType === 'reply') targetType = json.targetType
    if (typeof json?.targetId === 'string') targetId = json.targetId
  } catch {
    return hiveError('VALIDATION', 'Invalid request body.')
  }
  if (!targetType || !targetId) return hiveError('VALIDATION', 'Missing reaction target.')

  const targetKey = `${targetType}:${targetId}`

  const existing = await prisma.hiveReaction.findUnique({
    where: { userId_targetKey: { userId: user.id, targetKey } },
    select: { id: true, postId: true, replyId: true },
  })

  if (existing) {
    await prisma.hiveReaction.delete({ where: { id: existing.id } })
    const postId = existing.postId ?? (await postIdOfReply(existing.replyId))
    if (postId) invalidatePost(postId)
    return Response.json({ reacted: false })
  }

  // Verify the target exists before recording, so reactions can't be orphaned.
  if (targetType === 'post') {
    const post = await prisma.hivePost.findUnique({ where: { id: targetId }, select: { id: true } })
    if (!post) return hiveError('NOT_FOUND')
    await prisma.hiveReaction.create({ data: { userId: user.id, postId: targetId, targetKey } })
    invalidatePost(targetId)
  } else {
    const reply = await prisma.hiveReply.findUnique({ where: { id: targetId }, select: { id: true, postId: true } })
    if (!reply) return hiveError('NOT_FOUND')
    await prisma.hiveReaction.create({ data: { userId: user.id, replyId: targetId, targetKey } })
    invalidatePost(reply.postId)
  }

  return Response.json({ reacted: true })
}

async function postIdOfReply(replyId: string | null): Promise<string | null> {
  if (!replyId) return null
  const reply = await prisma.hiveReply.findUnique({ where: { id: replyId }, select: { postId: true } })
  return reply?.postId ?? null
}
