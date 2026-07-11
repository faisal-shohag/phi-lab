// Pure, dependency-clean core for Challenge Mode. Runs the learner's (and the
// AI reference) code through the teaching interpreter to grade a submission
// against hidden tests. No DB, no network — importable from routes and tests.

import { interpret } from './interpreter'

export type Difficulty = 'easy' | 'medium' | 'hard'
export type Mode = 'oneshot' | 'retries' | 'timed'

// Flat XP cost for one helper-AI use (Step Tutor / Story / Complexity / Harder-one).
export const AI_CHARGE = 30

export const DIFFICULTY: Record<Difficulty, { stake: number; label: string }> = {
  easy: { stake: 20, label: 'Easy' },
  medium: { stake: 50, label: 'Medium' },
  hard: { stake: 100, label: 'Hard' },
}

export const MODE: Record<Mode, { maxAttempts: number; timerMs: number | null; label: string }> = {
  oneshot: { maxAttempts: 1, timerMs: null, label: 'One-shot' },
  retries: { maxAttempts: 9999, timerMs: null, label: 'Retries' },
  timed: { maxAttempts: 3, timerMs: 5 * 60_000, label: 'Timed' },
}

export function isDifficulty(v: unknown): v is Difficulty {
  return v === 'easy' || v === 'medium' || v === 'hard'
}
export function isMode(v: unknown): v is Mode {
  return v === 'oneshot' || v === 'retries' || v === 'timed'
}

// Where a challenge is drawn from: the learner's current editor code, or a set
// of topics they picked to drill.
export type ChallengeSource = 'code' | 'topics'

// The curated topic catalog for "Pick topics" mode. All stay inside the
// interpreter's supported subset. Kept here so the activate route can reject
// anything a client makes up.
export const CHALLENGE_TOPICS = [
  { id: 'arrays', label: 'Arrays' },
  { id: 'strings', label: 'Strings' },
  { id: 'loops', label: 'Loops' },
  { id: 'conditionals', label: 'Conditionals' },
  { id: 'objects', label: 'Objects' },
  { id: 'recursion', label: 'Recursion' },
  { id: 'sorting', label: 'Sorting' },
  { id: 'searching', label: 'Searching' },
  { id: 'math', label: 'Math' },
  { id: 'closures', label: 'Closures' },
  { id: 'mapset', label: 'Map / Set' },
  { id: 'oop', label: 'Classes / OOP' },
] as const

export type ChallengeTopic = (typeof CHALLENGE_TOPICS)[number]['id']

export function isTopic(v: unknown): v is ChallengeTopic {
  return typeof v === 'string' && CHALLENGE_TOPICS.some((t) => t.id === v)
}

export function topicLabel(id: ChallengeTopic): string {
  return CHALLENGE_TOPICS.find((t) => t.id === id)?.label ?? id
}

export interface HiddenTest {
  args: unknown[]
  expected: string
}

// A marker prefix so we can pick OUR harness line out of the learner's own
// console.log noise.  never appears in normal output.
const SENTINEL = 'R:'

// Serialize a call argument into a JS literal the interpreter can parse. Only
// JSON-shaped values are used for challenge inputs, so JSON.stringify is enough.
function argLiteral(a: unknown): string {
  return JSON.stringify(a)
}

/**
 * Run `code`, then call `fnName(...args)` and capture what it returns (as a
 * JSON string). Returns null if the program throws, loops past the step cap, or
 * never produces the marked line (e.g. the function isn't defined).
 */
export function runFn(code: string, fnName: string, args: unknown[]): string | null {
  const callArgs = args.map(argLiteral).join(', ')
  const harness = `${code}\n;console.log(${JSON.stringify(SENTINEL)} + JSON.stringify(${fnName}(${callArgs})))`
  let trace
  try {
    trace = interpret(harness, { maxSteps: 4000 })
  } catch {
    return null
  }
  if (trace.truncated) return null
  // Last marked output wins (the harness line runs last).
  let result: string | null = null
  for (const s of trace.steps) {
    if (s.kind === 'output' && typeof s.output === 'string' && s.output.startsWith(SENTINEL)) {
      result = s.output.slice(SENTINEL.length)
    }
  }
  return result
}

export interface GradeResult {
  passed: number
  total: number
  allPass: boolean
}

/** Grade a submission: run it against every hidden test, compare to expected. */
export function grade(code: string, fnName: string, tests: HiddenTest[]): GradeResult {
  let passed = 0
  for (const t of tests) {
    const got = runFn(code, fnName, t.args)
    if (got !== null && got === t.expected) passed++
  }
  return { passed, total: tests.length, allPass: tests.length > 0 && passed === tests.length }
}

/**
 * Derive the expected output of each test input by running the AI's REFERENCE
 * solution — we never trust the model's claimed outputs. Returns null if the
 * reference itself doesn't run cleanly for every input (caller regenerates).
 */
export function computeExpected(
  referenceCode: string,
  fnName: string,
  testArgs: unknown[][],
): HiddenTest[] | null {
  const out: HiddenTest[] = []
  for (const args of testArgs) {
    const expected = runFn(referenceCode, fnName, args)
    if (expected === null) return null
    out.push({ args, expected })
  }
  return out
}

/**
 * XP credited on a win (the stake was already deducted on activate).
 *   oneshot : 2S              → net +S
 *   retries : S + S·(1−0.2·fails), floor S   → net 0…+S
 *   timed   : 2S + up to 0.5S·remainingFrac  → net +S…+1.5S
 * `attemptsUsed` counts the winning submit; `remainingFrac` in [0,1].
 */
// Consecutive-win multiplier, applied on top of the base reward. Resets to 1×
// after any loss/give-up (the streak query stops at the first non-win).
//   1 win → 1×   ·   2 → 1.25×   ·   3–4 → 1.5×   ·   5+ → 2×
export function streakMultiplier(streak: number): number {
  if (streak >= 5) return 2
  if (streak >= 3) return 1.5
  if (streak >= 2) return 1.25
  return 1
}

export function reward(mode: Mode, stake: number, attemptsUsed: number, remainingFrac: number): number {
  if (mode === 'oneshot') return stake * 2
  if (mode === 'timed') {
    const timeBonus = Math.round(0.5 * stake * Math.max(0, Math.min(1, remainingFrac)))
    return stake * 2 + timeBonus
  }
  // retries: bonus decays 20% per wrong attempt before the win.
  const fails = Math.max(0, attemptsUsed - 1)
  const bonus = Math.round(stake * Math.max(0, 1 - 0.2 * fails))
  return stake + bonus
}
