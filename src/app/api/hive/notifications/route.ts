// The notification bell. GET returns the latest notifications plus the unread
// count; PATCH marks some (or all) as read. Polled every 30s by the bell — no
// websockets in v1.
import { requireHiveUser } from '@/lib/hive/roles'
import { hiveError } from '@/lib/hive/errors'
import { prisma } from '@/lib/prisma'

const PAGE = 20

export async function GET() {
  const { user, error } = await requireHiveUser()
  if (error) return hiveError(error)

  const [items, unread] = await Promise.all([
    prisma.hiveNotification.findMany({
      where: { userId: user.id },
      orderBy: { createdAt: 'desc' },
      take: PAGE,
    }),
    prisma.hiveNotification.count({ where: { userId: user.id, readAt: null } }),
  ])

  return Response.json({
    unread,
    notifications: items.map((n) => ({
      id: n.id,
      type: n.type,
      postId: n.postId,
      title: n.title,
      body: n.body,
      read: n.readAt !== null,
      createdAt: n.createdAt.toISOString(),
    })),
  })
}

export async function PATCH(request: Request) {
  const { user, error } = await requireHiveUser()
  if (error) return hiveError(error)

  let ids: string[] | null = null
  try {
    const json = await request.json()
    if (Array.isArray(json?.ids)) ids = json.ids.filter((i: unknown): i is string => typeof i === 'string')
  } catch {
    // no body → mark everything read
  }

  await prisma.hiveNotification.updateMany({
    // Always scoped to the caller, so ids from another user are a no-op.
    where: { userId: user.id, readAt: null, ...(ids ? { id: { in: ids } } : {}) },
    data: { readAt: new Date() },
  })

  return Response.json({ ok: true })
}
