import { describe, it, expect } from 'vitest'
import { gradeCase } from '../run-core'
import type { VisibleCase } from '../types'

describe('gradeCase — FUNCTION_RETURN', () => {
  const code = 'function add(a, b) { return a + b }'
  const input = { type: 'FUNCTION_RETURN' as const, fnName: 'add', codeJs: code }

  it('passes on correct return', () => {
    const c: VisibleCase = { id: 't1', args: [2, 3], expected: 5 }
    expect(gradeCase(input, c).status).toBe('pass')
  })

  it('fails on wrong return', () => {
    const c: VisibleCase = { id: 't1', args: [2, 3], expected: 6 }
    const r = gradeCase(input, c)
    expect(r.status).toBe('fail')
    expect(r.actual).toBe('5')
  })

  it('deep-compares objects regardless of key order', () => {
    const obj = { type: 'FUNCTION_RETURN' as const, fnName: 'make', codeJs: 'function make() { return { b: 2, a: 1 } }' }
    const c: VisibleCase = { id: 't1', args: [], expected: { a: 1, b: 2 } }
    expect(gradeCase(obj, c).status).toBe('pass')
  })

  it('reports a runtime error', () => {
    const bad = { type: 'FUNCTION_RETURN' as const, fnName: 'boom', codeJs: 'function boom() { throw new Error("nope") }' }
    const r = gradeCase(bad, { id: 't1', args: [], expected: 1 })
    expect(r.status).toBe('error')
    expect(r.error).toContain('nope')
  })

  it('errors when the function is missing', () => {
    const r = gradeCase({ type: 'FUNCTION_RETURN', fnName: 'add', codeJs: 'const x = 1' }, { id: 't1', args: [], expected: 1 })
    expect(r.status).toBe('error')
  })
})

describe('gradeCase — CONSOLE_OUTPUT', () => {
  it('compares captured stdout for a program', () => {
    const input = { type: 'CONSOLE_OUTPUT' as const, fnName: null, codeJs: 'console.log("1\\n2\\n3".split("\\n").join("\\n"))' }
    const c: VisibleCase = { id: 't1', expectedStdout: '1\n2\n3' }
    expect(gradeCase(input, c).status).toBe('pass')
  })

  it('compares stdout for a fn-driven console problem', () => {
    const input = { type: 'CONSOLE_OUTPUT' as const, fnName: 'fizz', codeJs: 'function fizz(n){ for(let i=1;i<=n;i++) console.log(i) }' }
    const c: VisibleCase = { id: 't1', args: [3], expectedStdout: '1\n2\n3' }
    expect(gradeCase(input, c).status).toBe('pass')
  })

  it('fails on wrong output', () => {
    const input = { type: 'CONSOLE_OUTPUT' as const, fnName: null, codeJs: 'console.log("wrong")' }
    expect(gradeCase(input, { id: 't1', expectedStdout: 'right' }).status).toBe('fail')
  })
})
