// Server-only challenge grader running on a REAL JS engine (QuickJS-wasm) in a
// hard sandbox. Same contract as the legacy interpreter grader in
// `challenge.ts` (`runFn`/`grade`/`computeExpected`), but it runs the FULL JS
// language — regex, generators, real throw/catch objects, Date, Symbol, classes
// — instead of the teaching subset. Grading only needs the program's output, so
// there is no step trace here.
//
// NEVER import this from client code: it pulls in the QuickJS wasm module.
import 'server-only'

import { getQuickJS, shouldInterruptAfterDeadline, type QuickJSWASMModule } from 'quickjs-emscripten'
import type { HiddenTest, GradeResult } from './challenge'

// Marker prefix so we can pick OUR harness line out of the learner's own
// console.log noise. Matches the legacy grader's sentinel.
const SENTINEL = 'R:'

// Per-run guards. A grading run is tiny, so a short wall-clock deadline both
// kills infinite loops and bounds cost; the memory cap stops runaway allocation.
const GRADE_TIMEOUT_MS = 1000
const GRADE_MEMORY_BYTES = 64 * 1024 * 1024

// Freeze non-determinism so a reference solution and a submission that use
// Math.random / Date grade against the same values (activate + submit share
// this module, so the seed is identical on both sides).
const SEED = 'Math.random=function(){return 0.5};Date.now=function(){return 0};undefined'

// QuickJS wasm loads once, asynchronously, then is reused for every run.
let modulePromise: Promise<QuickJSWASMModule> | null = null
function quickjs(): Promise<QuickJSWASMModule> {
  if (!modulePromise) modulePromise = getQuickJS()
  return modulePromise
}

function argLiteral(a: unknown): string {
  return JSON.stringify(a)
}

/**
 * Run `code`, call `fnName(...args)`, and capture what it returns (as a JSON
 * string). Returns null if the program throws, hits the time/memory budget, or
 * never produces the marked line (e.g. the function isn't defined).
 */
export async function runFnQjs(code: string, fnName: string, args: unknown[]): Promise<string | null> {
  const QuickJS = await quickjs()
  const callArgs = args.map(argLiteral).join(', ')
  const harness = `${code}\n;console.log(${JSON.stringify(SENTINEL)} + JSON.stringify(${fnName}(${callArgs})))`

  const rt = QuickJS.newRuntime()
  rt.setInterruptHandler(shouldInterruptAfterDeadline(Date.now() + GRADE_TIMEOUT_MS))
  rt.setMemoryLimit(GRADE_MEMORY_BYTES)
  const ctx = rt.newContext()
  let out: string | null = null
  try {
    const seed = ctx.evalCode(SEED)
    if (seed.error) seed.error.dispose()
    else seed.value.dispose()

    // A minimal console.log that only records our sentinel-marked line.
    const logFn = ctx.newFunction('log', (...handles) => {
      const parts = handles.map((h) => ctx.dump(h))
      const line = parts.join(' ')
      if (typeof line === 'string' && line.startsWith(SENTINEL)) out = line.slice(SENTINEL.length)
    })
    const con = ctx.newObject()
    ctx.setProp(con, 'log', logFn)
    logFn.dispose()
    ctx.setProp(ctx.global, 'console', con)
    con.dispose()

    const r = ctx.evalCode(harness)
    if (r.error) {
      r.error.dispose()
      out = null // throw / timeout / OOM → no result
    } else {
      r.value.dispose()
    }
  } finally {
    // Order matters: context before runtime. Disposing frees all guest objects;
    // any leaked handle would abort the wasm runtime on free.
    ctx.dispose()
    rt.dispose()
  }
  return out
}

/** Grade a submission: run it against every hidden test, compare to expected. */
export async function gradeQjs(code: string, fnName: string, tests: HiddenTest[]): Promise<GradeResult> {
  let passed = 0
  for (const t of tests) {
    const got = await runFnQjs(code, fnName, t.args)
    if (got !== null && got === t.expected) passed++
  }
  return { passed, total: tests.length, allPass: tests.length > 0 && passed === tests.length }
}

/**
 * Derive expected outputs by running the AI REFERENCE solution (we never trust
 * the model's claimed outputs). Returns null if the reference doesn't run
 * cleanly for every input, so the caller can regenerate.
 */
export async function computeExpectedQjs(
  referenceCode: string,
  fnName: string,
  testArgs: unknown[][],
): Promise<HiddenTest[] | null> {
  const out: HiddenTest[] = []
  for (const args of testArgs) {
    const expected = await runFnQjs(referenceCode, fnName, args)
    if (expected === null) return null
    out.push({ args, expected })
  }
  return out
}
