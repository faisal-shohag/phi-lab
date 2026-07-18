import { describe, expect, it } from 'vitest'
import { pathEta, remainingMinutes } from './route'
import { goalNodes } from './goals'
import type { NodeProgress, NodeState } from './types'

// Build a NodeProgress list where the named nodes are mastered and the rest sit
// available — enough for the pure arithmetic under test.
function nodesWith(masteredIds: string[]): NodeProgress[] {
  const mastered = new Set(masteredIds)
  return goalNodes('FULLSTACK').map((n) => ({
    nodeId: n.id,
    state: (mastered.has(n.id) ? 'mastered' : 'available') as NodeState,
    steps: [],
    doneCount: 0,
    requiredCount: 0,
    struggling: false,
  }))
}

const allIds = goalNodes('FULLSTACK').map((n) => n.id)

describe('route — remaining work', () => {
  it('is zero when every node on the road is mastered', () => {
    expect(remainingMinutes(nodesWith(allIds), 'FULLSTACK')).toBe(0)
  })

  it('shrinks as more nodes are mastered', () => {
    const none = remainingMinutes(nodesWith([]), 'FULLSTACK')
    const some = remainingMinutes(nodesWith(['conditionals', 'loops']), 'FULLSTACK')
    expect(some).toBeLessThan(none)
  })

  it('a narrower goal has no more work than a wider one', () => {
    expect(remainingMinutes(nodesWith([]), 'FRONTEND'))
      .toBeLessThanOrEqual(remainingMinutes(nodesWith([]), 'FULLSTACK'))
  })
})

describe('route — ETA', () => {
  const now = new Date('2026-07-18T00:00:00Z')

  it('reports arrived with zero weeks when the road is complete', () => {
    const eta = pathEta(nodesWith(allIds), 6, 'FULLSTACK', now)
    expect(eta.arrived).toBe(true)
    expect(eta.weeks).toBe(0)
    expect(eta.targetDate).toBe('2026-07-18')
  })

  it('projects the target date weeks*7 days out', () => {
    const eta = pathEta(nodesWith([]), 6, 'FULLSTACK', now)
    expect(eta.arrived).toBe(false)
    expect(eta.weeks).toBeGreaterThan(0)
    const expected = new Date(now)
    expected.setUTCDate(expected.getUTCDate() + eta.weeks * 7)
    expect(eta.targetDate).toBe(expected.toISOString().slice(0, 10))
  })

  it('more hours per week never means a later date', () => {
    const slow = pathEta(nodesWith([]), 3, 'FULLSTACK', now).weeks
    const fast = pathEta(nodesWith([]), 12, 'FULLSTACK', now).weeks
    expect(fast).toBeLessThanOrEqual(slow)
  })

  it('guards a zero/negative pace instead of dividing by zero', () => {
    const eta = pathEta(nodesWith([]), 0, 'FULLSTACK', now)
    expect(Number.isFinite(eta.weeks)).toBe(true)
    expect(eta.weeks).toBeGreaterThan(0)
  })
})
