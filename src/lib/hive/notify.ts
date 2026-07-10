// In-app notifications. Rows are intentionally not FK'd to HivePost so the
// bell keeps its history after a post is auto-deleted at 3 days. The bell polls
// GET /api/hive/notifications (Phase 5).
//
// All helpers are best-effort: a notification failure must never break the
// action that triggered it.
import { prisma } from '@/lib/prisma'

export type NotificationType =
  | 'reply'
  | 'bee_approved'
  | 'accepted'
  | 'escalated'
  | 'mentor_assigned'
  | 'announcement'
  | 'badge'

interface NotifyInput {
  userId: string
  type: NotificationType
  title: string
  body?: string
  postId?: string
}

export async function notifyUser(input: NotifyInput): Promise<void> {
  try {
    await prisma.hiveNotification.create({ data: input })
  } catch {
    // best-effort
  }
}

/** Everyone following the post, minus the actor who caused the event. */
export async function notifyFollowers(
  postId: string,
  exceptUserId: string | null,
  payload: { type: NotificationType; title: string; body?: string },
): Promise<void> {
  try {
    const follows = await prisma.hiveFollow.findMany({
      where: { postId, ...(exceptUserId ? { userId: { not: exceptUserId } } : {}) },
      select: { userId: true },
    })
    if (follows.length === 0) return
    await prisma.hiveNotification.createMany({
      data: follows.map((f) => ({ userId: f.userId, postId, ...payload })),
    })
  } catch {
    // best-effort
  }
}

/** Every mentor/admin — used when a post escalates. */
export async function notifyMentors(
  postId: string,
  payload: { type: NotificationType; title: string; body?: string },
): Promise<void> {
  try {
    const mentors = await prisma.user.findMany({
      where: { role: { in: ['MENTOR', 'ADMIN'] } },
      select: { id: true },
    })
    if (mentors.length === 0) return
    await prisma.hiveNotification.createMany({
      data: mentors.map((m) => ({ userId: m.id, postId, ...payload })),
    })
  } catch {
    // best-effort
  }
}
