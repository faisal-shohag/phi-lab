// The attempt log.
//
// ── Why this exists next to progress.ts ──
// `getPixelProgress` derives everything from the XpEvent ledger, which is
// idempotent by design: it records the *first* time each tier was earned and
// nothing after. So it cannot answer the question a learner actually asks —
// "what have I tried, and is it getting better?" A re-score that lifts 46% to
// 92% writes nothing to the ledger at all, because the tiers were already paid.
//
// This is the log, not the receipt. One row per submit, keeping the code, so
// they can read back what they wrote and watch it improve.
//
// ── What it is not ──
// A source of truth. XP, unlocks and progress stay derived from XpEvent
// (lib/pixel/unlock.ts, lib/pixel/progress.ts), so this table can be pruned,
// truncated or lost and nobody loses a single point. That is deliberate: it
// means writes here are allowed to fail.

import 'server-only'

import { prisma } from '@/lib/prisma'

import { challengeById } from './challenges'
import type { Tier } from './score'

export interface SubmissionRecord {
  id: string
  challengeId: string
  html: string
  css: string
  score: number
  match: number
  diffPixels: number
  unionPixels: number
  tiers: Tier[]
  createdAt: string
}

export interface RecordInput {
  userId: string
  challengeId: string
  html: string
  css: string
  score: number
  match: number
  diffPixels: number
  unionPixels: number
  tiers: Tier[]
}

/**
 * Log an attempt. Never throws.
 *
 * The learner has already done the work and the render has already been paid
 * for; losing the row is a shame, losing their score because a log write failed
 * would be indefensible. Also the reason `complete` calls this *after* awarding:
 * the ledger is what matters, and it must not wait on this.
 */
export async function recordSubmission(input: RecordInput): Promise<void> {
  try {
    await prisma.pixelSubmission.create({
      data: {
        userId: input.userId,
        challengeId: input.challengeId,
        html: input.html,
        css: input.css,
        score: input.score,
        match: input.match,
        diffPixels: input.diffPixels,
        unionPixels: input.unionPixels,
        tiers: input.tiers,
      },
    })
  } catch {
    // Swallowed on purpose — see above. The commonest cause in practice is the
    // table not existing yet, which must not take the lab down with it.
  }
}

/** How many attempts to hand back. A learner reads the last few, not the last thousand. */
const PAGE = 20

/**
 * One learner's attempts at one challenge, newest first.
 *
 * Scoped to the caller's own userId by the route — there is no "someone else's
 * submissions" query here, and there should not be one without a reason: this
 * table holds the code people wrote while they were still bad at it.
 */
export async function listSubmissions(
  userId: string,
  challengeId: string,
  limit = PAGE,
): Promise<SubmissionRecord[]> {
  if (!challengeById(challengeId)) return []
  try {
    const rows = await prisma.pixelSubmission.findMany({
      where: { userId, challengeId },
      orderBy: { createdAt: 'desc' },
      take: Math.min(limit, PAGE),
    })
    return rows.map((r) => ({
      id: r.id,
      challengeId: r.challengeId,
      html: r.html,
      css: r.css,
      score: r.score,
      match: r.match,
      diffPixels: r.diffPixels,
      unionPixels: r.unionPixels,
      tiers: r.tiers as Tier[],
      createdAt: r.createdAt.toISOString(),
    }))
  } catch {
    // The table may not exist yet (the migration is applied by hand — see
    // prisma/migrations/…_pixel_submissions). An empty history is a fine answer;
    // a 500 on the arena is not.
    return []
  }
}

/** The learner's best attempt at a challenge, for "your best: 92%". */
export async function bestSubmission(userId: string, challengeId: string): Promise<SubmissionRecord | null> {
  const all = await listSubmissions(userId, challengeId)
  return all.reduce<SubmissionRecord | null>((best, s) => (!best || s.score > best.score ? s : best), null)
}
