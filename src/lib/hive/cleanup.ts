// Post lifecycle. Two callers:
//   • the feed GET calls maybeSweepExpired() opportunistically (throttled)
//   • the daily cron (POST /api/hive/cleanup) calls runCleanupCron() as the
//     reliable path, and also rolls the weekly Queen Bee + posts the occasional
//     encouragement.
//
// Unresolved QUESTIONs past their 3-day expiry are hard-deleted; cascades wipe
// their replies/events/reactions/follows in one query. RESOLVED/ARCHIVED posts
// and announcements/encouragement never match the filter, so knowledge survives
// and noise doesn't.
import { prisma } from '@/lib/prisma'
import { encouragementPost } from './ai'
import { PROVIDER_ENUM } from './providers'
import { weeklyLeaderboard, isoWeekKey } from './leaderboard'
import { awardXp } from '@/lib/gamification/award'
import { hiveQueenXp } from '@/lib/gamification/reasons'
import { notifyUser } from './notify'
import { NEVER_EXPIRES } from './constants'

let lastSweep = 0
const THROTTLE_MS = 15 * 60 * 1000 // at most once per 15 min per instance

/** Delete expired, unresolved questions. Returns the number removed. */
export async function sweepExpired(): Promise<number> {
  const res = await prisma.hivePost.deleteMany({
    where: {
      type: 'QUESTION',
      status: { in: ['OPEN', 'AI_WORKING', 'ESCALATED'] },
      expiresAt: { lt: new Date() },
    },
  })
  return res.count
}

/** Fire-and-forget sweep for hot read paths; skips if run recently. */
export async function maybeSweepExpired(): Promise<void> {
  const now = Date.now()
  if (now - lastSweep < THROTTLE_MS) return
  lastSweep = now
  try {
    await sweepExpired()
  } catch {
    // best-effort; the cron is the reliable path
  }
}

/**
 * Award last week's top helper. Idempotent: the XpEvent's (reason, sourceId)
 * unique constraint means re-running the cron never double-awards a week.
 */
async function rollWeeklyQueen(): Promise<string | null> {
  const rows = await weeklyLeaderboard(1)
  if (rows.length === 0) return null

  const winner = rows[0]
  const week = isoWeekKey()
  const result = await awardXp({
    userId: winner.userId,
    reason: 'hive_weekly_queen',
    sourceId: `queen:${week}`,
    amount: hiveQueenXp(),
    meta: { week, score: winner.score },
  })
  if (!result.awarded) return null

  await notifyUser({
    userId: winner.userId,
    type: 'badge',
    title: 'You are this week\'s Queen Bee 👑',
    body: `Top helper for ${week}.`,
  })
  return winner.userId
}

const ENCOURAGEMENT_GAP_MS = 48 * 60 * 60 * 1000

/** Post an encouragement if the Hive hasn't seen one in 48 hours. */
async function maybePostEncouragement(): Promise<boolean> {
  const recent = await prisma.hivePost.findFirst({
    where: { type: 'ENCOURAGEMENT', createdAt: { gte: new Date(Date.now() - ENCOURAGEMENT_GAP_MS) } },
    select: { id: true },
  })
  if (recent) return false

  const total = await prisma.hivePost.count({ where: { type: 'ENCOURAGEMENT' } })
  const post = await encouragementPost(total)

  await prisma.hivePost.create({
    data: {
      authorId: null, // AI-authored
      type: 'ENCOURAGEMENT',
      title: post.title,
      body: post.body,
      aiProvider: PROVIDER_ENUM[post.provider],
      status: 'OPEN',
      expiresAt: NEVER_EXPIRES,
    },
  })
  return true
}

export interface CleanupReport {
  deleted: number
  queenAwarded: string | null
  encouragementPosted: boolean
}

/** The daily cron body. Each step is independent; one failing must not skip the rest. */
export async function runCleanupCron(): Promise<CleanupReport> {
  const report: CleanupReport = { deleted: 0, queenAwarded: null, encouragementPosted: false }

  try {
    report.deleted = await sweepExpired()
  } catch {
    // keep going
  }
  try {
    report.queenAwarded = await rollWeeklyQueen()
  } catch {
    // keep going
  }
  try {
    report.encouragementPosted = await maybePostEncouragement()
  } catch {
    // keep going
  }
  return report
}
