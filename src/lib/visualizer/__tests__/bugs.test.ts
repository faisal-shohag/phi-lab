// Bug Hunt's safety net. Two assertions carry the whole feature:
//
//   1. Every `fixed` program prints exactly its expected lines, on both engines.
//      Without this, a typo in the key makes a level unsolvable and the learner
//      just fails forever against a wrong string.
//   2. Every `buggyCode` does NOT. A "bug hunt" level whose code already passes
//      is a level with no bug in it.
//
// The rest is catalog integrity.

import { describe, it, expect } from 'vitest'
import { BUG_LEVELS, TOTAL_BUGS, bugById } from '../bugs'
import { BUG_ANSWERS } from '../bugs-expected'
import { matchesExpected } from '../problems-run'
import { TOPIC_IDS } from '../problems'
import { bugFixXp } from '../../gamification/reasons'
import { interpret } from '../interpreter'
import { traceQjs } from '../trace-qjs'

const ids = BUG_LEVELS.map((b) => [b.id] as const)

function outputOf(steps: { kind: string; output?: string }[]): string[] {
  return steps.filter((s) => s.kind === 'output' && typeof s.output === 'string').map((s) => s.output as string)
}

function legacyOutput(code: string): string[] {
  const trace = interpret(code, { maxSteps: 5000 })
  expect(trace.truncated).toBeFalsy()
  return outputOf(trace.steps)
}

async function qjsOutput(code: string): Promise<string[]> {
  const { trace, error } = await traceQjs(code)
  expect(error ?? null).toBeNull()
  expect(trace?.truncated).toBeFalsy()
  return outputOf(trace?.steps ?? [])
}

/** Run something that is EXPECTED to misbehave: never throws, may return null. */
function tryLegacy(code: string): string[] | null {
  try {
    const trace = interpret(code, { maxSteps: 5000 })
    if (trace.truncated) return null // an endless loop is a legitimate bug
    return outputOf(trace.steps)
  } catch {
    return null // so is a crash
  }
}

describe('bug catalog integrity', () => {
  it('has unique, stably-prefixed ids', () => {
    const all = BUG_LEVELS.map((b) => b.id)
    expect(new Set(all).size).toBe(all.length)
    for (const id of all) expect(id, id).toMatch(/^bug-\d\d$/)
  })

  it('tags every level with a real topic and a known difficulty', () => {
    for (const b of BUG_LEVELS) {
      expect(TOPIC_IDS as readonly string[], b.id).toContain(b.topicId)
      expect([1, 2, 3], b.id).toContain(b.difficulty)
    }
  })

  it('gives every level a symptom, a goal, code and an answer', () => {
    for (const b of BUG_LEVELS) {
      expect(b.symptom.length, `${b.id} symptom`).toBeGreaterThan(0)
      expect(b.goal.length, `${b.id} goal`).toBeGreaterThan(0)
      expect(b.buggyCode.length, `${b.id} buggyCode`).toBeGreaterThan(0)
      expect(BUG_ANSWERS[b.id], `${b.id} answer`).toBeDefined()
      expect(BUG_ANSWERS[b.id].expected.length, `${b.id} expected`).toBeGreaterThan(0)
    }
  })

  it('has no answers for levels that no longer exist', () => {
    for (const id of Object.keys(BUG_ANSWERS)) expect(bugById(id), `orphan answer ${id}`).toBeDefined()
  })

  it('spreads the levels across difficulties and prices each one', () => {
    for (const d of [1, 2, 3] as const) {
      expect(BUG_LEVELS.some((b) => b.difficulty === d), `no difficulty ${d} level`).toBe(true)
      expect(bugFixXp(d), `xp for difficulty ${d}`).toBeGreaterThan(0)
    }
    expect(TOTAL_BUGS).toBe(BUG_LEVELS.length)
  })
})

describe('every level is actually broken', () => {
  it.each(ids)('%s buggy code does not already pass', (id) => {
    const out = tryLegacy(bugById(id)!.buggyCode)
    if (out === null) return // it hangs or throws — broken enough
    expect(matchesExpected(out, BUG_ANSWERS[id].expected), `${id} has no bug in it`).toBe(false)
  })
})

describe('every fix produces the expected output', () => {
  it.each(ids)('%s — legacy interpreter', (id) => {
    expect(legacyOutput(BUG_ANSWERS[id].fixed)).toEqual(BUG_ANSWERS[id].expected)
  })

  it.each(ids)('%s — real engine (QuickJS)', async (id) => {
    expect(await qjsOutput(BUG_ANSWERS[id].fixed)).toEqual(BUG_ANSWERS[id].expected)
  })
})

describe('requires guard', () => {
  it('never rejects a correct fix', () => {
    for (const b of BUG_LEVELS) {
      for (const needle of b.requires ?? []) {
        expect(BUG_ANSWERS[b.id].fixed, `${b.id} requires "${needle}"`).toContain(needle)
      }
    }
  })
})
