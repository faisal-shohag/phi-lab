// Types for the visualization engine.
// An "execution trace" is a flat list of Step frames. Each frame describes
// ONE atomic thing that happened during interpretation: a line was entered,
// a variable was assigned, a condition was evaluated, an array cell was read,
// etc. The UI plays frames back one at a time, animating the transition.

export type Primitive = string | number | boolean | null | undefined

// A value is either a primitive or a reference into the step's heap snapshot.
// References let the UI show aliasing: two variables pointing at the same
// array/object share a heap id.
export type ValueSnapshot =
  | { t: 'prim'; v: Primitive }
  | { t: 'ref'; id: number }

export interface HeapSnapshot {
  id: number
  kind: 'array' | 'object' | 'function'
  // For functions: the declared name.
  label?: string
  // For arrays: one entry per cell.
  cells?: ValueSnapshot[]
  // For objects: one entry per field.
  fields?: { key: string; value: ValueSnapshot }[]
  // For functions: variables captured from an enclosing scope (closure),
  // resolved to their value at this moment. Drives the closure-capture view.
  captures?: { name: string; value: string }[]
}

// A snapshot of a single variable at a point in time.
export interface VarSnapshot {
  name: string
  value: ValueSnapshot
  // True when the variable comes from an enclosing (closure) scope rather
  // than the frame's own locals.
  closure?: boolean
}

// One call-stack frame: the global frame plus one per active function call.
export interface FrameSnapshot {
  name: string
  kind: 'global' | 'function'
  // Line of the call site (function frames only).
  callLine?: number
  vars: VarSnapshot[]
}

// Source location of a function (signature line through closing brace).
export interface FnLoc {
  line: number
  endLine: number
}

export type StepKind =
  | 'enter'        // entered a function
  | 'assign'       // variable was assigned
  | 'declare'      // variable / function was declared
  | 'condition'    // an if/else if condition was evaluated
  | 'branch'       // we chose a branch (true/false)
  | 'loop-start'   // entering a loop
  | 'loop-iter'    // one iteration finished
  | 'loop-check'   // checking loop condition
  | 'loop-end'     // loop finished
  | 'read'         // read a value (array cell)
  | 'write'        // wrote to an array cell / object field
  | 'call'         // function call
  | 'return'       // function return
  | 'output'       // console.log output produced
  | 'expr'         // generic expression evaluated
  | 'schedule'     // an async callback was scheduled (setTimeout / microtask)
  | 'dequeue'      // the event loop pulled a callback off a queue to run it

// A single execution step. The UI advances through these one at a time.
export interface Step {
  // 1-indexed line number that is "active" at this step (gets highlighted).
  line: number
  // Short human-readable explanation of what just happened.
  description: string
  kind: StepKind
  // The evaluated result of the expression at this step (if any).
  result?: Primitive
  // For condition steps: whether the condition was true or false.
  conditionResult?: boolean
  // For loop steps: the iteration index (0-based).
  iteration?: number
  // For output steps: the text that was printed.
  output?: string
  // Substitution trail for the expression evaluated at this step,
  // e.g. ['nums[i] > max', '92 > 14', 'true'].
  exprTrail?: string[]
  // For call/enter/return steps: where the call happened...
  callLine?: number
  // ...and where the target function lives in the source.
  fnLoc?: FnLoc
  // For call/enter steps: argument -> parameter bindings, pre-formatted.
  bindings?: { name: string; value: string }[]
  // Call stack at this moment, global frame first, innermost call last.
  frames: FrameSnapshot[]
  // All heap objects reachable from the frames at this moment.
  heap: HeapSnapshot[]
  // Call stack depth at this step (0 = global).
  depth: number
  // An optional "focus" hint: what the UI should draw the eye toward.
  focus?: {
    varName?: string
    arrayIndex?: number
    objectKey?: string
    // Name of the variable used as the index (e.g. `i` in nums[i]).
    indexVarName?: string
    // Heap id of the touched array/object (for the heap graph).
    heapId?: number
  }
  // Event-loop snapshot: the synchronous call stack plus the pending queues at
  // this moment. Only populated for traces that use async APIs.
  async?: AsyncSnapshot
}

// A snapshot of the event loop at one step: what is on the call stack, what is
// waiting in the browser's Web-API holding area (timers), and what is queued
// as micro / macro tasks. Labels are short human-readable callback names.
export interface AsyncSnapshot {
  callStack: string[]
  webApis: string[]
  microtasks: string[]
  macrotasks: string[]
  // Which phase the event loop is in at this step.
  phase: 'sync' | 'microtask' | 'macrotask'
}

// Result of the static "compile phase" pre-pass: what the engine hoists before
// running the top-level code, and which let/const bindings sit in the Temporal
// Dead Zone until their declaration executes.
export interface HoistingInfo {
  funcs: string[]
  vars: string[]
  tdz: { name: string; line: number; kind: 'let' | 'const' }[]
}

export interface Trace {
  steps: Step[]
  // The source lines (split by \n) so the UI can render with line numbers.
  lines: string[]
  // Total number of console.log outputs produced.
  outputCount: number
  // For each array variable: names of variables ever used to index into it
  // (drives the pointer markers in the array view).
  indexVars: Record<string, string[]>
  // Static compile-phase summary (hoisting / TDZ) for the global scope.
  hoisting?: HoistingInfo
  // True when the trace scheduled at least one async callback.
  hasAsync?: boolean
  // True when execution hit the step limit and was stopped early (likely an
  // infinite loop / runaway recursion). The steps present are the partial run.
  truncated?: boolean
  // A human-readable, diagnosed explanation + suggestion for the truncation.
  stopReason?: string
  // Non-fatal static hints surfaced before/after running (e.g. "while(true)
  // with no break"). Shown as gentle suggestions, they do not block the run.
  warnings?: string[]
}

export interface ParseErrorInfo {
  message: string
  line: number
  column: number
  pos: number
}

export interface DemoExample {
  id: string
  title: string
  description: string
  code: string
  icon: string
}
