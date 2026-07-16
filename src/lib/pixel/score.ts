// Score → tier → XP.
//
// Pure: no DB, no DOM. The route handler awards; this decides. Splitting them is
// what lets the whole rule be tested over plain numbers in vitest's node
// environment, the way lib/path/progress.test.ts does it.
//
// ── Why the raw pixel match is not the score ──
// Because on most of these canvases it barely moves. A 1280x72 navbar is ~3%
// ink, so a learner who writes *nothing at all* leaves a white canvas that
// already matches 97% of the target — and used to be paid 16 XP for it, on
// every sparse challenge in the lab. Measured, not theorised: an empty editor
// scored 98.9% on hero-04 and collected Standing and Close.
//
// The fix is to stop counting the background. `score = 1 - diff / union`, where
// union is every pixel *either side painted*. Agreeing to leave the white parts
// white is not an achievement, so it earns nothing; what is left is the pixels
// that actually mattered to somebody, and how many of them are right.
//
//   blank editor   →  diff = all the target's ink, union = the same  →  0
//   the reference  →  diff = 0                                       →  1
//   box too big    →  diff = the overspill, union = the bigger box   →  partial
//   full-bleed art →  union = every pixel                            →  the plain match
//
// That last line matters: on a dense canvas this *is* the raw match, so the
// metric does not invent a second reality for the challenges where the obvious
// number already worked.
//
// ── Why not "distance from blank" ──
// Because it was tried and it broke on real attempts. Scoring
// `(match - blankMatch) / (1 - blankMatch)` also gives blank=0 and reference=1,
// but anything that paints pixels the target lacks scores *below* blank and
// clamps to 0: a learner whose box is too big, or in the wrong place, sits at
// 0% however they tweak it. No gradient to climb, in exactly the region where
// learners live. Union-based scoring has no floor to fall through — it always
// rewards the overlap you do have — and it needs no extra render to measure.
//
// This is also why there is no per-challenge calibration any more. An earlier
// build carried twelve hand-tuned `perfectAt` overrides derived from each
// target's ink density, plus a rule for deriving more — all of it patching this
// one problem, one challenge at a time, and only for the top tier. The bars
// below are global and mean the same thing on a 2%-ink navbar as on a
// full-bleed hero.
//
// The raw match is still reported next to the score, because "how many pixels
// are identical" is a real question with a real answer. It is just not the
// headline, since "98.9%" is a lie to someone who has done nothing.

export const TIERS = ['standing', 'close', 'perfect'] as const
export type Tier = (typeof TIERS)[number]

export const TIER_LABEL: Record<Tier, string> = {
  standing: 'Standing',
  close: 'Close',
  perfect: 'Pixel perfect',
}

export const TIER_BLURB: Record<Tier, string> = {
  standing: 'Recognisably the same thing.',
  close: 'Nearly there — the details are off.',
  perfect: 'Indistinguishable from the target.',
}

/**
 * The bars, against the normalised score.
 *
 * Perfect is not 1.0. Both sides render in one browser, so a correct answer does
 * land on exactly 1.0 — but demanding it would mean a single stray pixel out of
 * 92,160 costs the tier, and on a sparse canvas one pixel is a meaningful
 * fraction of the normalised scale. This leaves room for a rounding error
 * without leaving room for a mistake anyone could see.
 */
export const PERFECT_AT = 0.995
const CLOSE_AT = 0.9
const STANDING_AT = 0.75

// Sized against the JS Motion rates in lib/gamification/reasons.ts, where a
// server-checked practice problem pays 12. As there, the amount is decided here
// from the tier and never sent by the client.
export const TIER_XP: Record<Tier, number> = {
  standing: 6,
  close: 10,
  perfect: 15,
}

export const TIER_REASON: Record<Tier, string> = {
  standing: 'pixel_standing',
  close: 'pixel_close',
  perfect: 'pixel_perfect',
}

export const PIXEL_EARN_REASONS = Object.values(TIER_REASON)

/**
 * The score: of the pixels that mattered to either side, how many are right.
 *
 * @param diffPixels  pixels that differ, from diffImages
 * @param unionPixels pixels either side painted, from diffImages
 *
 * Both come out of one `diffImages` call, so this is arithmetic — no extra
 * render, nothing to cache, nothing to calibrate per challenge.
 */
export function scoreFrom(diffPixels: number, unionPixels: number): number {
  // Neither side painted anything. Either the target is blank (an authoring bug)
  // or the canvas is empty by design; either way there was nothing to get right,
  // so nothing was. Better than dividing by zero and paying everyone full marks.
  if (unionPixels <= 0) return 0
  return Math.min(1, Math.max(0, 1 - diffPixels / unionPixels))
}

/**
 * Every tier the score clears, not just the best one.
 *
 * Tiers are cumulative so that improving a score keeps paying: a learner who
 * scrapes Standing today and comes back to nail it collects Close and Perfect
 * then, rather than being told they already had their XP for this challenge.
 * Each tier is a separate ledger row, so the existing unique constraint makes a
 * re-check free.
 */
export function tiersFor(score: number): Tier[] {
  const earned: Tier[] = []
  if (score >= STANDING_AT) earned.push('standing')
  if (score >= CLOSE_AT) earned.push('close')
  if (score >= PERFECT_AT) earned.push('perfect')
  return earned
}

/** The bar for the next tier up, or null at the top. For "you need 90% to…". */
export function nextTierAt(score: number): { tier: Tier; at: number } | null {
  if (score < STANDING_AT) return { tier: 'standing', at: STANDING_AT }
  if (score < CLOSE_AT) return { tier: 'close', at: CLOSE_AT }
  if (score < PERFECT_AT) return { tier: 'perfect', at: PERFECT_AT }
  return null
}

export function xpFor(tier: Tier): number {
  return TIER_XP[tier]
}

/** Idempotency key. At most three rows per challenge, forever. */
export function sourceIdFor(challengeId: string, tier: Tier): string {
  return `pixel:${challengeId}:${tier}`
}

const SOURCE_PREFIX = 'pixel:'

/** Inverse of `sourceIdFor`, for reading progress back off the ledger. */
export function parseSourceId(sourceId: string): { challengeId: string; tier: Tier } | null {
  if (!sourceId.startsWith(SOURCE_PREFIX)) return null
  const rest = sourceId.slice(SOURCE_PREFIX.length)
  const split = rest.lastIndexOf(':')
  if (split <= 0) return null
  const challengeId = rest.slice(0, split)
  const tier = rest.slice(split + 1) as Tier
  if (!TIERS.includes(tier)) return null
  return { challengeId, tier }
}
