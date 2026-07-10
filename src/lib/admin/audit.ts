// Append-only trail of every privileged mutation: role changes, suspensions,
// settings writes. Role escalation with no trail is how platforms get owned.
//
// Unlike recordAiUsage, this is NOT fire-and-forget. Callers await it inside the
// mutation handler and let a failure surface: an audit log that silently drops
// writes is worse than no audit log, because it looks trustworthy.
import { prisma } from '@/lib/prisma'
import type { Prisma } from '@/generated/prisma/client'

export type AuditAction =
  | 'user.role.set'
  | 'user.suspend'
  | 'user.unsuspend'
  | 'setting.update'

export interface AuditEntry {
  actorId: string
  action: AuditAction
  targetType?: 'user' | 'setting'
  targetId?: string
  before?: Prisma.InputJsonValue
  after?: Prisma.InputJsonValue
}

export async function writeAudit(entry: AuditEntry): Promise<void> {
  await prisma.adminAuditLog.create({
    data: {
      actorId: entry.actorId,
      action: entry.action,
      targetType: entry.targetType ?? null,
      targetId: entry.targetId ?? null,
      before: entry.before,
      after: entry.after,
    },
  })
}

export interface AuditRow {
  id: string
  actorId: string
  actorName: string | null
  actorEmail: string | null
  action: string
  targetType: string | null
  targetId: string | null
  before: unknown
  after: unknown
  createdAt: Date
}

/**
 * Reverse-chronological page of the trail. `actorId` has no FK (the trail must
 * outlive a deleted account), so actor names are joined in manually and left
 * null when the account is gone.
 */
export async function listAudit({ page = 1, take = 50 }: { page?: number; take?: number } = {}): Promise<{
  rows: AuditRow[]
  total: number
  page: number
  pages: number
}> {
  const skip = (Math.max(1, page) - 1) * take

  const [rows, total] = await Promise.all([
    prisma.adminAuditLog.findMany({ orderBy: { createdAt: 'desc' }, skip, take }),
    prisma.adminAuditLog.count(),
  ])

  const actorIds = [...new Set(rows.map((r) => r.actorId))]
  const actors = await prisma.user.findMany({
    where: { id: { in: actorIds } },
    select: { id: true, name: true, email: true },
  })
  const actorMap = new Map(actors.map((a) => [a.id, a]))

  return {
    rows: rows.map((r) => ({
      ...r,
      actorName: actorMap.get(r.actorId)?.name ?? null,
      actorEmail: actorMap.get(r.actorId)?.email ?? null,
    })),
    total,
    page: Math.max(1, page),
    pages: Math.max(1, Math.ceil(total / take)),
  }
}
