// Server-only (for now) trace producer on the real engine. Instruments the
// user program, runs it in QuickJS with the in-guest recorder prepended, and
// pulls the accumulated Step[] across the wasm boundary once via __dump().
// Produces the same `Trace` shape the ~20 views consume.
//
// NEVER import from client code yet: pulls in the QuickJS wasm. (The eventual
// home is a browser worker — P2 follow-up.)
import 'server-only'

import { getQuickJS, shouldInterruptAfterDeadline, type QuickJSWASMModule } from 'quickjs-emscripten'
import type { Step, Trace, ValueSnapshot } from './types'
import { instrument, computeIndexVars, computeHoisting, computeWarnings } from './instrument'
import { RECORDER_PRELUDE } from './recorder-prelude'

const RUN_TIMEOUT_MS = 2000
const RUN_MEMORY_BYTES = 128 * 1024 * 1024
const SEED = 'Math.random=function(){return 0.5};Date.now=function(){return 0};undefined'

let modulePromise: Promise<QuickJSWASMModule> | null = null
function quickjs(): Promise<QuickJSWASMModule> {
  if (!modulePromise) modulePromise = getQuickJS()
  return modulePromise
}

// The in-guest recorder JSON-encodes primitives JSON can't carry; restore them.
interface EncodedPrim { t: 'prim'; e?: 'u' | 'nan' | 'inf' | '-inf'; v?: unknown }
function decodeValue(vs: ValueSnapshot & EncodedPrim): void {
  if (vs.t !== 'prim') return
  if (vs.e === 'u') { vs.v = undefined; delete vs.e }
  else if (vs.e === 'nan') { vs.v = NaN; delete vs.e }
  else if (vs.e === 'inf') { vs.v = Infinity; delete vs.e }
  else if (vs.e === '-inf') { vs.v = -Infinity; delete vs.e }
}

function decodeSteps(steps: Step[]): void {
  for (const s of steps) {
    for (const f of s.frames) for (const v of f.vars) decodeValue(v.value as ValueSnapshot & EncodedPrim)
    for (const h of s.heap) {
      if (h.cells) for (const c of h.cells) decodeValue(c as ValueSnapshot & EncodedPrim)
      if (h.fields) for (const f of h.fields) decodeValue(f.value as ValueSnapshot & EncodedPrim)
    }
  }
}

// The recorder attaches raw trail records (sub-expression source ranges + values)
// as a temp `__trail`; expand them against the original source into an exprTrail
// like ['nums[i] > max', '92 > 14', 'true'] (mirrors the legacy interpreter).
interface RawTrail { r: { s: number; e: number; x: string }[]; es: number; ee: number; tf?: string }
function buildTrails(steps: Step[], source: string): void {
  for (const step of steps as (Step & { __trail?: RawTrail })[]) {
    const tr = step.__trail
    if (!tr) continue
    delete step.__trail
    const { r: records, es, ee, tf } = tr
    const src = source.slice(es, ee).replace(/\s+/g, ' ')
    const inner = records
      .filter((rec) => rec.s >= es && rec.e <= ee && !(rec.s === es && rec.e === ee))
      .sort((a, b) => a.s - b.s || b.e - a.e)
    const kept: typeof inner = []
    for (const rec of inner) if (!kept.some((k) => rec.s >= k.s && rec.e <= k.e)) kept.push(rec)
    let substituted = ''
    let pos = es
    for (const rec of kept) { substituted += source.slice(pos, rec.s) + rec.x; pos = rec.e }
    substituted += source.slice(pos, ee)
    substituted = substituted.replace(/\s+/g, ' ')
    const trail = [src]
    if (substituted !== src && substituted.length <= 120) trail.push(substituted)
    if (tf != null && trail[trail.length - 1] !== tf) trail.push(tf)
    if (trail.length > 1) step.exprTrail = trail
  }
}

export interface QjsTraceResult {
  trace: Trace
  error?: string
}

/** Instrument + run `source` on QuickJS and return a replayable Trace. */
export async function traceQjs(source: string): Promise<QjsTraceResult> {
  const QuickJS = await quickjs()
  let instrumented: string
  try {
    instrumented = instrument(source)
  } catch (e) {
    // Parse error — the editor's acorn squiggle already covers this; return empty.
    return { trace: emptyTrace(source), error: e instanceof Error ? e.message : String(e) }
  }

  // After the synchronous program, drain the async queues (no-op unless the
  // program scheduled timers/microtasks) so the event-loop views get their steps.
  const program = `${RECORDER_PRELUDE}\n${SEED}\n${instrumented}\n;__runEventLoop();\n`
  const rt = QuickJS.newRuntime()
  rt.setInterruptHandler(shouldInterruptAfterDeadline(Date.now() + RUN_TIMEOUT_MS))
  rt.setMemoryLimit(RUN_MEMORY_BYTES)
  const ctx = rt.newContext()
  let error: string | undefined
  let dumped = '{}'
  try {
    const r = ctx.evalCode(program)
    if (r.error) {
      const err = ctx.dump(r.error)
      error = typeof err === 'object' && err && 'message' in err ? String((err as { message: unknown }).message) : String(err)
      r.error.dispose()
    } else {
      r.value.dispose()
    }
    // Pull whatever the recorder accumulated (partial on error/timeout).
    const d = ctx.evalCode('__dump()')
    if (d.error) d.error.dispose()
    else { dumped = ctx.dump(d.value) as string; d.value.dispose() }
  } finally {
    ctx.dispose()
    rt.dispose()
  }

  let parsed: { steps: Step[]; output: string; outputCount: number; truncated: boolean; hasAsync?: boolean }
  try {
    parsed = JSON.parse(dumped)
  } catch {
    return { trace: emptyTrace(source), error: error ?? 'trace dump failed' }
  }
  decodeSteps(parsed.steps)
  buildTrails(parsed.steps, source)

  const trace: Trace = {
    steps: parsed.steps,
    lines: source.split('\n'),
    outputCount: parsed.outputCount,
    indexVars: computeIndexVars(source),
    truncated: parsed.truncated,
    hasAsync: parsed.hasAsync,
  }
  const hoisting = computeHoisting(source)
  if (hoisting) trace.hoisting = hoisting
  const warnings = computeWarnings(source)
  if (warnings.length) trace.warnings = warnings
  if (error) trace.stopReason = error
  return { trace, error }
}

function emptyTrace(source: string): Trace {
  return { steps: [], lines: source.split('\n'), outputCount: 0, indexVars: {} }
}
