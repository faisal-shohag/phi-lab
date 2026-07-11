// Per-user daily caps and today's platform-wide load, for the admin dashboard.
// Read-only.
//
// The caps are per-user-per-UTC-day (a student may start N interview sessions a
// day), enforced at the token routes by counting today's rows. There's no single
// platform "remaining" — that varies per user — so this shows the configured cap
// alongside how many were started across all users today, which is the number an
// admin actually watches when deciding whether to loosen a knob.
//
// Coach is the exception: its throttle is an in-memory per-instance bucket
// (consumeDaily), not row-counted, so there's no honest today-count to show — cap
// only.
import { prisma } from '@/lib/prisma'
import { getSettings } from '@/lib/admin/settings'

/** Start of the current UTC day. Matches the lab token routes' row-count window. */
function startOfTodayUTC(): Date {
  const d = new Date()
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()))
}

export interface DailyCap {
  feature: string
  /** Configured cap, per user per UTC day. */
  cap: number
  /** Rows started across all users today; null when not row-counted (coach). */
  usedToday: number | null
}

export async function dailyCaps(): Promise<DailyCap[]> {
  const since = startOfTodayUTC()
  const window = { createdAt: { gte: since } }

  const [settings, interview, feynman, english, analogies] = await Promise.all([
    getSettings(),
    prisma.interviewSession.count({ where: window }),
    prisma.feynmanSession.count({ where: window }),
    prisma.englishSession.count({ where: window }),
    prisma.analogyCard.count({ where: window }),
  ])

  return [
    { feature: 'Interview', cap: settings['lab.interview.dailyLimit'], usedToday: interview },
    { feature: 'Feynman', cap: settings['lab.feynman.dailyLimit'], usedToday: feynman },
    { feature: 'English', cap: settings['lab.english.dailyLimit'], usedToday: english },
    { feature: 'Analogies', cap: settings['lab.analogies.dailyLimit'], usedToday: analogies },
    // In-memory per-instance throttle — no reliable platform count. Cap only.
    { feature: 'Hive coach', cap: settings['hive.dailyCoachLimit'], usedToday: null },
  ]
}
