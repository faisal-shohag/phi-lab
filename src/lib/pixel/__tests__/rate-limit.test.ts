import { beforeEach, describe, expect, it } from 'vitest'

import { resetRateLimits, takeRenderToken } from '../rate-limit'

// The bucket is process-global by design (see rate-limit.ts), so a test that
// skips this inherits the previous one's tokens.
beforeEach(resetRateLimits)

const T0 = 1_700_000_000_000

describe('takeRenderToken', () => {
  it('lets a burst through, then stops', () => {
    for (let i = 0; i < 12; i++) {
      expect(takeRenderToken('u', T0).ok, `render ${i + 1} of the burst`).toBe(true)
    }
    expect(takeRenderToken('u', T0).ok).toBe(false)
  })

  it('tells a blocked user when to come back rather than just refusing', () => {
    for (let i = 0; i < 12; i++) takeRenderToken('u', T0)
    const denied = takeRenderToken('u', T0)
    expect(denied.ok).toBe(false)
    expect(denied.retryAfter).toBeGreaterThan(0)
    // A twelfth of the five-minute window: 25s.
    expect(denied.retryAfter).toBeLessThanOrEqual(25)
  })

  it('refills over time, so waiting the stated time actually works', () => {
    for (let i = 0; i < 12; i++) takeRenderToken('u', T0)
    const { retryAfter } = takeRenderToken('u', T0)
    expect(takeRenderToken('u', T0 + retryAfter * 1000).ok).toBe(true)
  })

  it('sustains a score every 25 seconds indefinitely', () => {
    for (let i = 0; i < 40; i++) {
      expect(takeRenderToken('u', T0 + i * 25_000).ok, `sustained render ${i + 1}`).toBe(true)
    }
  })

  it('does not refill past the burst size, so idling does not bank renders', () => {
    takeRenderToken('u', T0)
    // A day later: still only a burst, not 288 of them.
    for (let i = 0; i < 12; i++) expect(takeRenderToken('u', T0 + 86_400_000).ok).toBe(true)
    expect(takeRenderToken('u', T0 + 86_400_000).ok).toBe(false)
  })

  it('meters each user separately — one learner cannot spend another’s budget', () => {
    for (let i = 0; i < 12; i++) takeRenderToken('a', T0)
    expect(takeRenderToken('a', T0).ok).toBe(false)
    expect(takeRenderToken('b', T0).ok).toBe(true)
  })

  it('forgets users who have gone quiet rather than growing forever', () => {
    for (let i = 0; i < 600; i++) takeRenderToken(`user-${i}`, T0)
    // Past the window, so every one of those buckets is full and forgettable.
    // A dropped bucket is indistinguishable from a full one, so this is free.
    expect(takeRenderToken('user-0', T0 + 10 * 60_000).ok).toBe(true)
  })
})
