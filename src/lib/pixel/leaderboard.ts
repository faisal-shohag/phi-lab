// Weekly XP leaderboard for Pixel Lab, ranked on XP earned *this ISO week*.
//
// Modelled on lib/visualizer/leaderboard.ts and reusing the same Hive ISO-week
// helpers, so "this week" means the same thing platform-wide and someone working
// across both labs sees the boards roll over together.

import { prisma } from '@/lib/prisma'
import { startOfIsoWeekUTC, isoWeekKey } from '@/lib/hive/leaderboard'
import { PIXEL_EARN_REASONS } from './score'

export interface PixelLeaderRow {
  userId: string
  name: string
  image: string | null
  xp: number
}

// `amount > 0` mirrors the visualizer board. Pixel Lab has no spends today, but
// the ledger is shared and a future one must not be able to buy a rank.
async function weeklyTotals(since: Date): Promise<Map<string, number>> {
  const grouped = await prisma.xpEvent.groupBy({
    by: ['userId'],
    where: { reason: { in: PIXEL_EARN_REASONS }, amount: { gt: 0 }, createdAt: { gte: since } },
    _sum: { amount: true },
  })
  return new Map(grouped.map((g) => [g.userId, g._sum.amount ?? 0]))
}

export async function weeklyPixelLeaderboard(limit = 10): Promise<{ week: string; rows: PixelLeaderRow[] }> {
  const since = startOfIsoWeekUTC()
  const totals = await weeklyTotals(since)
  const ids = [...totals.keys()]
  if (ids.length === 0) return { week: isoWeekKey(), rows: [] }

  const users = await prisma.user.findMany({
    where: { id: { in: ids } },
    select: { id: true, name: true, image: true },
  })
  const byId = new Map(users.map((u) => [u.id, u]))

  const rows = ids
    .map((id) => ({
      userId: id,
      name: byId.get(id)?.name ?? 'Learner',
      image: byId.get(id)?.image ?? null,
      xp: totals.get(id) ?? 0,
    }))
    .filter((r) => r.xp > 0)
    .sort((a, b) => b.xp - a.xp)
    .slice(0, limit)

  return { week: isoWeekKey(), rows }
}

/** The caller's own rank + weekly XP, ranked across everyone rather than the top N. */
export async function myWeeklyPixelRank(userId: string): Promise<{ rank: number | null; xp: number }> {
  const since = startOfIsoWeekUTC()
  const totals = await weeklyTotals(since)
  const mine = totals.get(userId) ?? 0
  if (mine <= 0) return { rank: null, xp: 0 }
  let ahead = 0
  for (const v of totals.values()) if (v > mine) ahead++
  return { rank: ahead + 1, xp: mine }
}
