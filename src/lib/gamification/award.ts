// Server-only gamification core: grant XP idempotently, recompute stats, unlock
// badges, and read a learner's profile. Never trust a client-supplied XP amount
// — amounts are derived here from the reason. Only imported by route handlers.
import { prisma } from '@/lib/prisma'
import { levelInfo } from './levels'
import { earnedBadgeIds, type BadgeStats } from './badges'

export interface AwardResult {
  /** false when this exact (reason, sourceId) was already granted. */
  awarded: boolean
  xpGained: number
  totalXp: number
  level: number
  leveledUp: boolean
  /** Badge ids unlocked as a result of this award. */
  newBadges: string[]
}

interface AwardInput {
  userId: string
  reason: string
  /** Stable id that makes the grant idempotent (sessionId, run:step, …). */
  sourceId: string
  amount: number
  meta?: Record<string, unknown>
}

/**
 * Idempotently grant XP. If (userId, reason, sourceId) already exists, nothing
 * changes and `awarded` is false. Otherwise the event is written, the user's
 * total is incremented, and badges are re-evaluated.
 */
export async function awardXp(input: AwardInput): Promise<AwardResult> {
  const { userId, reason, sourceId, meta } = input
  const amount = Math.max(0, Math.floor(input.amount))

  const before = await prisma.user.findUnique({ where: { id: userId }, select: { xp: true } })
  const beforeXp = before?.xp ?? 0
  const beforeLevel = levelInfo(beforeXp).level

  // Insert the ledger row first; the unique constraint makes double-awards a
  // no-op that we detect and short-circuit.
  try {
    await prisma.xpEvent.create({
      data: { userId, reason, sourceId, amount, meta: (meta ?? undefined) as object | undefined },
    })
  } catch {
    // Already awarded — return current standing without mutating anything.
    return {
      awarded: false,
      xpGained: 0,
      totalXp: beforeXp,
      level: beforeLevel,
      leveledUp: false,
      newBadges: [],
    }
  }

  const updated = await prisma.user.update({
    where: { id: userId },
    data: { xp: { increment: amount } },
    select: { xp: true },
  })
  const totalXp = updated.xp
  const afterLevel = levelInfo(totalXp).level

  const newBadges = await syncBadges(userId)

  return {
    awarded: true,
    xpGained: amount,
    totalXp,
    level: afterLevel,
    leveledUp: afterLevel > beforeLevel,
    newBadges,
  }
}

/** Aggregate the numbers badge predicates need, straight from the ledger. */
export async function getStats(userId: string): Promise<BadgeStats> {
  const [user, events] = await Promise.all([
    prisma.user.findUnique({ where: { id: userId }, select: { xp: true } }),
    prisma.xpEvent.findMany({
      where: { userId },
      select: { reason: true, meta: true },
    }),
  ])

  const totalXp = user?.xp ?? 0
  let interviewsCompleted = 0
  let bestInterviewScore = 0
  let quizCorrect = 0
  let bestQuizStreak = 0
  let hardModeCleared = false
  let feynmanCompleted = 0
  let bestClarity = 0
  let englishCompleted = 0
  let bestEnglish = 0
  let analogiesCreated = 0
  let supportCompleted = 0
  let hiveReplies = 0
  let hiveApproved = 0
  let hiveAccepted = 0
  let hiveQueenWeeks = 0

  for (const e of events) {
    const meta = (e.meta ?? {}) as Record<string, unknown>
    if (e.reason === 'interview_completed') {
      interviewsCompleted++
      const score = typeof meta.score === 'number' ? meta.score : 0
      if (score > bestInterviewScore) bestInterviewScore = score
      const pressure = typeof meta.pressure === 'string' ? meta.pressure : 'neutral'
      if ((pressure === 'stern' || pressure === 'panel') && score >= 60) hardModeCleared = true
    } else if (e.reason === 'quiz_correct') {
      quizCorrect++
      const streak = typeof meta.streak === 'number' ? meta.streak : 0
      if (streak > bestQuizStreak) bestQuizStreak = streak
    } else if (e.reason === 'feynman_completed') {
      feynmanCompleted++
      const clarity = typeof meta.clarity === 'number' ? meta.clarity : 0
      if (clarity > bestClarity) bestClarity = clarity
    } else if (e.reason === 'english_completed') {
      englishCompleted++
      const score = typeof meta.score === 'number' ? meta.score : 0
      if (score > bestEnglish) bestEnglish = score
    } else if (e.reason === 'analogy_created') {
      analogiesCreated++
    } else if (e.reason === 'support_completed') {
      supportCompleted++
    } else if (e.reason === 'hive_reply_posted') {
      // Recorded for every reply, even once the daily XP cap zeroes the amount,
      // so badge progress reflects real helping rather than the cap.
      hiveReplies++
    } else if (e.reason === 'hive_answer_approved') {
      hiveApproved++
    } else if (e.reason === 'hive_answer_accepted') {
      hiveAccepted++
    } else if (e.reason === 'hive_weekly_queen') {
      hiveQueenWeeks++
    }
  }

  return {
    totalXp,
    level: levelInfo(totalXp).level,
    interviewsCompleted,
    bestInterviewScore,
    quizCorrect,
    bestQuizStreak,
    hardModeCleared,
    feynmanCompleted,
    bestClarity,
    englishCompleted,
    bestEnglish,
    analogiesCreated,
    supportCompleted,
    hiveReplies,
    hiveApproved,
    hiveAccepted,
    hiveQueenWeeks,
  }
}

/** Insert any newly-earned badges; returns the ids that were just unlocked. */
export async function syncBadges(userId: string): Promise<string[]> {
  const stats = await getStats(userId)
  const shouldHave = earnedBadgeIds(stats)
  if (shouldHave.length === 0) return []

  const existing = await prisma.userBadge.findMany({
    where: { userId, badgeId: { in: shouldHave } },
    select: { badgeId: true },
  })
  const have = new Set(existing.map((b) => b.badgeId))
  const missing = shouldHave.filter((id) => !have.has(id))
  if (missing.length === 0) return []

  await prisma.userBadge.createMany({
    data: missing.map((badgeId) => ({ userId, badgeId })),
    skipDuplicates: true,
  })
  return missing
}

export interface XpProfile {
  xp: number
  badgeIds: string[]
  stats: BadgeStats
}

export async function getProfile(userId: string): Promise<XpProfile> {
  const [user, badges, stats] = await Promise.all([
    prisma.user.findUnique({ where: { id: userId }, select: { xp: true } }),
    prisma.userBadge.findMany({ where: { userId }, select: { badgeId: true }, orderBy: { createdAt: 'asc' } }),
    getStats(userId),
  ])
  return {
    xp: user?.xp ?? 0,
    badgeIds: badges.map((b) => b.badgeId),
    stats,
  }
}
