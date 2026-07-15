// The pure rules of Challenge Mode. Grading used to be tested here too, back
// when it ran on the legacy interpreter out of this module; it now lives on the
// QuickJS sandbox and is covered one-for-one by `grade-qjs.test.ts` — including
// the load-bearing "cannot be beaten by hardcoding one output".
import { describe, it, expect } from 'vitest'
import {
  reward, streakMultiplier,
  rescuableFor, isAbandoned, RESCUE_GRACE_MS,
  type RescueState,
} from '../challenge'

describe('reward', () => {
  const S = 50
  it('one-shot pays 2S', () => {
    expect(reward('oneshot', S, 1, 0)).toBe(100)
  })
  it('retries: first-try win = 2S, decays with fails', () => {
    expect(reward('retries', S, 1, 0)).toBe(100) // S + S
    expect(reward('retries', S, 3, 0)).toBe(80) // S + 0.6S
    expect(reward('retries', S, 999, 0)).toBe(S) // bonus floored at 0
  })
  it('timed: 2S + up to 0.5S time bonus', () => {
    expect(reward('timed', S, 1, 1)).toBe(125)
    expect(reward('timed', S, 1, 0)).toBe(100)
  })
})

describe('streakMultiplier', () => {
  it('scales with consecutive wins', () => {
    expect(streakMultiplier(1)).toBe(1)
    expect(streakMultiplier(2)).toBe(1.25)
    expect(streakMultiplier(3)).toBe(1.5)
    expect(streakMultiplier(4)).toBe(1.5)
    expect(streakMultiplier(5)).toBe(2)
    expect(streakMultiplier(12)).toBe(2)
  })
  it('applies on top of the base reward', () => {
    // Hard one-shot base = 200; a 5-win streak doubles it.
    expect(Math.round(reward('oneshot', 100, 1, 0) * streakMultiplier(5))).toBe(400)
  })
})

// The rescue rules decide whether a refresh costs someone their stake, so they
// are worth pinning down precisely.
const NOW = 1_700_000_000_000

function blitz(over: Partial<RescueState> = {}): RescueState {
  return {
    mode: 'timed',
    status: 'active',
    attemptsUsed: 0,
    maxAttempts: 3,
    expiresAt: new Date(NOW + 60_000), // a minute left
    ...over,
  }
}

describe('rescuableFor', () => {
  it('leaves a healthy Blitz round alone', () => {
    expect(rescuableFor(blitz(), NOW)).toBeNull()
  })

  it('offers time once the clock has run out', () => {
    expect(rescuableFor(blitz({ expiresAt: new Date(NOW - 1) }), NOW)).toBe('time')
  })

  it('offers a life when tries are gone but the clock is not', () => {
    expect(rescuableFor(blitz({ attemptsUsed: 3 }), NOW)).toBe('life')
  })

  it('prefers time over a life when both have run out', () => {
    // Buying a life on a dead clock would be XP for nothing — the resume route
    // rejects it (EXPIRED), so the offer must be the clock.
    const dead = blitz({ attemptsUsed: 3, expiresAt: new Date(NOW - 1) })
    expect(rescuableFor(dead, NOW)).toBe('time')
  })

  it('never fires outside an active Blitz round', () => {
    expect(rescuableFor(blitz({ mode: 'oneshot', expiresAt: null }), NOW)).toBeNull()
    expect(rescuableFor(blitz({ mode: 'retries', expiresAt: null }), NOW)).toBeNull()
    expect(rescuableFor(blitz({ status: 'lost', expiresAt: new Date(NOW - 1) }), NOW)).toBeNull()
    expect(rescuableFor(blitz({ status: 'won', attemptsUsed: 3 }), NOW)).toBeNull()
  })
})

describe('isAbandoned', () => {
  it('keeps a fresh rescue offer open — a refresh must not forfeit the round', () => {
    const justExpired = blitz({ expiresAt: new Date(NOW - 1000) })
    expect(isAbandoned(justExpired, NOW)).toBe(false)
  })

  it('holds the offer for the whole grace window, then writes it off', () => {
    const expiry = new Date(NOW - RESCUE_GRACE_MS)
    expect(isAbandoned({ ...blitz(), expiresAt: expiry }, NOW)).toBe(false)
    expect(isAbandoned({ ...blitz(), expiresAt: expiry }, NOW + 1)).toBe(true)
  })

  it('never writes off a round with no clock, however old', () => {
    // Retries rounds have no deadline; they end when the learner ends them.
    expect(isAbandoned(blitz({ mode: 'retries', expiresAt: null }), NOW + RESCUE_GRACE_MS * 100)).toBe(false)
  })

  it('ignores rounds that are already finished', () => {
    const old = blitz({ status: 'lost', expiresAt: new Date(NOW - RESCUE_GRACE_MS * 2) })
    expect(isAbandoned(old, NOW)).toBe(false)
  })
})
