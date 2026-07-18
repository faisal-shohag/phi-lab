// Single Hive post with its full thread. The post page polls this while status
// is AI_WORKING to pick up the AI's answer.
//
// DELETE removes a post entirely (mentors/admins only) — moderation, not
// housekeeping. The 7-day sweep handles the latter.
import { requireHiveUser, requireMentor, isMentor } from '@/lib/hive/roles'
import { hiveError } from '@/lib/hive/errors'
import { loadPostDetail, invalidatePost } from '@/lib/hive/detail'
import { prisma } from '@/lib/prisma'
import { notifyUser } from '@/lib/hive/notify'
import { MAX_BODY_LEN } from '@/lib/hive/constants'
import { invalidateFeed } from '@/lib/hive/cache'

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { user, error } = await requireHiveUser()
  if (error) return hiveError(error)

  const { id } = await params
  const post = await loadPostDetail(id, user.id, isMentor(user))
  if (!post) return hiveError('NOT_FOUND')

  return Response.json({ post, viewer: { id: user.id, role: user.role } })
}

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { user, error } = await requireMentor()
  if (error) return hiveError(error)

  const { id } = await params

  // An optional reason, shown to the author. Deleting someone's question with
  // no explanation is how a community stops asking questions.
  let reason = ''
  try {
    const json = await request.json()
    if (typeof json?.reason === 'string') reason = json.reason.trim().slice(0, MAX_BODY_LEN)
  } catch {
    // no body — a bare delete is allowed
  }

  const post = await prisma.hivePost.findUnique({
    where: { id },
    select: { id: true, title: true, authorId: true },
  })
  if (!post) return hiveError('NOT_FOUND')

  // Cascades take the replies, events, reactions and follows with it.
  // Notifications survive by design (no FK), so the author still hears why.
  await prisma.hivePost.delete({ where: { id } })
  invalidatePost(id)
  invalidateFeed()

  if (post.authorId && post.authorId !== user.id) {
    await notifyUser({
      userId: post.authorId,
      type: 'announcement',
      title: 'Your post was removed by a moderator',
      body: reason ? `"${post.title}" — ${reason}` : post.title,
    })
  }

  console.warn(`[hive] post ${id} deleted by ${user.role.toLowerCase()} ${user.id}`, reason || '(no reason)')
  return Response.json({ ok: true })
}
