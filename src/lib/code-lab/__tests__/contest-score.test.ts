import { describe, it, expect } from 'vitest'
import { rankContest, type AcceptedSubmission, type ProblemPoints } from '../contest-score'

const problems: ProblemPoints[] = [
  { problemId: 'a', points: 100 },
  { problemId: 'b', points: 200 },
  { problemId: 'c', points: 300 },
]

function at(iso: string): Date {
  return new Date(iso)
}

describe('rankContest', () => {
  it('sums points over distinctly-solved problems', () => {
    const accepted: AcceptedSubmission[] = [
      { userId: 'u1', problemId: 'a', createdAt: at('2026-01-10T12:10:00Z') },
      { userId: 'u1', problemId: 'b', createdAt: at('2026-01-10T12:20:00Z') },
    ]
    const [row] = rankContest(problems, accepted)
    expect(row.userId).toBe('u1')
    expect(row.points).toBe(300)
    expect(row.solved).toBe(2)
  })

  it('ranks higher points first', () => {
    const accepted: AcceptedSubmission[] = [
      { userId: 'low', problemId: 'a', createdAt: at('2026-01-10T12:05:00Z') },
      { userId: 'high', problemId: 'c', createdAt: at('2026-01-10T12:30:00Z') },
    ]
    const ranked = rankContest(problems, accepted)
    expect(ranked.map((r) => r.userId)).toEqual(['high', 'low'])
  })

  it('breaks point ties by the earliest last-solve time', () => {
    const accepted: AcceptedSubmission[] = [
      // both end on 200 points total (b), but u_fast finishes earlier
      { userId: 'u_slow', problemId: 'b', createdAt: at('2026-01-10T13:00:00Z') },
      { userId: 'u_fast', problemId: 'b', createdAt: at('2026-01-10T12:30:00Z') },
    ]
    const ranked = rankContest(problems, accepted)
    expect(ranked.map((r) => r.userId)).toEqual(['u_fast', 'u_slow'])
  })

  it('ignores repeat accepts and wrong tries (first accept counts, no penalty)', () => {
    const accepted: AcceptedSubmission[] = [
      { userId: 'u1', problemId: 'a', createdAt: at('2026-01-10T12:40:00Z') },
      { userId: 'u1', problemId: 'a', createdAt: at('2026-01-10T12:10:00Z') }, // earlier, becomes the first-accept
      { userId: 'u1', problemId: 'a', createdAt: at('2026-01-10T12:50:00Z') },
    ]
    const [row] = rankContest(problems, accepted)
    expect(row.points).toBe(100)
    expect(row.solved).toBe(1)
    expect(row.lastAccept).toEqual(at('2026-01-10T12:10:00Z'))
  })

  it('excludes users with no accepted contest problems', () => {
    const accepted: AcceptedSubmission[] = [
      { userId: 'ghost', problemId: 'not-in-contest', createdAt: at('2026-01-10T12:00:00Z') },
    ]
    expect(rankContest(problems, accepted)).toEqual([])
  })

  it('returns empty when nobody solved anything', () => {
    expect(rankContest(problems, [])).toEqual([])
  })
})
