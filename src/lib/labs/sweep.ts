// The backstop for a round that never told us it was over.
//
// /api/labs/abandon covers the ordinary walk-away, but it rides on sendBeacon,
// which is best-effort by design: a killed browser, a closed laptop or a lost
// network takes the beacon with it. Those rows would sit at IN_PROGRESS forever,
// inflating "sessions in progress" on the admin dashboard and — for support —
// holding one of the scarce concurrency slots hostage.
//
// So anything still running long after it could plausibly still be running gets
// swept. The threshold is deliberately far beyond the longest round (support caps
// at ten minutes): this is a garbage collector, not a timer, and it must never
// reap a session a learner is actually sitting in.
import { prisma } from '@/lib/prisma'

/** Well past the longest possible round, so a live session is never reaped. */
const STALE_AFTER_MS = 2 * 60 * 60 * 1000

export interface SweepReport {
  interview: number
  feynman: number
  english: number
  support: number
}

export async function sweepStaleLabSessions(): Promise<SweepReport> {
  const cutoff = new Date(Date.now() - STALE_AFTER_MS)
  const endedAt = new Date()

  // startedAt, not createdAt: a session's age is measured from when it went live.
  const stale = { status: 'IN_PROGRESS' as const, startedAt: { lt: cutoff } }
  const abandon = { status: 'ABANDONED' as const, endedAt }

  const [interview, feynman, english, support] = await Promise.all([
    prisma.interviewSession.updateMany({ where: stale, data: abandon }),
    prisma.feynmanSession.updateMany({ where: stale, data: abandon }),
    prisma.englishSession.updateMany({ where: stale, data: abandon }),
    // Support's status is a plain string, and a learner stuck in the queue is as
    // stale as one stuck in a call — both hold a slot.
    prisma.supportSession.updateMany({
      where: { status: { in: ['waiting', 'active'] }, createdAt: { lt: cutoff } },
      data: { status: 'abandoned', endedAt },
    }),
  ])

  return {
    interview: interview.count,
    feynman: feynman.count,
    english: english.count,
    support: support.count,
  }
}
