import { describe, it, expect, afterEach } from 'vitest'
import { runFn, grade, gradeEngine } from '../grade'
import type { HiddenTest } from '../challenge'

// A regex-based solution: the legacy interpreter can't run regex (returns null),
// QuickJS can — so the same program cleanly proves which engine the flag picks.
const REGEX_FN = 'function solve(s){ return (s.match(/\\d+/g) || []).length }'

afterEach(() => {
  delete process.env.VIZ_GRADE_ENGINE
})

describe('grade dispatcher flag', () => {
  it('defaults to the legacy engine when unset', () => {
    delete process.env.VIZ_GRADE_ENGINE
    expect(gradeEngine()).toBe('legacy')
  })

  it('VIZ_GRADE_ENGINE=quickjs selects quickjs', () => {
    process.env.VIZ_GRADE_ENGINE = 'quickjs'
    expect(gradeEngine()).toBe('quickjs')
  })

  it('legacy engine cannot run regex → null; quickjs can', async () => {
    delete process.env.VIZ_GRADE_ENGINE
    expect(await runFn(REGEX_FN, 'solve', ['a1b22c'])).toBeNull()

    process.env.VIZ_GRADE_ENGINE = 'quickjs'
    expect(await runFn(REGEX_FN, 'solve', ['a1b22c'])).toBe('2')
  })

  it('grade() honors the flag too', async () => {
    const tests: HiddenTest[] = [{ args: ['a1b22c'], expected: '2' }]
    process.env.VIZ_GRADE_ENGINE = 'quickjs'
    expect((await grade(REGEX_FN, 'solve', tests)).allPass).toBe(true)

    delete process.env.VIZ_GRADE_ENGINE
    expect((await grade(REGEX_FN, 'solve', tests)).allPass).toBe(false)
  })
})
