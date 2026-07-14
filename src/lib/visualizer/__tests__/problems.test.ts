// The curriculum's safety net.
//
// The load-bearing test here is "every reference solution prints exactly its
// expected lines, on both engines". Without it, a typo in the answer key makes a
// problem literally unsolvable, and nothing else in the suite would catch it —
// the learner would just fail forever against a wrong string.
//
// The rest is catalog integrity: ids unique and stable, demoIds real, every
// practice problem answerable, and the challenge gate satisfiable.

import { describe, it, expect } from 'vitest'
import {
  PROBLEM_TOPICS,
  ALL_PROBLEMS,
  TOTAL_PROBLEMS,
  CONCEPT_TO_PROBLEMS,
  CHALLENGE_GATE_PERCENT,
  CHALLENGE_GATE_TOPIC,
  problemById,
  problemCode,
} from '../problems'
import { PROBLEM_ANSWERS } from '../problems-expected'
import { matchesExpected } from '../problems-run'
import { DEMO_EXAMPLES } from '../examples'
import { VIZ_CONCEPTS } from '../../gamification/reasons'
import { interpret } from '../interpreter'
import { traceQjs } from '../trace-qjs'

const practice = ALL_PROBLEMS.filter((p) => p.kind === 'practice')
const demos = ALL_PROBLEMS.filter((p) => p.kind === 'demo')

function legacyOutput(code: string): string[] {
  const trace = interpret(code, { maxSteps: 5000 })
  expect(trace.truncated).toBeFalsy()
  return trace.steps.filter((s) => s.kind === 'output' && typeof s.output === 'string').map((s) => s.output as string)
}

async function qjsOutput(code: string): Promise<string[]> {
  const { trace, error } = await traceQjs(code)
  expect(error ?? null).toBeNull()
  expect(trace?.truncated).toBeFalsy()
  return (trace?.steps ?? []).filter((s) => s.kind === 'output' && typeof s.output === 'string').map((s) => s.output as string)
}

describe('catalog integrity', () => {
  it('has unique problem ids', () => {
    const ids = ALL_PROBLEMS.map((p) => p.id)
    expect(new Set(ids).size).toBe(ids.length)
  })

  it('gives every topic 5-10 problems', () => {
    for (const t of PROBLEM_TOPICS) {
      expect(t.problems.length, `${t.id} problem count`).toBeGreaterThanOrEqual(5)
      expect(t.problems.length, `${t.id} problem count`).toBeLessThanOrEqual(10)
    }
  })

  it('makes roughly the last 30% of each topic hands-on, and puts practice last', () => {
    for (const t of PROBLEM_TOPICS) {
      const n = t.problems.filter((p) => p.kind === 'practice').length
      expect(n, `${t.id} practice count`).toBeGreaterThanOrEqual(Math.floor(t.problems.length * 0.2))
      expect(n, `${t.id} practice count`).toBeLessThanOrEqual(Math.ceil(t.problems.length * 0.4))
      // Practice comes after the demos it builds on — watch, then do.
      const firstPractice = t.problems.findIndex((p) => p.kind === 'practice')
      const lastDemo = t.problems.map((p) => p.kind).lastIndexOf('demo')
      expect(firstPractice, `${t.id} ordering`).toBeGreaterThan(lastDemo)
    }
  })

  it('tags every problem with the topic that holds it', () => {
    for (const t of PROBLEM_TOPICS) {
      for (const p of t.problems) expect(p.topicId, p.id).toBe(t.id)
    }
  })

  it('points every demo problem at a real example with code', () => {
    for (const p of demos) {
      expect(DEMO_EXAMPLES.some((e) => e.id === p.demoId), `${p.id} -> ${p.demoId}`).toBe(true)
      expect(problemCode(p).length, p.id).toBeGreaterThan(0)
    }
  })

  it('gives every practice problem a stub, a goal and an answer', () => {
    for (const p of practice) {
      expect(p.starterCode?.length, `${p.id} starterCode`).toBeGreaterThan(0)
      expect(p.goal?.length, `${p.id} goal`).toBeGreaterThan(0)
      expect(PROBLEM_ANSWERS[p.id], `${p.id} answer`).toBeDefined()
      expect(PROBLEM_ANSWERS[p.id].expected.length, `${p.id} expected`).toBeGreaterThan(0)
    }
  })

  it('has no answers for problems that no longer exist', () => {
    for (const id of Object.keys(PROBLEM_ANSWERS)) {
      expect(problemById(id), `orphan answer ${id}`).toBeDefined()
    }
  })

  it('maps legacy concepts to real problems, using only known concept ids', () => {
    for (const [concept, ids] of Object.entries(CONCEPT_TO_PROBLEMS)) {
      expect(VIZ_CONCEPTS as readonly string[], `concept ${concept}`).toContain(concept)
      for (const id of ids) expect(problemById(id), `${concept} -> ${id}`).toBeDefined()
    }
  })
})

describe('challenge gate', () => {
  it('is reachable: the gate topic exists and the threshold is a fraction', () => {
    const topic = PROBLEM_TOPICS.find((t) => t.id === CHALLENGE_GATE_TOPIC)
    expect(topic).toBeDefined()
    expect(topic!.problems.length).toBeGreaterThan(0)
    expect(CHALLENGE_GATE_PERCENT).toBeGreaterThan(0)
    expect(CHALLENGE_GATE_PERCENT).toBeLessThanOrEqual(1)
  })

  it('needs more than the Functions topic alone to unlock', () => {
    // Otherwise the 60% rule would be decorative.
    const fnCount = PROBLEM_TOPICS.find((t) => t.id === CHALLENGE_GATE_TOPIC)!.problems.length
    expect(fnCount / TOTAL_PROBLEMS).toBeLessThan(CHALLENGE_GATE_PERCENT)
  })
})

describe('practice starters do not already pass', () => {
  // A stub that accidentally prints the right answer is a problem that teaches
  // nothing. Every starter must FAIL its own check.
  it.each(practice.map((p) => [p.id] as const))('%s starter fails', (id) => {
    const p = problemById(id)!
    let out: string[] | null = null
    try {
      out = legacyOutput(p.starterCode!)
    } catch {
      out = null // a stub that throws is fine — it's incomplete
    }
    if (out === null) return
    expect(matchesExpected(out, PROBLEM_ANSWERS[id].expected), `${id} starter must not already pass`).toBe(false)
  })
})

describe('reference solutions produce the expected output', () => {
  it.each(practice.map((p) => [p.id] as const))('%s — legacy interpreter', (id) => {
    expect(legacyOutput(PROBLEM_ANSWERS[id].solution)).toEqual(PROBLEM_ANSWERS[id].expected)
  })

  it.each(practice.map((p) => [p.id] as const))('%s — real engine (QuickJS)', async (id) => {
    expect(await qjsOutput(PROBLEM_ANSWERS[id].solution)).toEqual(PROBLEM_ANSWERS[id].expected)
  })
})

describe('requires guard', () => {
  it('is satisfied by every reference solution', () => {
    // The guard must never reject a correct answer.
    for (const p of practice) {
      for (const needle of p.requires ?? []) {
        expect(PROBLEM_ANSWERS[p.id].solution, `${p.id} requires "${needle}"`).toContain(needle)
      }
    }
  })
})
