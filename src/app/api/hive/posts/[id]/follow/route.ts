// Follow / unfollow a post. Followers get a notification on every new reply.
// The (userId, postId) unique constraint makes the toggle race-safe.
import { requireHiveUser } from '@/lib/hive/roles'
import { hiveError } from '@/lib/hive/errors'
import { prisma } from '@/lib/prisma'

export async function POST(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { user, error } = await requireHiveUser()
  if (error) return hiveError(error)

  const { id } = await params
  const post = await prisma.hivePost.findUnique({ where: { id }, select: { id: true } })
  if (!post) return hiveError('NOT_FOUND')

  const existing = await prisma.hiveFollow.findUnique({
    where: { userId_postId: { userId: user.id, postId: id } },
    select: { id: true },
  })

  if (existing) {
    await prisma.hiveFollow.delete({ where: { id: existing.id } })
    return Response.json({ following: false })
  }

  await prisma.hiveFollow.create({ data: { userId: user.id, postId: id } })
  return Response.json({ following: true })
}
