import { describe, it, expect } from 'vitest'
import { runFnQjs, gradeQjs, computeExpectedQjs } from '../grade-qjs'
import type { HiddenTest } from '../challenge'

const SUM = 'function solve(n){ let t=0; for(let i=1;i<=n;i++) t+=i; return t }'

describe('runFnQjs — the grading contract', () => {
  it('calls the function and returns its JSON result', async () => {
    expect(await runFnQjs(SUM, 'solve', [5])).toBe('15')
    expect(await runFnQjs(SUM, 'solve', [100])).toBe('5050')
  })
  it('returns null when the function is not defined', async () => {
    expect(await runFnQjs('const x = 1', 'solve', [5])).toBeNull()
  })
  it('returns null on an infinite loop (time budget)', async () => {
    expect(await runFnQjs('function solve(n){ while(true){} }', 'solve', [1])).toBeNull()
  })
  it("ignores the learner's own console.log noise", async () => {
    expect(await runFnQjs('function solve(n){ console.log("debug"); return n*2 }', 'solve', [3])).toBe('6')
  })
  it('returns null when the program throws', async () => {
    expect(await runFnQjs('function solve(n){ throw new Error("boom") }', 'solve', [1])).toBeNull()
  })
})

describe('runFnQjs — full-JS features the legacy interpreter cannot run', () => {
  it('regex', async () => {
    const code = 'function solve(s){ return (s.match(/\\d+/g) || []).length }'
    expect(await runFnQjs(code, 'solve', ['a1b22c333'])).toBe('3')
  })
  it('real throw / catch objects (instanceof + custom fields)', async () => {
    const code = 'function solve(n){ try { throw new RangeError("x") } catch (e) { return e instanceof RangeError } }'
    expect(await runFnQjs(code, 'solve', [1])).toBe('true')
    const code2 = 'function solve(n){ try { throw { code: 7 } } catch (e) { return e.code } }'
    expect(await runFnQjs(code2, 'solve', [1])).toBe('7')
  })
  it('generators', async () => {
    const code = 'function solve(n){ function* g(){ yield 1; yield 2; yield 3 } return [...g()].reduce((a,b)=>a+b,0) }'
    expect(await runFnQjs(code, 'solve', [1])).toBe('6')
  })
  it('classes + Map/Set + Date', async () => {
    expect(await runFnQjs('function solve(a){ return new Set(a).size }', 'solve', [[1, 1, 2, 3, 3]])).toBe('3')
    expect(await runFnQjs('function solve(n){ return typeof new Date(0).toISOString() }', 'solve', [1])).toBe('"string"')
  })
})

describe('runFnQjs — determinism', () => {
  it('Math.random and Date.now are seeded so grading is reproducible', async () => {
    expect(await runFnQjs('function solve(n){ return Math.random() }', 'solve', [1])).toBe('0.5')
    expect(await runFnQjs('function solve(n){ return Date.now() }', 'solve', [1])).toBe('0')
  })
})

describe('gradeQjs', () => {
  const tests: HiddenTest[] = [
    { args: [1], expected: '1' },
    { args: [3], expected: '6' },
    { args: [5], expected: '15' },
  ]
  it('passes a correct solution', async () => {
    expect(await gradeQjs(SUM, 'solve', tests)).toEqual({ passed: 3, total: 3, allPass: true })
  })
  it('fails a wrong solution', async () => {
    const r = await gradeQjs('function solve(n){ return n }', 'solve', tests)
    expect(r.allPass).toBe(false)
    expect(r.passed).toBe(1)
  })
  it('cannot be beaten by hardcoding one output', async () => {
    expect((await gradeQjs('function solve(n){ return 15 }', 'solve', tests)).allPass).toBe(false)
  })
})

describe('computeExpectedQjs', () => {
  it('derives expected outputs from a reference solution', async () => {
    const out = await computeExpectedQjs(SUM, 'solve', [[1], [4]])
    expect(out).toEqual([{ args: [1], expected: '1' }, { args: [4], expected: '10' }])
  })
  it('returns null if the reference does not run', async () => {
    expect(await computeExpectedQjs('const x=1', 'solve', [[1]])).toBeNull()
  })
})
