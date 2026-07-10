// Weekly helper leaderboard. Ranks people by what they gave the Hive this week:
// nectar received on their replies, answers the AI verified, answers the asker
// accepted. Asking questions earns nothing here — this board is about helping.
import { prisma } from '@/lib/prisma'

// Accepted answers are the strongest signal, then AI verification, then nectar.
const W_NECTAR = 1
const W_APPROVED = 3
const W_ACCEPTED = 5

/** Monday 00:00 UTC of the current ISO week. */
export function startOfIsoWeekUTC(now = new Date()): Date {
  const d = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()))
  const dow = d.getUTCDay() || 7 // Sunday (0) counts as day 7
  d.setUTCDate(d.getUTCDate() - (dow - 1))
  return d
}

/** Stable "2026-W28" key, used as the idempotent sourceId for the Queen award. */
export function isoWeekKey(now = new Date()): string {
  const d = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()))
  const dow = d.getUTCDay() || 7
  d.setUTCDate(d.getUTCDate() + 4 - dow) // nearest Thursday defines the ISO year
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1))
  const week = Math.ceil(((d.getTime() - yearStart.getTime()) / 86_400_000 + 1) / 7)
  return `${d.getUTCFullYear()}-W${String(week).padStart(2, '0')}`
}

export interface LeaderboardRow {
  userId: string
  name: string
  image: string | null
  nectar: number
  approved: number
  accepted: number
  score: number
}

export async function weeklyLeaderboard(limit = 10): Promise<LeaderboardRow[]> {
  const since = startOfIsoWeekUTC()

  // Nectar needs a join from reactions to the reply's author, so it's raw SQL.
  const nectarRows = await prisma.$queryRaw<{ userId: string; nectar: bigint }[]>`
    SELECT r."authorId" AS "userId", COUNT(*) AS nectar
    FROM hive_reaction rx
    JOIN hive_reply r ON r.id = rx."replyId"
    WHERE rx."createdAt" >= ${since} AND r."authorId" IS NOT NULL
    GROUP BY r."authorId"
  `

  const [approvedRows, acceptedRows] = await Promise.all([
    prisma.xpEvent.groupBy({
      by: ['userId'],
      where: { reason: 'hive_answer_approved', createdAt: { gte: since } },
      _count: { _all: true },
    }),
    prisma.xpEvent.groupBy({
      by: ['userId'],
      where: { reason: 'hive_answer_accepted', createdAt: { gte: since } },
      _count: { _all: true },
    }),
  ])

  const totals = new Map<string, { nectar: number; approved: number; accepted: number }>()
  const bump = (id: string, patch: Partial<{ nectar: number; approved: number; accepted: number }>) => {
    const cur = totals.get(id) ?? { nectar: 0, approved: 0, accepted: 0 }
    totals.set(id, { ...cur, ...patch })
  }
  for (const r of nectarRows) bump(r.userId, { nectar: Number(r.nectar) })
  for (const r of approvedRows) {
    const cur = totals.get(r.userId) ?? { nectar: 0, approved: 0, accepted: 0 }
    totals.set(r.userId, { ...cur, approved: r._count._all })
  }
  for (const r of acceptedRows) {
    const cur = totals.get(r.userId) ?? { nectar: 0, approved: 0, accepted: 0 }
    totals.set(r.userId, { ...cur, accepted: r._count._all })
  }
  if (totals.size === 0) return []

  const users = await prisma.user.findMany({
    where: { id: { in: [...totals.keys()] } },
    select: { id: true, name: true, image: true },
  })

  return users
    .map((u) => {
      const t = totals.get(u.id)!
      return {
        userId: u.id,
        name: u.name,
        image: u.image,
        ...t,
        score: t.nectar * W_NECTAR + t.approved * W_APPROVED + t.accepted * W_ACCEPTED,
      }
    })
    .filter((r) => r.score > 0)
    .sort((a, b) => b.score - a.score || b.accepted - a.accepted)
    .slice(0, limit)
}
