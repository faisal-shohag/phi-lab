import { describe, it, expect } from 'vitest'
import { gradeAll, computeExpected, type GradeInput } from '../grade-qjs'
import { toRunnableJs } from '../transpile'
import type { ProblemTests } from '../types'

const sumTests: ProblemTests = {
  cases: [
    { id: 't1', hidden: false, args: [[1, 2, 3]], expected: 6 },
    { id: 't2', hidden: true, args: [[]], expected: 0 },
    { id: 't3', hidden: true, args: [[-1, 1]], expected: 0 },
  ],
}
const sumInput: GradeInput = { type: 'FUNCTION_RETURN', fnName: 'sum', tests: sumTests }

describe('gradeAll — FUNCTION_RETURN', () => {
  it('accepts a correct solution across visible + hidden', async () => {
    const code = 'function sum(a){ return a.reduce((x,y)=>x+y,0) }'
    const r = await gradeAll(code, sumInput)
    expect(r.verdict).toBe('ACCEPTED')
    expect(r.passedCount).toBe(3)
  })

  it('marks wrong answers WRONG_ANSWER and hides hidden actuals', async () => {
    const code = 'function sum(a){ return 6 }'
    const r = await gradeAll(code, sumInput)
    expect(r.verdict).toBe('WRONG_ANSWER')
    expect(r.passedCount).toBe(1)
    const hidden = r.results.filter((x) => x.hidden)
    expect(hidden.every((x) => x.actual === undefined)).toBe(true)
  })

  it('reports RUNTIME_ERROR on a throw', async () => {
    const code = 'function sum(a){ throw new Error("boom") }'
    const r = await gradeAll(code, sumInput)
    expect(r.verdict).toBe('RUNTIME_ERROR')
  })

  it('reports TIME_LIMIT on an infinite loop', async () => {
    const code = 'function sum(a){ while(true){} }'
    const r = await gradeAll(code, sumInput)
    expect(r.verdict).toBe('TIME_LIMIT')
  })

  it('grades a transpiled TypeScript solution', async () => {
    const ts = 'function sum(a: number[]): number { return a.reduce((x, y) => x + y, 0) }'
    const r = await gradeAll(toRunnableJs(ts, 'TYPESCRIPT'), sumInput)
    expect(r.verdict).toBe('ACCEPTED')
  })
})

describe('gradeAll — CONSOLE_OUTPUT', () => {
  const tests: ProblemTests = {
    cases: [{ id: 't1', hidden: false, args: [3], expectedStdout: '1\n2\nFizz' }],
  }
  const input: GradeInput = { type: 'CONSOLE_OUTPUT', fnName: 'run', tests }

  it('compares captured stdout', async () => {
    const code = 'function run(n){ for(let i=1;i<=n;i++) console.log(i%3===0?"Fizz":String(i)) }'
    const r = await gradeAll(code, input)
    expect(r.verdict).toBe('ACCEPTED')
  })
})

describe('computeExpected', () => {
  it('fills expected from the reference solution', async () => {
    const stripped: ProblemTests = {
      cases: sumTests.cases.map((c) => ({ id: c.id, hidden: c.hidden, args: c.args })),
    }
    const solution = 'function sum(a){ return a.reduce((x,y)=>x+y,0) }'
    const filled = await computeExpected(solution, { ...sumInput, tests: stripped })
    expect(filled).not.toBeNull()
    expect(filled!.cases[0].expected).toBe(6)
  })

  it('returns null when the solution throws', async () => {
    const bad = 'function sum(a){ throw new Error("x") }'
    const filled = await computeExpected(bad, sumInput)
    expect(filled).toBeNull()
  })
})
