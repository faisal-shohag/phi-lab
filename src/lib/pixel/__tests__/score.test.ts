import { describe, expect, it } from 'vitest'

import {
  PERFECT_AT,
  TIERS,
  TIER_REASON,
  nextTierAt,
  parseSourceId,
  scoreFrom,
  sourceIdFor,
  tiersFor,
  xpFor,
} from '../score'

// The two bugs this function exists to kill, in the numbers that exposed them.
describe('scoreFrom', () => {
  // hero-04 is 2.08% ink: a blank canvas matches 98.9% of the target, and was
  // paid Standing and Close for it on every sparse challenge in the lab.
  it('scores an empty editor zero — every pixel that was drawn is the target’s', () => {
    const targetInk = 6_979
    expect(scoreFrom(targetInk, targetInk)).toBe(0)
  })

  it('scores a perfect match one', () => {
    expect(scoreFrom(0, 6_979)).toBe(1)
    expect(scoreFrom(0, 1_270_000)).toBe(1)
  })

  // The bug the first fix had: "distance from blank" clamped anything that
  // painted pixels the target lacks to 0, so a learner whose box was too big sat
  // at 0% however they tweaked it. Union scoring has no floor to fall through.
  it('gives partial credit to a build that overshoots, so there is a gradient to climb', () => {
    // Target box of 24,000px, learner's box 40,000px containing it: the 16,000px
    // of overspill is wrong, the rest is right.
    expect(scoreFrom(16_000, 40_000)).toBeCloseTo(0.6, 6)
  })

  it('rewards partial overlap rather than calling a real attempt nothing', () => {
    // The screenshot that started this: 41,794 of 120,000 pixels off on a
    // 400x300 brief. Under the old rule this was 0%. It is not 0% of anything.
    expect(scoreFrom(41_794, 60_000)).toBeGreaterThan(0.3)
  })

  it('scores a build with no overlap at all zero', () => {
    // Everything either side drew is wrong. Nothing to reward, and nothing
    // dishonest about saying so.
    expect(scoreFrom(50_000, 50_000)).toBe(0)
  })

  it('makes one bar mean the same thing on a sparse canvas as a dense one', () => {
    // The point of the exercise: identical work, identical score, wildly
    // different ink.
    expect(scoreFrom(1_000, 5_000)).toBeCloseTo(0.8, 6)
    expect(scoreFrom(240_000, 1_200_000)).toBeCloseTo(0.8, 6)
  })

  // On a full-bleed canvas every pixel is ink, so union === total and the score
  // is the plain match. The metric does not invent a second reality for the
  // challenges where the obvious number already worked.
  it('degrades into the raw match when the whole canvas is painted', () => {
    const total = 92_160
    expect(scoreFrom(9_216, total)).toBeCloseTo(1 - 9_216 / total, 6)
  })

  it('scores an untouched canvas zero rather than dividing by zero', () => {
    // A blank target is an authoring bug — but paying everyone full marks for it
    // would be worse.
    expect(scoreFrom(0, 0)).toBe(0)
  })
})

describe('tiersFor', () => {
  it('earns nothing below the floor', () => {
    expect(tiersFor(0)).toEqual([])
    expect(tiersFor(0.74)).toEqual([])
  })

  it('earns tiers cumulatively, so improving keeps paying', () => {
    // Not "best tier only": a learner who scrapes Standing today and comes back
    // to nail it must collect the rest then, not be told they already had theirs.
    expect(tiersFor(0.75)).toEqual(['standing'])
    expect(tiersFor(0.9)).toEqual(['standing', 'close'])
    expect(tiersFor(0.995)).toEqual(['standing', 'close', 'perfect'])
    expect(tiersFor(1)).toEqual(['standing', 'close', 'perfect'])
  })

  it('treats each bar as inclusive', () => {
    expect(tiersFor(0.7499)).toEqual([])
    expect(tiersFor(0.8999)).toEqual(['standing'])
    expect(tiersFor(0.9949)).toEqual(['standing', 'close'])
  })

  it('pays nothing at all for an empty editor', () => {
    const targetInk = 6_979
    expect(tiersFor(scoreFrom(targetInk, targetInk))).toEqual([])
  })
})

describe('nextTierAt', () => {
  it('points at the next bar up', () => {
    expect(nextTierAt(0.5)).toEqual({ tier: 'standing', at: 0.75 })
    expect(nextTierAt(0.8)).toEqual({ tier: 'close', at: 0.9 })
    expect(nextTierAt(0.95)).toEqual({ tier: 'perfect', at: PERFECT_AT })
  })

  it('has nothing to point at from the top', () => {
    expect(nextTierAt(0.995)).toBeNull()
    expect(nextTierAt(1)).toBeNull()
  })
})

describe('source ids', () => {
  it('round-trips every tier', () => {
    for (const tier of TIERS) {
      expect(parseSourceId(sourceIdFor('navbar-01', tier))).toEqual({ challengeId: 'navbar-01', tier })
    }
  })

  it('gives each tier its own key, so three rows is the ceiling', () => {
    const ids = TIERS.map((t) => sourceIdFor('hero-02', t))
    expect(new Set(ids).size).toBe(TIERS.length)
  })

  it('survives a challenge id containing a colon', () => {
    expect(parseSourceId(sourceIdFor('odd:id', 'close'))).toEqual({ challengeId: 'odd:id', tier: 'close' })
  })

  it('rejects anything that is not ours', () => {
    expect(parseSourceId('problem:cond-04')).toBeNull()
    expect(parseSourceId('pixel:navbar-01:sparkle')).toBeNull()
    expect(parseSourceId('pixel:')).toBeNull()
    expect(parseSourceId('')).toBeNull()
  })
})

describe('XP', () => {
  it('pays more the closer you get', () => {
    expect(xpFor('standing')).toBeGreaterThan(0)
    expect(xpFor('close')).toBeGreaterThan(xpFor('standing'))
    expect(xpFor('perfect')).toBeGreaterThan(xpFor('close'))
  })

  it('gives each tier a distinct ledger reason', () => {
    expect(new Set(Object.values(TIER_REASON)).size).toBe(TIERS.length)
  })
})
