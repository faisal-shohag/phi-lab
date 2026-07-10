// Mentors and admins post pinned announcements to the whole Hive. Every user
// gets one notification — createMany in a single statement rather than a loop.
import { requireMentor } from '@/lib/hive/roles'
import { hiveError } from '@/lib/hive/errors'
import { prisma } from '@/lib/prisma'
import { serializePostCard } from '@/lib/hive/serialize'
import { NEVER_EXPIRES, MAX_TITLE_LEN, MAX_BODY_LEN } from '@/lib/hive/constants'

export const maxDuration = 60

export async function POST(request: Request) {
  const { user, error } = await requireMentor()
  if (error) return hiveError(error)

  let title = ''
  let body = ''
  let pinned = true
  try {
    const json = await request.json()
    if (typeof json?.title === 'string') title = json.title.trim().slice(0, MAX_TITLE_LEN)
    if (typeof json?.body === 'string') body = json.body.trim().slice(0, MAX_BODY_LEN)
    if (json?.pinned === false) pinned = false
  } catch {
    return hiveError('VALIDATION', 'Invalid request body.')
  }
  if (title.length < 5 || body.length < 10) {
    return hiveError('VALIDATION', 'An announcement needs a title and a body.')
  }

  const post = await prisma.hivePost.create({
    data: {
      authorId: user.id,
      type: 'ANNOUNCEMENT',
      title,
      body,
      status: 'OPEN',
      pinned,
      expiresAt: NEVER_EXPIRES, // announcements are never swept
      events: { create: { type: 'created' } },
    },
    include: {
      author: { select: { id: true, name: true, image: true, role: true } },
      _count: { select: { replies: true, reactions: true } },
    },
  })

  const users = await prisma.user.findMany({ select: { id: true } })
  if (users.length > 0) {
    await prisma.hiveNotification.createMany({
      data: users.map((u) => ({
        userId: u.id,
        postId: post.id,
        type: 'announcement',
        title: 'New announcement',
        body: title,
      })),
    })
  }

  return Response.json({ post: serializePostCard(post, { staff: true }) }, { status: 201 })
}
