// A mentor claims an escalated post. Two mentors clicking at once must not both
// get it, so the assignment happens inside a Postgres advisory-locked
// transaction — the same pattern the Support lab uses to hand out its live
// slots (src/lib/support/queue.ts). A unique constraint can't express
// "assign only if currently unassigned".
import { requireMentor } from '@/lib/hive/roles'
import { hiveError } from '@/lib/hive/errors'
import { prisma } from '@/lib/prisma'
import { notifyUser } from '@/lib/hive/notify'

// Fixed key so every process contends on the same advisory-lock slot.
const ADVISORY_KEY = 918273646

export async function POST(request: Request) {
  const { user, error } = await requireMentor()
  if (error) return hiveError(error)

  let postId = ''
  try {
    const json = await request.json()
    if (typeof json?.postId === 'string') postId = json.postId
  } catch {
    return hiveError('VALIDATION', 'Invalid request body.')
  }
  if (!postId) return hiveError('VALIDATION', 'Missing postId.')

  const result = await prisma.$transaction(async (tx) => {
    await tx.$executeRawUnsafe(`SELECT pg_advisory_xact_lock(${ADVISORY_KEY})`)

    const post = await tx.hivePost.findUnique({
      where: { id: postId },
      select: { id: true, title: true, authorId: true, status: true, assignedMentorId: true },
    })
    if (!post) return { code: 'NOT_FOUND' as const }
    if (post.status !== 'ESCALATED') return { code: 'CONFLICT' as const, message: 'This post is no longer escalated.' }
    if (post.assignedMentorId && post.assignedMentorId !== user.id) {
      return { code: 'CONFLICT' as const, message: 'Another mentor already claimed this post.' }
    }

    await tx.hivePost.update({
      where: { id: postId },
      data: { assignedMentorId: user.id },
    })
    await tx.hivePostEvent.create({
      data: { postId, type: 'mentor_assigned', meta: { mentorId: user.id, mentorName: user.name } },
    })
    return { code: 'OK' as const, authorId: post.authorId, title: post.title }
  })

  if (result.code === 'NOT_FOUND') return hiveError('NOT_FOUND')
  if (result.code === 'CONFLICT') return hiveError('CONFLICT', result.message)

  if (result.authorId) {
    await notifyUser({
      userId: result.authorId,
      postId,
      type: 'mentor_assigned',
      title: `${user.name} is looking at your question`,
      body: result.title,
    })
  }

  return Response.json({ ok: true })
}
