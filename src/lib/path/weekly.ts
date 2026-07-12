// Server-only. Orchestrates the weekly report: gather the week's evidence, build
// the digest, call the AI, cache the result one row per ISO week. Split out from
// ai.ts so the pure prompt/schema code stays free of Prisma.

import { prisma } from '@/lib/prisma'
import { levelInfo } from '@/lib/gamification/levels'
import { evaluate, loadEvidence } from './progress'
import { buildDigest, generateWeeklyReport } from './ai'
import type { WeeklyReport } from './types'

/** Monday (UTC) of the ISO week containing `d`, as "YYYY-MM-DD". */
export function weekOf(d = new Date()): string {
  const date = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()))
  const day = (date.getUTCDay() + 6) % 7 // Mon=0 … Sun=6
  date.setUTCDate(date.getUTCDate() - day)
  return date.toISOString().slice(0, 10)
}

/**
 * Return this week's report, generating + caching it if absent. `force` bypasses
 * the cache (the weekly cron uses it to refresh). Returns null only when the AI
 * is unreachable AND nothing is cached — the path page treats that as "no report
 * yet" and shows the map without one.
 */
export async function getWeeklyReport(userId: string, opts: { force?: boolean } = {}): Promise<WeeklyReport | null> {
  const week = weekOf()

  if (!opts.force) {
    const cached = await prisma.weeklyPlan.findUnique({ where: { userId_weekOf: { userId, weekOf: week } } })
    if (cached) return { weekOf: week, ...(cached.report as object) } as WeeklyReport
  }

  const [user, ev] = await Promise.all([
    prisma.user.findUnique({ where: { id: userId }, select: { name: true, xp: true } }),
    loadEvidence(userId),
  ])
  if (!user) return null

  const nodes = evaluate(ev)
  const info = levelInfo(user.xp)

  // Mastery timestamps live in the evidence map; "this week" = mastered since Monday.
  const weekStart = new Date(`${week}T00:00:00Z`)
  const masteredThisWeek = [...ev.mastered.entries()]
    .filter(([, at]) => at >= weekStart)
    .map(([id]) => id)

  const [completed, missed] = await questTallyThisWeek(userId, week)

  const digest = buildDigest(user.name || 'Learner', info.level, info.title, nodes, masteredThisWeek, {
    completed,
    missed,
  })

  let report: WeeklyReport
  try {
    report = await generateWeeklyReport(digest, week, { userId })
  } catch {
    // AI unreachable this minute. Don't cache a failure; fall back to any older
    // cached week so the learner still sees *something*, else null.
    const stale = await prisma.weeklyPlan.findFirst({
      where: { userId },
      orderBy: { createdAt: 'desc' },
    })
    return stale ? ({ weekOf: stale.weekOf, ...(stale.report as object) } as WeeklyReport) : null
  }

  const { weekOf: _weekOf, ...body } = report
  void _weekOf
  await prisma.weeklyPlan.upsert({
    where: { userId_weekOf: { userId, weekOf: week } },
    create: { userId, weekOf: week, focus: report.focus.map((f) => f.nodeId), report: body as object },
    update: { focus: report.focus.map((f) => f.nodeId), report: body as object },
  })

  return report
}

/** Completed vs missed daily quests since Monday. A day with no row = missed. */
async function questTallyThisWeek(userId: string, week: string): Promise<[number, number]> {
  const rows = await prisma.dailyQuest.findMany({
    where: { userId, day: { gte: week } },
    select: { completedAt: true },
  })
  const completed = rows.filter((r) => r.completedAt).length
  // Days elapsed this week so far (Mon..today), capped at 7.
  const elapsed = Math.min(7, Math.floor((Date.now() - new Date(`${week}T00:00:00Z`).getTime()) / 86_400_000) + 1)
  return [completed, Math.max(0, elapsed - completed)]
}
