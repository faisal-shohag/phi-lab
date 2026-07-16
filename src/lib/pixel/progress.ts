// Server-only. Where a learner stands in Pixel Lab, read straight off the XP
// ledger — there is no "completed" flag to forge, and no new table.
//
// Same shape as lib/visualizer/problems-progress.ts, for the reason the schema
// gives at prisma/schema.prisma:499-512: the catalog lives in code, and standing
// is derived on read from the receipts.
import 'server-only'

import { prisma } from '@/lib/prisma'
import { ALL_CHALLENGES, PIXEL_TOPICS, TOTAL_CHALLENGES, type TopicId } from './challenges'
import { PIXEL_EARN_REASONS, TIERS, parseSourceId, type Tier } from './score'

export interface TopicProgress {
  topicId: TopicId
  /** Challenges at Pixel perfect. */
  perfect: number
  /** Challenges with any tier at all. */
  attempted: number
  total: number
}

export interface PixelProgress {
  /** challengeId -> tiers earned. Absent means untouched. */
  tiersByChallenge: Record<string, Tier[]>
  attempted: number
  perfect: number
  total: number
  /** 0…1 over tiers, so partial credit shows. */
  percent: number
  topics: TopicProgress[]
  totalTiers: number
  earnedTiers: number
}

export async function getPixelProgress(userId: string): Promise<PixelProgress> {
  const events = await prisma.xpEvent.findMany({
    where: { userId, reason: { in: PIXEL_EARN_REASONS } },
    select: { sourceId: true },
  })

  // Ignore receipts for challenges since retired, so a shrinking catalog cannot
  // push anyone over 100%.
  const known = new Set(ALL_CHALLENGES.map((c) => c.id))
  const tiersByChallenge: Record<string, Tier[]> = {}

  for (const e of events) {
    const parsed = parseSourceId(e.sourceId)
    if (!parsed || !known.has(parsed.challengeId)) continue
    const list = (tiersByChallenge[parsed.challengeId] ??= [])
    if (!list.includes(parsed.tier)) list.push(parsed.tier)
  }

  // Keep display order stable regardless of the order they were earned in.
  for (const id of Object.keys(tiersByChallenge)) {
    tiersByChallenge[id].sort((a, b) => TIERS.indexOf(a) - TIERS.indexOf(b))
  }

  const isPerfect = (id: string) => tiersByChallenge[id]?.includes('perfect') ?? false
  const isAttempted = (id: string) => (tiersByChallenge[id]?.length ?? 0) > 0

  const topics: TopicProgress[] = PIXEL_TOPICS.map((t) => ({
    topicId: t.id,
    perfect: t.challenges.filter((c) => isPerfect(c.id)).length,
    attempted: t.challenges.filter((c) => isAttempted(c.id)).length,
    total: t.challenges.length,
  }))

  const earnedTiers = Object.values(tiersByChallenge).reduce((n, list) => n + list.length, 0)
  const totalTiers = TOTAL_CHALLENGES * TIERS.length

  return {
    tiersByChallenge,
    attempted: ALL_CHALLENGES.filter((c) => isAttempted(c.id)).length,
    perfect: ALL_CHALLENGES.filter((c) => isPerfect(c.id)).length,
    total: TOTAL_CHALLENGES,
    percent: totalTiers === 0 ? 0 : earnedTiers / totalTiers,
    topics,
    totalTiers,
    earnedTiers,
  }
}
