// "Need a human" — the student (or a mentor triaging) hands the post straight to
// the mentor queue, skipping any remaining AI attempts.
import { requireHiveUser, isMentor } from '@/lib/hive/roles'
import { hiveError } from '@/lib/hive/errors'
import { prisma } from '@/lib/prisma'
import { escalatePost } from '@/lib/hive/attempts'

export async function POST(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { user, error } = await requireHiveUser()
  if (error) return hiveError(error)

  const { id } = await params
  const post = await prisma.hivePost.findUnique({
    where: { id },
    select: { authorId: true, status: true },
  })
  if (!post) return hiveError('NOT_FOUND')
  if (post.authorId !== user.id && !isMentor(user)) return hiveError('FORBIDDEN')
  if (post.status === 'RESOLVED' || post.status === 'ARCHIVED') {
    return hiveError('CONFLICT', 'This post is already resolved.')
  }
  if (post.status === 'ESCALATED') return Response.json({ ok: true })

  await escalatePost(id, 'the student asked for a human')
  return Response.json({ ok: true })
}
