import { describe, it, expect } from 'vitest'
import { runFn, grade, computeExpected, reward, streakMultiplier, type HiddenTest } from '../challenge'

const SUM = 'function solve(n){ let t=0; for(let i=1;i<=n;i++) t+=i; return t }'

describe('runFn', () => {
  it('calls the function and returns its JSON result', () => {
    expect(runFn(SUM, 'solve', [5])).toBe('15')
    expect(runFn(SUM, 'solve', [100])).toBe('5050')
  })
  it('returns null when the function is not defined', () => {
    expect(runFn('const x = 1', 'solve', [5])).toBeNull()
  })
  it('returns null on an infinite loop (step cap)', () => {
    expect(runFn('function solve(n){ while(true){} }', 'solve', [1])).toBeNull()
  })
  it('ignores the learner\'s own console.log noise', () => {
    expect(runFn('function solve(n){ console.log("debug"); return n*2 }', 'solve', [3])).toBe('6')
  })
})

describe('grade', () => {
  const tests: HiddenTest[] = [
    { args: [1], expected: '1' },
    { args: [3], expected: '6' },
    { args: [5], expected: '15' },
  ]
  it('passes a correct solution', () => {
    expect(grade(SUM, 'solve', tests)).toEqual({ passed: 3, total: 3, allPass: true })
  })
  it('fails a wrong solution', () => {
    const wrong = 'function solve(n){ return n }'
    const r = grade(wrong, 'solve', tests)
    expect(r.allPass).toBe(false)
    expect(r.passed).toBe(1) // only solve(1)=1 matches
  })
  it('cannot be beaten by hardcoding one output', () => {
    const cheat = 'function solve(n){ return 15 }'
    expect(grade(cheat, 'solve', tests).allPass).toBe(false)
  })
})

describe('computeExpected', () => {
  it('derives expected outputs from a reference solution', () => {
    const out = computeExpected(SUM, 'solve', [[1], [4]])
    expect(out).toEqual([{ args: [1], expected: '1' }, { args: [4], expected: '10' }])
  })
  it('returns null if the reference does not run', () => {
    expect(computeExpected('const x=1', 'solve', [[1]])).toBeNull()
  })
})

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
