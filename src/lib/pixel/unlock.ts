// The run: which challenges are open, which are shut, and what just opened.
//
// Pure — no DB, no DOM. Everything here is a function of `tiersByChallenge`,
// which the ledger already gives us (lib/pixel/progress.ts), so there is no new
// table and no `unlocked` column to fall out of step with what was actually
// earned. Same posture as lib/path/progress.ts, which this borrows its shape
// from.
//
// ── The rule ──
// Linear. The first challenge is always open; challenge N opens when N-1 has
// been cleared. Cleared means **Standing** — 75%, the bottom tier — and not
// Pixel perfect. Perfect is 99.5%, and gating on it would let one stubborn
// challenge wall a learner out of the other 26 forever, which is the opposite of
// a lab people use eagerly.
//
// ── Milestones ──
// A topic boundary. Clearing the last navbar does not just open the first hero;
// it opens *Heroes*, and that is worth a louder noise than the step before it.
// Falls out of the catalog order rather than being declared: PIXEL_TOPICS is the
// curriculum order, so a challenge is a milestone if the next one belongs to a
// different topic.

import { ALL_CHALLENGES, type PixelChallenge, type TopicId } from './challenges'
import type { Tier } from './score'

export type NodeState =
  /** Shut. The one before it has not been cleared. */
  | 'locked'
  /** Open and unfinished — where the learner is. */
  | 'available'
  /** Standing or better. Opens the next one. */
  | 'cleared'
  /** Nothing left to get. */
  | 'perfect'

/** Progress as the client holds it: challenge id → the tiers banked for it. */
export type TiersByChallenge = Record<string, Tier[]>

function has(tiers: TiersByChallenge, id: string, tier: Tier): boolean {
  return tiers[id]?.includes(tier) ?? false
}

/** The bar that opens the next challenge. */
export function isCleared(tiers: TiersByChallenge, id: string): boolean {
  return has(tiers, id, 'standing')
}

/**
 * Every challenge's state, in catalog order.
 *
 * One pass is enough: the catalog order *is* the dependency order, so a
 * challenge only ever depends on the one before it.
 */
export function unlockStates(tiers: TiersByChallenge): Record<string, NodeState> {
  const out: Record<string, NodeState> = {}
  let previousCleared = true // the first one has nothing in front of it

  for (const challenge of ALL_CHALLENGES) {
    const cleared = isCleared(tiers, challenge.id)
    if (has(tiers, challenge.id, 'perfect')) out[challenge.id] = 'perfect'
    else if (cleared) out[challenge.id] = 'cleared'
    else if (previousCleared) out[challenge.id] = 'available'
    else out[challenge.id] = 'locked'
    // Deliberately the *cleared* flag and not "state !== locked": an available
    // challenge you have not cleared must not open the one after it, or the lock
    // would cascade the moment anything unlocked.
    previousCleared = cleared
  }

  return out
}

export function isUnlocked(tiers: TiersByChallenge, id: string): boolean {
  return unlockStates(tiers)[id] !== 'locked'
}

/** Where the learner is: the first open, uncleared challenge, else the last one they can reach. */
export function nextChallengeId(tiers: TiersByChallenge): string | null {
  const states = unlockStates(tiers)
  const open = ALL_CHALLENGES.find((c) => states[c.id] === 'available')
  if (open) return open.id
  // Everything reachable is cleared — point at the last one rather than nothing,
  // so the map always has a "you are here".
  const last = [...ALL_CHALLENGES].reverse().find((c) => states[c.id] !== 'locked')
  return last?.id ?? null
}

/**
 * Challenges that opened between two snapshots. Drives the map animation and
 * the unlock sound.
 *
 * Modelled on `newlyMastered` in lib/path/progress.ts — a crossing, not a state.
 * Comparing snapshots rather than trusting the score response matters because
 * tiers are cumulative: one submission can clear a challenge *and* perfect it,
 * and the learner should hear about the opening once.
 */
export function newlyUnlocked(before: TiersByChallenge, after: TiersByChallenge): string[] {
  const was = unlockStates(before)
  const now = unlockStates(after)
  return ALL_CHALLENGES.filter((c) => was[c.id] === 'locked' && now[c.id] !== 'locked').map((c) => c.id)
}

/**
 * Is this the last challenge of its topic — the one that opens the next topic?
 *
 * Derived from catalog order rather than a flag on the challenge, so it cannot
 * disagree with PIXEL_TOPICS.
 */
export function isMilestone(id: string): boolean {
  const index = ALL_CHALLENGES.findIndex((c) => c.id === id)
  if (index === -1) return false
  const next = ALL_CHALLENGES[index + 1]
  return next !== undefined && next.topicId !== ALL_CHALLENGES[index].topicId
}

/** The topic a milestone opens, or null if it opens nothing (the last challenge). */
export function topicOpenedBy(id: string): TopicId | null {
  const index = ALL_CHALLENGES.findIndex((c) => c.id === id)
  if (index === -1) return null
  const next = ALL_CHALLENGES[index + 1]
  return next && next.topicId !== ALL_CHALLENGES[index].topicId ? next.topicId : null
}

/** Did this unlock cross a topic boundary? The cue for the louder sound. */
export function crossedMilestone(unlocked: string[]): TopicId | null {
  for (const id of unlocked) {
    const challenge = ALL_CHALLENGES.find((c) => c.id === id)
    if (!challenge) continue
    const index = ALL_CHALLENGES.indexOf(challenge)
    const previous = ALL_CHALLENGES[index - 1]
    if (previous && previous.topicId !== challenge.topicId) return challenge.topicId
  }
  return null
}

export function challengeAt(index: number): PixelChallenge | undefined {
  return ALL_CHALLENGES[index]
}
