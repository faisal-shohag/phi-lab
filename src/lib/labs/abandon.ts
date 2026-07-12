// Ending a live session that will never end itself.
//
// Two callers, one rule. The learner's own beacon fires on unload
// (/api/labs/abandon); an admin can force-end a wedged session from the labs
// monitor (/api/admin/labs/end). They must agree about what "abandoned" means per
// lab, so the switch lives here rather than in either route.
//
// The status guard in every where-clause is the safety property: only a session
// that is still running matches. A beacon racing a completed report, or an admin
// clicking force-end on a round that just finished, updates nothing — a finished
// session can never be clobbered back into ABANDONED.
import { prisma } from '@/lib/prisma'
import type { LiveFeature } from './end-session'

export type { LiveFeature }

/**
 * Mark a running session abandoned. Returns true if a row actually moved, which
 * is how the admin route tells "done" from "it had already ended".
 *
 * `userId` scopes the update to its owner — pass it for anything the learner
 * triggers, so a signed-in user cannot end someone else's round. An admin acting
 * from the dashboard omits it, and is audited instead.
 */
export async function abandonSession(
  feature: LiveFeature,
  sessionId: string,
  opts: { userId?: string } = {},
): Promise<boolean> {
  const endedAt = new Date()
  const owner = opts.userId ? { userId: opts.userId } : {}

  switch (feature) {
    case 'INTERVIEW': {
      const { count } = await prisma.interviewSession.updateMany({
        where: { id: sessionId, ...owner, status: 'IN_PROGRESS' },
        data: { status: 'ABANDONED', endedAt },
      })
      return count > 0
    }
    case 'FEYNMAN': {
      const { count } = await prisma.feynmanSession.updateMany({
        where: { id: sessionId, ...owner, status: 'IN_PROGRESS' },
        data: { status: 'ABANDONED', endedAt },
      })
      return count > 0
    }
    case 'ENGLISH': {
      const { count } = await prisma.englishSession.updateMany({
        where: { id: sessionId, ...owner, status: 'IN_PROGRESS' },
        data: { status: 'ABANDONED', endedAt },
      })
      return count > 0
    }
    case 'SUPPORT': {
      // Support's status is a plain string, and 'waiting' counts as abandonable: a
      // learner who closes the tab in the queue must free their slot too. Ending an
      // 'active' one releases a concurrency slot, which claimSlots() then promotes
      // the next person into — so force-ending a wedged call unblocks the queue.
      const { count } = await prisma.supportSession.updateMany({
        where: { id: sessionId, ...owner, status: { in: ['waiting', 'active'] } },
        data: { status: 'abandoned', endedAt },
      })
      return count > 0
    }
  }
}
