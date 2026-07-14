// Server-only. The one thing the rescue rules need a database for: writing off a
// round nobody came back to.
//
// The rules themselves are pure and live in `challenge.ts` (`rescuableFor` /
// `isAbandoned`) so they can be tested without a database and stay client-safe.
// This is shared rather than inlined because `active` (which shows the round)
// and `activate` (which refuses to start a second one) must agree on exactly
// when a lapsed round stops counting. If they drift, a learner either loses a
// round they could have rescued or gets locked out by one they can't reach.
import 'server-only'

import { prisma } from '@/lib/prisma'
import { isAbandoned, type RescueState } from './challenge'

/**
 * Close a round whose rescue offer has gone unanswered for too long, so it stops
 * blocking the one-active-challenge rule. Returns true if it closed the round —
 * the caller should treat it as gone.
 */
export async function closeIfAbandoned(attempt: RescueState & { id: string }, now = Date.now()): Promise<boolean> {
  if (!isAbandoned(attempt, now)) return false
  await prisma.challengeAttempt.update({ where: { id: attempt.id }, data: { status: 'lost' } })
  return true
}
