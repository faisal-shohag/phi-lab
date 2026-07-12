// The folding is the whole point of this module: the overview's gradedLab()
// counts only COMPLETED and FAILED by name and silently swallows everything else,
// which is exactly how ABANDONED and IN_PROGRESS became invisible. These pin the
// cases it drops.
import { describe, expect, it, vi } from 'vitest'

vi.mock('@/lib/prisma', () => ({ prisma: {} }))

import { foldStatuses } from './labs'

const GRADED = {
  completed: 'COMPLETED',
  failed: 'FAILED',
  abandoned: 'ABANDONED',
  inProgress: ['IN_PROGRESS'],
}

const rows = (counts: Record<string, number>) =>
  Object.entries(counts).map(([status, n]) => ({ status, _count: { _all: n } }))

describe('foldStatuses', () => {
  it('surfaces the statuses the overview card drops', () => {
    const usage = foldStatuses(
      'Interview',
      rows({ COMPLETED: 6, FAILED: 1, ABANDONED: 2, IN_PROGRESS: 1 }),
      GRADED,
    )

    expect(usage.abandoned).toBe(2) // invisible on the overview today
    expect(usage.inProgress).toBe(1) // likewise
    expect(usage.sessions).toBe(10)
    // Every session is accounted for — nothing vanishes into the total.
    expect(usage.completed + usage.failed + usage.abandoned + usage.inProgress).toBe(usage.sessions)
  })

  it('rates are against every session, not just the graded ones', () => {
    const usage = foldStatuses('Interview', rows({ COMPLETED: 5, ABANDONED: 5 }), GRADED)
    expect(usage.completionRate).toBe(50)
    expect(usage.abandonRate).toBe(50)
  })

  it('does not divide by zero on an empty lab', () => {
    const usage = foldStatuses('English', [], GRADED)
    expect(usage.sessions).toBe(0)
    expect(usage.completionRate).toBe(0)
    expect(usage.abandonRate).toBe(0)
    expect(usage.avgScore).toBeNull()
    expect(usage.avgDurationMs).toBeNull()
  })

  it('counts both of Support live states as in progress', () => {
    // A learner holding a queue slot is as "in the lab" as one in the call — and
    // both block the next person, which is what an operator is watching for.
    const usage = foldStatuses(
      'Support',
      rows({ completed: 3, abandoned: 1, active: 2, waiting: 4 }),
      { completed: 'completed', failed: 'failed', abandoned: 'abandoned', inProgress: ['active', 'waiting'] },
    )
    expect(usage.inProgress).toBe(6)
    expect(usage.failed).toBe(0) // Support has no 'failed' state; absent, not NaN
    expect(usage.sessions).toBe(10)
  })

  it('carries score and duration through when supplied', () => {
    const usage = foldStatuses('Feynman', rows({ COMPLETED: 1 }), GRADED, {
      avgScore: 72.5,
      avgDurationMs: 165_000,
    })
    expect(usage.avgScore).toBe(72.5)
    expect(usage.avgDurationMs).toBe(165_000)
  })
})
