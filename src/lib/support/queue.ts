// The concurrency gate for the Support lab: at most MAX_ACTIVE_SESSIONS live
// sessions across the whole platform. Only imported by route handlers.
//
// A Postgres advisory lock (pg_advisory_xact_lock) serializes slot claims so two
// simultaneous pollers can't both grab the last slot. This is the one place the
// codebase uses a lock + transaction; everywhere else idempotency comes from
// unique constraints, which don't fit a "max N active" gate.
//
// Heartbeats: a live/queued client polls this every few seconds, which refreshes
// its `lastSeenAt`. An active session whose heartbeat goes stale (closed tab,
// dead network) has its slot reclaimed so the queue keeps moving.
import { prisma } from '@/lib/prisma'
import { HEARTBEAT_STALE_MS } from './prompt'
import { getSetting } from '@/lib/admin/settings'

// Arbitrary fixed key so every process locks the same advisory-lock slot.
const ADVISORY_KEY = 918273645

export interface SlotResult {
  status: string
  /** 1-based place in the queue while waiting; 0 once active. */
  position: number
}

/**
 * Heartbeat `sessionId`, reclaim any dead slots, promote the oldest waiting
 * sessions into free slots, and return this session's resulting status/position.
 * Runs entirely inside one advisory-locked transaction.
 */
export async function claimSlots(sessionId: string): Promise<SlotResult> {
  // Resolved before the lock: getSetting reads through the global client, so it
  // would run outside `tx` regardless, and holding the advisory lock across an
  // extra round-trip would serialize every poller behind it.
  const maxActive = await getSetting('lab.support.maxActiveSessions')

  return prisma.$transaction(async (tx) => {
    await tx.$executeRawUnsafe(`SELECT pg_advisory_xact_lock(${ADVISORY_KEY})`)

    const now = new Date()
    const staleBefore = new Date(now.getTime() - HEARTBEAT_STALE_MS)

    // 1. Reclaim dead slots and drop dead queue entries.
    await tx.supportSession.updateMany({
      where: { status: 'active', lastSeenAt: { lt: staleBefore } },
      data: { status: 'abandoned', endedAt: now },
    })
    await tx.supportSession.updateMany({
      where: { status: 'waiting', lastSeenAt: { lt: staleBefore } },
      data: { status: 'abandoned' },
    })

    // 2. Heartbeat this session (only while it's still in play).
    const me = await tx.supportSession.findUnique({
      where: { id: sessionId },
      select: { status: true },
    })
    if (!me) return { status: 'abandoned', position: 0 }
    if (me.status !== 'waiting' && me.status !== 'active') {
      return { status: me.status, position: 0 }
    }
    await tx.supportSession.update({ where: { id: sessionId }, data: { lastSeenAt: now } })

    // 3. Promote the oldest waiting sessions into any free slots.
    const activeCount = await tx.supportSession.count({ where: { status: 'active' } })
    const free = maxActive - activeCount
    if (free > 0) {
      const waiting = await tx.supportSession.findMany({
        where: { status: 'waiting' },
        orderBy: { createdAt: 'asc' },
        take: free,
        select: { id: true, startedAt: true },
      })
      for (const w of waiting) {
        await tx.supportSession.update({
          where: { id: w.id },
          data: { status: 'active', startedAt: w.startedAt ?? now, lastSeenAt: now },
        })
      }
    }

    // 4. Report this session's standing.
    const after = await tx.supportSession.findUnique({
      where: { id: sessionId },
      select: { status: true, createdAt: true },
    })
    if (!after) return { status: 'abandoned', position: 0 }
    if (after.status === 'active') return { status: 'active', position: 0 }

    const ahead = await tx.supportSession.count({
      where: { status: 'waiting', createdAt: { lt: after.createdAt } },
    })
    return { status: after.status, position: ahead + 1 }
  })
}
