// User administration: listing, role changes, suspension.
//
// Every mutation here writes an audit row and enforces two guardrails that keep
// an admin from locking everyone out of their own platform:
//
//   1. You cannot change your own role, or suspend yourself. A mis-click must
//      not cost you the platform.
//   2. At least one usable ADMIN must survive the change.
//
// Guardrail 2 is stated as "how many admins remain AFTER this?", not "how many
// exist now?". The naive form (`count(ADMIN) <= 1`) is unreachable: if the actor
// is an admin and the target is a *different* admin, the count is always >= 2.
//
// It is also a global count invariant, so it is serialized with a Postgres
// advisory lock — the same tool src/lib/support/queue.ts uses to gate its "max N
// live sessions". Without the lock, two admins demoting each other concurrently
// would each read "2 admins exist", each proceed, and leave zero. A lost admin
// is unrecoverable from inside the app.
//
// Suspension additionally deletes the user's Session rows. That alone does NOT
// lock them out — better-auth caches the session in a signed cookie for 30 days
// — which is why `suspendedAt` is read from the database at every choke point.
// See src/lib/admin/suspension.ts.
import { prisma } from '@/lib/prisma'
import { writeAudit } from './audit'
import { AdminActionError } from './errors'
import type { Prisma, PrismaClient, Role } from '@/generated/prisma/client'

export { AdminActionError }

/** Fixed key so every process contends for the same advisory-lock slot. */
const ADMIN_LOCK_KEY = 615243987

type Tx = Omit<PrismaClient, '$connect' | '$disconnect' | '$on' | '$transaction' | '$use' | '$extends'>

/** Take the lock for the rest of this transaction. */
async function lockAdmins(tx: Tx): Promise<void> {
  await tx.$executeRawUnsafe(`SELECT pg_advisory_xact_lock(${ADMIN_LOCK_KEY})`)
}

/**
 * Refuse when the change would leave the platform with no usable admin. Must be
 * called inside a transaction that already holds the admin lock.
 */
async function assertAdminSurvives(tx: Tx, targetId: string): Promise<void> {
  const remaining = await tx.user.count({
    where: { role: 'ADMIN', suspendedAt: null, id: { not: targetId } },
  })
  if (remaining === 0) {
    throw new AdminActionError(
      'This would leave the platform with no active admin.',
      'CONFLICT',
    )
  }
}

export interface AdminUserRow {
  id: string
  name: string
  email: string
  image: string | null
  role: Role
  xp: number
  suspendedAt: Date | null
  suspendedReason: string | null
  createdAt: Date
}

export interface ListUsersResult {
  rows: AdminUserRow[]
  total: number
  page: number
  pages: number
}

export async function listUsers({
  q,
  role,
  suspended,
  page = 1,
  take = 25,
}: {
  q?: string
  role?: Role
  suspended?: boolean
  page?: number
  take?: number
}): Promise<ListUsersResult> {
  const where: Prisma.UserWhereInput = {}
  if (q) {
    where.OR = [
      { name: { contains: q, mode: 'insensitive' } },
      { email: { contains: q, mode: 'insensitive' } },
    ]
  }
  if (role) where.role = role
  if (suspended !== undefined) where.suspendedAt = suspended ? { not: null } : null

  const safePage = Math.max(1, page)
  const [rows, total] = await Promise.all([
    prisma.user.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      skip: (safePage - 1) * take,
      take,
      select: {
        id: true,
        name: true,
        email: true,
        image: true,
        role: true,
        xp: true,
        suspendedAt: true,
        suspendedReason: true,
        createdAt: true,
      },
    }),
    prisma.user.count({ where }),
  ])

  return { rows, total, page: safePage, pages: Math.max(1, Math.ceil(total / take)) }
}

export async function setUserRole(actorId: string, targetId: string, role: Role): Promise<void> {
  if (actorId === targetId) {
    throw new AdminActionError('You cannot change your own role.')
  }

  const before = await prisma.$transaction(async (tx) => {
    await lockAdmins(tx)

    const target = await tx.user.findUnique({ where: { id: targetId }, select: { id: true, role: true } })
    if (!target) throw new AdminActionError('User not found.', 'NOT_FOUND')
    if (target.role === role) return null

    // Demoting an admin is the only role change that can strand the platform.
    if (target.role === 'ADMIN') await assertAdminSurvives(tx, targetId)

    await tx.user.update({ where: { id: targetId }, data: { role } })
    return target.role
  })

  if (before === null) return

  await writeAudit({
    actorId,
    action: 'user.role.set',
    targetType: 'user',
    targetId,
    before: { role: before },
    after: { role },
  })
}

export async function suspendUser(actorId: string, targetId: string, reason: string): Promise<void> {
  if (actorId === targetId) throw new AdminActionError('You cannot suspend yourself.')

  const suspendedAt = await prisma.$transaction(async (tx) => {
    await lockAdmins(tx)

    const target = await tx.user.findUnique({
      where: { id: targetId },
      select: { id: true, role: true, suspendedAt: true },
    })
    if (!target) throw new AdminActionError('User not found.', 'NOT_FOUND')
    if (target.suspendedAt) return null

    if (target.role === 'ADMIN') await assertAdminSurvives(tx, targetId)

    const at = new Date()
    await tx.user.update({
      where: { id: targetId },
      data: { suspendedAt: at, suspendedReason: reason.slice(0, 500) || null, suspendedById: actorId },
    })

    // Belt and suspenders. The cookie-cached session survives this, so it is the
    // `suspendedAt` reads that actually enforce the ban — but a deleted session
    // closes the server-side lookup path immediately.
    await tx.session.deleteMany({ where: { userId: targetId } })

    return at
  })

  if (suspendedAt === null) return

  await writeAudit({
    actorId,
    action: 'user.suspend',
    targetType: 'user',
    targetId,
    before: { suspendedAt: null },
    after: { suspendedAt: suspendedAt.toISOString(), reason },
  })
}

export async function unsuspendUser(actorId: string, targetId: string): Promise<void> {
  const target = await prisma.user.findUnique({
    where: { id: targetId },
    select: { id: true, suspendedAt: true },
  })
  if (!target) throw new AdminActionError('User not found.', 'NOT_FOUND')
  if (!target.suspendedAt) return

  await prisma.user.update({
    where: { id: targetId },
    data: { suspendedAt: null, suspendedReason: null, suspendedById: null },
  })

  await writeAudit({
    actorId,
    action: 'user.unsuspend',
    targetType: 'user',
    targetId,
    before: { suspendedAt: target.suspendedAt.toISOString() },
    after: { suspendedAt: null },
  })
}
