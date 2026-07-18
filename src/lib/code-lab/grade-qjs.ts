// Server-only Code Lab grader on a REAL JS engine (QuickJS-wasm) in a hard
// sandbox. This is the ONLY thing that pays XP: the browser "Run" worker is a
// convenience preview against visible cases, but a submission is re-graded here
// against every case (visible + hidden) before anything is stored or awarded.
//
// Modeled on src/lib/visualizer/grade-qjs.ts (same SENTINEL/console-shim/dispose
// discipline), but grades a whole problem: a FRESH runtime+context per case so
// one case's globals can't leak into the next.
//
// NEVER import this from client code — it pulls in the QuickJS wasm module.
import 'server-only'

import { getQuickJS, shouldInterruptAfterDeadline, type QuickJSWASMModule } from 'quickjs-emscripten'
import { STABLE_SERIALIZE_SRC, stableSerialize, normalizeStdout } from './serialize'
import type { CaseResult, GradeSummary, ProblemTests, ProblemType } from './types'

const SENTINEL = 'R:'
const CASE_TIMEOUT_MS = 1000
const CASE_MEMORY_BYTES = 64 * 1024 * 1024

// Freeze non-determinism so a reference solution and a submission using
// Math.random / Date grade against the same values.
const SEED = 'Math.random=function(){return 0.5};Date.now=function(){return 0};undefined'

let modulePromise: Promise<QuickJSWASMModule> | null = null
function quickjs(): Promise<QuickJSWASMModule> {
  if (!modulePromise) modulePromise = getQuickJS()
  return modulePromise
}

interface RunOutcome {
  /** Serialized return value (FUNCTION_RETURN), or null if none produced. */
  ret: string | null
  /** Captured non-sentinel stdout lines joined by \n. */
  stdout: string
  /** True when the program threw or hit a budget. */
  errored: boolean
  /** True when the interrupt deadline was hit (infinite loop). */
  timedOut: boolean
  /** First error message, if errored. */
  error?: string
}

/** Run one harness program in a fresh sandbox and capture output. */
async function runOnce(harness: string): Promise<RunOutcome> {
  const QuickJS = await quickjs()
  const rt = QuickJS.newRuntime()
  const deadline = Date.now() + CASE_TIMEOUT_MS
  rt.setInterruptHandler(shouldInterruptAfterDeadline(deadline))
  rt.setMemoryLimit(CASE_MEMORY_BYTES)
  const ctx = rt.newContext()

  let ret: string | null = null
  const lines: string[] = []
  let errored = false
  let timedOut = false
  let error: string | undefined

  try {
    const seed = ctx.evalCode(SEED)
    if (seed.error) seed.error.dispose()
    else seed.value.dispose()

    const record = (...handles: import('quickjs-emscripten').QuickJSHandle[]) => {
      const line = handles.map((h) => stringifyHandle(ctx, h)).join(' ')
      if (line.startsWith(SENTINEL)) ret = line.slice(SENTINEL.length)
      else lines.push(line)
    }
    const con = ctx.newObject()
    for (const name of ['log', 'info', 'warn', 'error', 'debug']) {
      const fn = ctx.newFunction(name, record)
      ctx.setProp(con, name, fn)
      fn.dispose()
    }
    ctx.setProp(ctx.global, 'console', con)
    con.dispose()

    const r = ctx.evalCode(harness)
    if (r.error) {
      const msg = ctx.dump(r.error) as unknown
      error = typeof msg === 'object' && msg && 'message' in msg ? String((msg as { message: unknown }).message) : String(msg)
      r.error.dispose()
      errored = true
      if (Date.now() >= deadline) timedOut = true
    } else {
      r.value.dispose()
    }
  } finally {
    ctx.dispose()
    rt.dispose()
  }

  return { ret, stdout: lines.join('\n'), errored, timedOut, error }
}

// console.log renders primitives plainly (String semantics), not JSON — a logged
// string must compare as itself, not as a quoted string.
function stringifyHandle(ctx: import('quickjs-emscripten').QuickJSContext, h: import('quickjs-emscripten').QuickJSHandle): string {
  const dumped = ctx.dump(h) as unknown
  if (typeof dumped === 'string') return dumped
  if (dumped === undefined) return 'undefined'
  if (typeof dumped === 'object') return stableSerialize(dumped)
  return String(dumped)
}

function argsLiteral(args: unknown[] | undefined): string {
  return (args ?? []).map((a) => JSON.stringify(a)).join(', ')
}

function buildHarness(codeJs: string, type: ProblemType, fnName: string | null, args: unknown[] | undefined): string {
  if (type === 'FUNCTION_RETURN') {
    const call = `${fnName}(${argsLiteral(args)})`
    return `${STABLE_SERIALIZE_SRC}\n${codeJs}\n;console.log(${JSON.stringify(SENTINEL)} + __stableSerialize(${call}))`
  }
  // CONSOLE_OUTPUT
  if (fnName) return `${codeJs}\n;${fnName}(${argsLiteral(args)})`
  return codeJs
}

export interface GradeInput {
  type: ProblemType
  fnName: string | null
  tests: ProblemTests
}

/**
 * Grade `codeJs` (already transpiled to JS) against every case. `includeHidden`
 * controls whether hidden cases' actual/stdout appear in the results (admin
 * validation wants them; learner submits must not).
 */
export async function gradeAll(codeJs: string, input: GradeInput, includeHidden = false): Promise<GradeSummary> {
  const started = Date.now()
  const results: CaseResult[] = []
  let passed = 0
  let anyTimeout = false
  let anyError = false
  let firstError: string | undefined

  for (const c of input.tests.cases) {
    const harness = buildHarness(codeJs, input.type, input.fnName, c.args)
    const outcome = await runOnce(harness)
    const show = includeHidden || !c.hidden

    let status: CaseResult['status']
    if (outcome.timedOut) {
      status = 'timeout'
      anyTimeout = true
    } else if (outcome.errored) {
      status = 'error'
      anyError = true
      if (!firstError) firstError = outcome.error
    } else if (matches(input.type, c, outcome)) {
      status = 'pass'
    } else {
      status = 'fail'
    }

    if (status === 'pass') passed++

    const result: CaseResult = { id: c.id, hidden: c.hidden, status }
    if (show) {
      if (input.type === 'FUNCTION_RETURN') result.actual = outcome.ret ?? undefined
      else result.stdout = outcome.stdout
      if (status === 'error') result.error = outcome.error
    }
    results.push(result)
  }

  const total = input.tests.cases.length
  let verdict: GradeSummary['verdict']
  if (total > 0 && passed === total) verdict = 'ACCEPTED'
  else if (anyTimeout) verdict = 'TIME_LIMIT'
  else if (anyError) verdict = 'RUNTIME_ERROR'
  else verdict = 'WRONG_ANSWER'

  return {
    verdict,
    results,
    passedCount: passed,
    totalCount: total,
    runtimeMs: Date.now() - started,
    error: firstError,
  }
}

function matches(type: ProblemType, c: { expected?: unknown; expectedStdout?: string }, outcome: RunOutcome): boolean {
  if (type === 'FUNCTION_RETURN') {
    if (outcome.ret === null) return false
    return outcome.ret === stableSerialize(c.expected)
  }
  return normalizeStdout(outcome.stdout) === normalizeStdout(c.expectedStdout ?? '')
}

/**
 * Derive expected outputs by running the reference solution — we never trust an
 * author's (or the AI's) claimed outputs. Returns a new cases array with
 * expected/expectedStdout filled from the solution, or null if the solution
 * doesn't run cleanly on every case.
 */
export async function computeExpected(
  solutionJs: string,
  input: GradeInput,
): Promise<ProblemTests | null> {
  const cases: ProblemTests['cases'] = []
  for (const c of input.tests.cases) {
    const harness = buildHarness(solutionJs, input.type, input.fnName, c.args)
    const outcome = await runOnce(harness)
    if (outcome.errored) return null
    if (input.type === 'FUNCTION_RETURN') {
      // stableSerialize of a plain JSON value is valid JSON. Non-JSON outputs
      // (NaN, undefined, bigint) can't be stored as a test `expected`, so the
      // author must fix the problem rather than ship an un-storable case.
      if (outcome.ret === null) return null
      try {
        cases.push({ ...c, expected: JSON.parse(outcome.ret) })
      } catch {
        return null
      }
    } else {
      cases.push({ ...c, expectedStdout: normalizeStdout(outcome.stdout) })
    }
  }
  return { cases }
}
