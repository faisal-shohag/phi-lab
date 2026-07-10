// Suspension enforcement.
//
// This MUST be a database read, never a session-cookie check. better-auth caches
// the session in a signed JWT cookie for 30 days, so a suspended user's cached
// session stays structurally valid long after we suspend them. `requireUser()`
// only reads that cookie and never touches the database — so every route that
// wants to bounce a suspended user has to ask Postgres.
//
// The lab token routes are the right choke point: they already hit Prisma for
// the daily-session count, and a suspended user who cannot mint a token cannot
// start a round. `getHiveUser()` performs the equivalent check for Hive.
import { prisma } from '@/lib/prisma'

/** True when the account is currently suspended. Safe on a missing user (treated as suspended). */
export async function isSuspended(userId: string): Promise<boolean> {
  const row = await prisma.user.findUnique({
    where: { id: userId },
    select: { suspendedAt: true },
  })
  return row?.suspendedAt != null
}
