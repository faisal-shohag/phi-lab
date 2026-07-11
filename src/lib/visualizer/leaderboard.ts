// Weekly XP leaderboard for the JS Motion visualizer. Ranks learners by the XP
// they *earned this ISO week* from visualizer activities (challenge wins, daily
// practice, concept completions, correct quizzes). Reuses the Hive ISO-week
// helpers so "this week" means the same thing platform-wide.

import { prisma } from '@/lib/prisma'
import { startOfIsoWeekUTC, isoWeekKey } from '@/lib/hive/leaderboard'

// Positive XP from these reasons counts toward the weekly board. Spends
// (negative amounts: stakes, AI charges, hints) are excluded by `amount > 0`.
const VIZ_EARN_REASONS = ['viz_challenge_win', 'viz_daily', 'viz_concept', 'quiz_correct']

export interface VizLeaderRow {
  userId: string
  name: string
  image: string | null
  xp: number
}

async function weeklyTotals(since: Date): Promise<Map<string, number>> {
  const grouped = await prisma.xpEvent.groupBy({
    by: ['userId'],
    where: { reason: { in: VIZ_EARN_REASONS }, amount: { gt: 0 }, createdAt: { gte: since } },
    _sum: { amount: true },
  })
  return new Map(grouped.map((g) => [g.userId, g._sum.amount ?? 0]))
}

export async function weeklyVizLeaderboard(limit = 10): Promise<{ week: string; rows: VizLeaderRow[] }> {
  const since = startOfIsoWeekUTC()
  const totals = await weeklyTotals(since)
  const ids = [...totals.keys()]
  if (ids.length === 0) return { week: isoWeekKey(), rows: [] }

  const users = await prisma.user.findMany({ where: { id: { in: ids } }, select: { id: true, name: true, image: true } })
  const byId = new Map(users.map((u) => [u.id, u]))

  const rows = ids
    .map((id) => ({ userId: id, name: byId.get(id)?.name ?? 'Learner', image: byId.get(id)?.image ?? null, xp: totals.get(id) ?? 0 }))
    .filter((r) => r.xp > 0)
    .sort((a, b) => b.xp - a.xp)
    .slice(0, limit)

  return { week: isoWeekKey(), rows }
}

// The caller's own rank + weekly XP (rank across everyone, not just the top N).
export async function myWeeklyRank(userId: string): Promise<{ rank: number | null; xp: number }> {
  const since = startOfIsoWeekUTC()
  const totals = await weeklyTotals(since)
  const mine = totals.get(userId) ?? 0
  if (mine <= 0) return { rank: null, xp: 0 }
  let ahead = 0
  for (const v of totals.values()) if (v > mine) ahead++
  return { rank: ahead + 1, xp: mine }
}
