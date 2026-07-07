// A tiny JavaScript interpreter that produces a step-by-step execution trace.
//
// We do NOT try to be a spec-compliant JS engine. We support the constructs
// needed for teaching demos: variable declarations (let/const/var),
// assignments, binary/unary/logical expressions, if/else, for, while,
// do-while, for-of, function declarations/expressions/arrows (with closures),
// return, console.log, arrays with indexed access and mutation, objects, and
// a few Math / String helpers.
//
// Every meaningful operation pushes a Step into `trace.steps`, with a full
// snapshot of the call stack (frames with their visible variables) and of
// every reachable heap object at that moment. The UI then replays the trace
// frame by frame.

import { parse } from 'acorn'
import type {
  AsyncSnapshot,
  FrameSnapshot,
  HeapSnapshot,
  HoistingInfo,
  ParseErrorInfo,
  Primitive,
  Step,
  Trace,
  ValueSnapshot,
  VarSnapshot,
} from './types'

// ---------------------------------------------------------------------------
// Runtime value handling
// ---------------------------------------------------------------------------

// A runtime value can be a primitive, an array (JS array), a plain object, or
// a function. We use JS values directly so the interpreter stays simple.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type RTCallable = (...args: any[]) => any
type RTValue = Primitive | RTValue[] | { [k: string]: RTValue } | RTCallable

interface Scope {
  vars: Map<string, RTValue>
  parent: Scope | null
  name: string
}

// One entry per active function call (plus the global frame). `currentScope`
// tracks the innermost block scope currently executing inside this frame so
// snapshots can see loop counters and block-scoped variables.
interface Activation {
  name: string
  kind: 'global' | 'function'
  callLine?: number
  rootScope: Scope
  currentScope: Scope
}

function newScope(parent: Scope | null, name: string): Scope {
  return { vars: new Map(), parent, name }
}

function lookup(scope: Scope, name: string): RTValue | undefined {
  let s: Scope | null = scope
  while (s) {
    if (s.vars.has(name)) return s.vars.get(name)
    s = s.parent
  }
  return undefined
}

function setVar(scope: Scope, name: string, value: RTValue): void {
  let s: Scope | null = scope
  while (s) {
    if (s.vars.has(name)) {
      s.vars.set(name, value)
      return
    }
    s = s.parent
  }
  // Not found in any scope -> declare in the current scope.
  scope.vars.set(name, value)
}

export class ParseError extends Error {
  line: number
  column: number
  pos: number
  constructor(message: string, line: number, column: number, pos: number) {
    super(message)
    this.name = 'ParseError'
    this.line = line
    this.column = column
    this.pos = pos
  }
}

// Parse-only check used by the editor to render error squiggles.
export function getParseError(source: string): ParseErrorInfo | null {
  try {
    parse(source, { ecmaVersion: 'latest', sourceType: 'script', locations: true })
    return null
  } catch (e) {
    const err = e as Error & { loc?: { line: number; column: number }; pos?: number }
    return {
      message: err.message.replace(/\s*\(\d+:\d+\)\s*$/, ''),
      line: err.loc?.line ?? 1,
      column: err.loc?.column ?? 0,
      pos: err.pos ?? 0,
    }
  }
}

export interface InterpreterOptions {
  // Maximum number of steps before we abort (prevents infinite loops).
  maxSteps?: number
}

export function interpret(source: string, opts: InterpreterOptions = {}): Trace {
  const lines = source.split('\n')
  const steps: Step[] = []
  const maxSteps = opts.maxSteps ?? 5000
  let outputCount = 0

  const globalScope = newScope(null, 'global')
  const callStack: Activation[] = [
    { name: 'global', kind: 'global', rootScope: globalScope, currentScope: globalScope },
  ]

  // ---- event loop state ---------------------------------------------------
  // A callback waiting to run, plus a short label for the queue visualization.
  interface Task {
    label: string
    run: () => void
  }
  const microtaskQueue: Task[] = []
  const macrotaskQueue: Task[] = []
  // Timers still counting down inside the "Web APIs" holding area.
  const webApiTimers: (Task & { delay: number })[] = []
  let asyncPhase: AsyncSnapshot['phase'] = 'sync'
  let usedAsync = false

  function taskLabel(fn: unknown, prefix = ''): string {
    const name = (fn as { __name?: string })?.__name
    const base = name && name !== 'anonymous' ? name : 'callback'
    return prefix ? `${prefix} ${base}` : base
  }

  // For each array variable name: which variable names were used to index it.
  const indexVarsMap = new Map<string, Set<string>>()
  function noteIndexVar(objNode: any, propNode: any, computed: boolean) {
    if (computed && objNode?.type === 'Identifier' && propNode?.type === 'Identifier') {
      let set = indexVarsMap.get(objNode.name)
      if (!set) {
        set = new Set()
        indexVarsMap.set(objNode.name, set)
      }
      set.add(propNode.name)
    }
  }

  // Built-ins are stored in a separate "hidden" map so they don't appear in
  // variable snapshots — the user only wants to see THEIR variables.
  const builtins = new Map<string, RTValue>()
  const consoleLog = (...args: RTValue[]) => {
    const text = args.map(formatValue).join(' ')
    outputCount++
    pushStep({
      kind: 'output',
      line: currentLine,
      description: `console.log → ${text}`,
      output: text,
    })
    return undefined
  }
  builtins.set('console', { log: consoleLog })
  builtins.set('Math', {
    PI: Math.PI,
    max: (...args: RTValue[]) => Math.max(...(args as number[])),
    min: (...args: RTValue[]) => Math.min(...(args as number[])),
    abs: (x: RTValue) => Math.abs(x as number),
    floor: (x: RTValue) => Math.floor(x as number),
    ceil: (x: RTValue) => Math.ceil(x as number),
    round: (x: RTValue) => Math.round(x as number),
    sqrt: (x: RTValue) => Math.sqrt(x as number),
    pow: (a: RTValue, b: RTValue) => Math.pow(a as number, b as number),
    random: () => Math.random(),
  })
  builtins.set('parseInt', (s: RTValue, r?: RTValue) => parseInt(s as string, (r as number | undefined) ?? 10))
  builtins.set('parseFloat', (s: RTValue) => parseFloat(s as string))
  builtins.set('String', (v: RTValue) => formatValue(v))
  builtins.set('Number', (v: RTValue) => Number(v))
  builtins.set('Boolean', (v: RTValue) => Boolean(v))

  // ---- async / event-loop builtins ----------------------------------------
  // These do not run their callbacks now: they schedule them, and a small
  // event loop (see runEventLoop) drains the queues after the synchronous code
  // finishes — exactly like the browser.
  builtins.set('setTimeout', (fn: RTValue, delay?: RTValue) => {
    usedAsync = true
    const ms = Number(delay) || 0
    const label = taskLabel(fn)
    if (typeof fn === 'function' && (fn as any).__userFn) {
      webApiTimers.push({ label: `${label} · ${ms}ms`, delay: ms, run: () => callUserFn(fn, [], {}, label) })
    }
    pushStep({ kind: 'schedule', line: currentLine, description: `setTimeout → ${label}() after ${ms}ms (goes to Web APIs)` })
    return webApiTimers.length
  })
  builtins.set('queueMicrotask', (fn: RTValue) => {
    usedAsync = true
    const label = taskLabel(fn)
    if (typeof fn === 'function' && (fn as any).__userFn) {
      microtaskQueue.push({ label, run: () => callUserFn(fn, [], {}, label) })
    }
    pushStep({ kind: 'schedule', line: currentLine, description: `queueMicrotask → ${label}() (microtask queue)` })
    return undefined
  })
  // A minimal resolved-promise thenable: enough to demo micro-task ordering
  // (Promise.resolve().then(...)). Chaining returns another resolved promise.
  function makeResolvedPromise(value: RTValue): RTValue {
    const p: { [k: string]: RTValue } = {}
    p.__isPromise = true as unknown as RTValue
    p.then = ((cb: RTValue) => {
      usedAsync = true
      const label = taskLabel(cb, '.then')
      if (typeof cb === 'function' && (cb as any).__userFn) {
        microtaskQueue.push({ label, run: () => callUserFn(cb, [value], {}, label) })
      }
      pushStep({ kind: 'schedule', line: currentLine, description: `Promise.then → ${taskLabel(cb)}() (microtask queue)` })
      return makeResolvedPromise(undefined)
    }) as unknown as RTValue
    p.catch = (() => p) as unknown as RTValue
    return p
  }
  builtins.set('Promise', {
    resolve: (v: RTValue) => makeResolvedPromise(v),
  })

  // Track the "current line" so console.log and helpers know what to report.
  let currentLine = 1

  // ---- heap + frame snapshotting ------------------------------------------

  const heapIds = new Map<object, number>()
  let nextHeapId = 1
  function heapIdOf(o: object): number {
    let id = heapIds.get(o)
    if (id === undefined) {
      id = nextHeapId++
      heapIds.set(o, id)
    }
    return id
  }

  function snapshotState(): { frames: FrameSnapshot[]; heap: HeapSnapshot[] } {
    const queued = new Set<number>()
    const queue: object[] = []

    function toVS(v: RTValue): ValueSnapshot {
      if (v !== null && (typeof v === 'object' || typeof v === 'function')) {
        const id = heapIdOf(v as object)
        if (!queued.has(id)) {
          queued.add(id)
          queue.push(v as object)
        }
        return { t: 'ref', id }
      }
      return { t: 'prim', v: v as Primitive }
    }

    const frames: FrameSnapshot[] = callStack.map((act) => {
      const vars: VarSnapshot[] = []
      const seen = new Set<string>()
      // For function frames, stop before the global scope (globals live in
      // the global frame). Scopes past the frame's root are closure scopes.
      const boundary = act.kind === 'global' ? null : globalScope
      let inClosure = false
      let s: Scope | null = act.currentScope
      while (s && s !== boundary) {
        for (const [name, value] of s.vars) {
          if (seen.has(name)) continue
          seen.add(name)
          const snap: VarSnapshot = { name, value: toVS(value) }
          if (inClosure) snap.closure = true
          vars.push(snap)
        }
        if (s === act.rootScope) inClosure = true
        s = s.parent
      }
      vars.sort(
        (a, b) => (a.closure ? 1 : 0) - (b.closure ? 1 : 0) || a.name.localeCompare(b.name),
      )
      return { name: act.name, kind: act.kind, callLine: act.callLine, vars }
    })

    const heap: HeapSnapshot[] = []
    // The queue grows while we serialize (nested refs), so index-iterate.
    for (let qi = 0; qi < queue.length; qi++) {
      const o = queue[qi]
      const id = heapIdOf(o)
      if (typeof o === 'function') {
        const captures = computeCaptures(o as any)
        heap.push({
          id,
          kind: 'function',
          label: (o as any).__name ?? 'fn',
          captures: captures.length ? captures : undefined,
        })
      } else if (Array.isArray(o)) {
        heap.push({ id, kind: 'array', cells: o.map((c) => toVS(c)) })
      } else {
        heap.push({
          id,
          kind: 'object',
          fields: Object.entries(o as { [k: string]: RTValue }).map(([key, value]) => ({
            key,
            value: toVS(value),
          })),
        })
      }
    }
    return { frames, heap }
  }

  // Resolve a function's captured (closure) variables to their current values.
  // Free variables that resolve only in the global scope are NOT captures —
  // closures capture from enclosing function / block scopes.
  function computeCaptures(fn: { __freeVars?: string[]; __closure?: Scope }): { name: string; value: string }[] {
    const names = fn.__freeVars
    if (!names || !fn.__closure) return []
    const out: { name: string; value: string }[] = []
    for (const name of names) {
      let s: Scope | null = fn.__closure
      while (s && s !== globalScope) {
        if (s.vars.has(name)) {
          out.push({ name, value: formatValue(s.vars.get(name)) })
          break
        }
        s = s.parent
      }
    }
    return out
  }

  function asyncSnapshot(): AsyncSnapshot {
    return {
      callStack: callStack.map((a) => (a.kind === 'global' ? '(main)' : `${a.name}()`)),
      webApis: webApiTimers.map((t) => t.label),
      microtasks: microtaskQueue.map((t) => t.label),
      macrotasks: macrotaskQueue.map((t) => t.label),
      phase: asyncPhase,
    }
  }

  function pushStep(partial: Omit<Step, 'frames' | 'heap' | 'depth'>) {
    if (steps.length >= maxSteps) {
      // Don't discard the run — unwind cleanly and keep the partial trace so the
      // UI can still show what happened up to the limit (see main, below).
      throw new StepLimitSignal()
    }
    const { frames, heap } = snapshotState()
    const step: Step = { ...partial, frames, heap, depth: callStack.length - 1 }
    if (usedAsync) step.async = asyncSnapshot()
    steps.push(step)
  }

  // Run `fn` with the top frame's current scope set to `scope` (restored
  // afterwards). This is what makes loop counters and block-scoped variables
  // visible in snapshots.
  function withScope<T>(scope: Scope, fn: () => T): T {
    const act = callStack[callStack.length - 1]
    const prev = act.currentScope
    act.currentScope = scope
    try {
      return fn()
    } finally {
      act.currentScope = prev
    }
  }

  // ---- expression trail recording ------------------------------------------
  // While evaluating a "headline" expression (a condition, an assignment RHS,
  // a return value...) we record the values of its primitive sub-expressions
  // so the UI can show a substitution trail: nums[i] > max → 92 > 14 → true.

  interface TrailRecord {
    start: number
    end: number
    text: string
  }
  let trailRecorder: TrailRecord[] | null = null

  function recordTrail(node: any, value: RTValue) {
    if (!trailRecorder || trailRecorder.length > 300) return
    if (value !== null && (typeof value === 'object' || typeof value === 'function')) return
    if (typeof node.start !== 'number' || typeof node.end !== 'number') return
    trailRecorder.push({ start: node.start, end: node.end, text: formatPrim(value as Primitive) })
  }

  function evalWithTrail(node: any, scope: Scope): { value: RTValue; trail: string[] } {
    const records: TrailRecord[] = []
    const prev = trailRecorder
    trailRecorder = records
    let value: RTValue
    try {
      value = evalExpr(node, scope)
    } finally {
      trailRecorder = prev
    }
    const src = source.slice(node.start, node.end).replace(/\s+/g, ' ')
    // Keep the outermost recorded sub-ranges inside this expression (but not
    // the whole expression itself), then substitute them into the source.
    const inner = records
      .filter((r) => r.start >= node.start && r.end <= node.end && !(r.start === node.start && r.end === node.end))
      .sort((a, b) => a.start - b.start || b.end - a.end)
    const kept: TrailRecord[] = []
    for (const r of inner) {
      if (!kept.some((k) => r.start >= k.start && r.end <= k.end)) kept.push(r)
    }
    let substituted = ''
    let pos = node.start
    for (const r of kept) {
      substituted += source.slice(pos, r.start) + r.text
      pos = r.end
    }
    substituted += source.slice(pos, node.end)
    substituted = substituted.replace(/\s+/g, ' ')

    const final =
      value !== null && (typeof value === 'object' || typeof value === 'function')
        ? formatValue(value)
        : formatPrim(value as Primitive)
    const trail = [src]
    if (substituted !== src && substituted.length <= 120) trail.push(substituted)
    if (trail[trail.length - 1] !== final) trail.push(final)
    return { value, trail }
  }

  // Attach a trail only when it actually shows work (more than one stage).
  function trailOrUndef(trail: string[]): string[] | undefined {
    return trail.length > 1 ? trail : undefined
  }

  // ---- expression evaluation --------------------------------------------

  function srcOf(node: any): string {
    if (node && typeof node.start === 'number' && typeof node.end === 'number') {
      return source.slice(node.start, node.end)
    }
    return '?'
  }

  function evalExpr(node: any, scope: Scope): RTValue {
    if (!node) return undefined
    switch (node.type) {
      case 'Literal':
        return node.value
      case 'Identifier': {
        const v = lookup(scope, node.name) ?? builtins.get(node.name)
        recordTrail(node, v)
        return v
      }
      case 'ArrayExpression': {
        const out: RTValue[] = []
        for (const e of node.elements) {
          if (!e) {
            out.push(undefined)
          } else if (e.type === 'SpreadElement') {
            const v = evalExpr(e.argument, scope)
            if (Array.isArray(v)) out.push(...v)
          } else {
            out.push(evalExpr(e, scope))
          }
        }
        return out
      }
      case 'ObjectExpression': {
        const obj: { [k: string]: RTValue } = {}
        for (const prop of node.properties) {
          if (prop.type === 'SpreadElement') {
            const v = evalExpr(prop.argument, scope)
            if (v && typeof v === 'object' && !Array.isArray(v)) Object.assign(obj, v)
            continue
          }
          const key = prop.key.type === 'Identifier' && !prop.computed ? prop.key.name : evalExpr(prop.key, scope)
          obj[String(key)] = evalExpr(prop.value, scope)
        }
        return obj
      }
      case 'TemplateLiteral': {
        let out = ''
        for (let i = 0; i < node.quasis.length; i++) {
          out += node.quasis[i].value.cooked
          if (i < node.expressions.length) {
            out += formatValue(evalExpr(node.expressions[i], scope))
          }
        }
        recordTrail(node, out)
        return out
      }
      case 'ArrowFunctionExpression':
      case 'FunctionExpression':
        return makeUserFn(node, scope)
      case 'UnaryExpression': {
        const v = evalExpr(node.argument, scope)
        let out: RTValue
        switch (node.operator) {
          case '-': out = -(v as number); break
          case '+': out = +(v as number); break
          case '!': out = !v; break
          case 'typeof': out = typeof v; break
          default: throw new Error(`Unsupported unary operator: ${node.operator}`)
        }
        return out
      }
      case 'UpdateExpression':
        return evalUpdate(node, scope)
      case 'BinaryExpression': {
        const l = evalExpr(node.left, scope)
        const r = evalExpr(node.right, scope)
        return applyBinary(node.operator, l, r)
      }
      case 'LogicalExpression': {
        const l = evalExpr(node.left, scope)
        if (node.operator === '&&') return l ? evalExpr(node.right, scope) : l
        if (node.operator === '||') return l ? l : evalExpr(node.right, scope)
        if (node.operator === '??') return (l === null || l === undefined) ? evalExpr(node.right, scope) : l
        throw new Error(`Unsupported logical operator: ${node.operator}`)
      }
      case 'AssignmentExpression':
        return evalAssignment(node, scope)
      case 'ConditionalExpression': {
        const c = evalExpr(node.test, scope)
        return c ? evalExpr(node.consequent, scope) : evalExpr(node.alternate, scope)
      }
      case 'MemberExpression':
        return evalMember(node, scope)
      case 'CallExpression': {
        const v = evalCall(node, scope)
        recordTrail(node, v)
        return v
      }
      case 'SequenceExpression': {
        let v: RTValue
        for (const e of node.expressions) v = evalExpr(e, scope)
        return v!
      }
      case 'SpreadElement':
        return evalExpr(node.argument, scope)
      default:
        throw new Error(`Unsupported expression: ${node.type}`)
    }
  }

  function evalMember(node: any, scope: Scope): RTValue {
    const obj = evalExpr(node.object, scope)
    let key: string | number
    if (node.computed) {
      key = evalExpr(node.property, scope) as string | number
    } else {
      key = node.property.name
    }
    let val: RTValue
    if (Array.isArray(obj)) {
      if (typeof key === 'number') {
        // Array indexed read — record it as a "read" step.
        currentLine = node.loc?.start.line ?? currentLine
        val = obj[key]
        noteIndexVar(node.object, node.property, node.computed)
        pushStep({
          kind: 'read',
          line: currentLine,
          description: `Read ${srcOf(node.object)}[${key}] → ${formatValue(val)}`,
          result: asPrim(val),
          focus: {
            varName: node.object.type === 'Identifier' ? node.object.name : undefined,
            arrayIndex: key,
            indexVarName: node.computed && node.property.type === 'Identifier' ? node.property.name : undefined,
            heapId: heapIdOf(obj),
          },
        })
      } else if (key === 'length') {
        val = obj.length
      } else {
        val = undefined
      }
    } else if (typeof obj === 'string') {
      if (key === 'length') val = obj.length
      else if (typeof key === 'number') val = obj[key]
      else val = undefined
    } else if (obj && typeof obj === 'object') {
      val = (obj as { [k: string]: RTValue })[String(key)]
    } else {
      val = undefined
    }
    recordTrail(node, val)
    return val
  }

  function evalUpdate(node: any, scope: Scope): RTValue {
    // i++ / i-- / arr[i]++ etc. We treat them as assignment + read.
    if (node.argument.type === 'Identifier') {
      const name = node.argument.name
      const old = (lookup(scope, name) as number) ?? 0
      const next = node.operator === '++' ? old + 1 : old - 1
      setVar(scope, name, next)
      currentLine = node.loc?.start.line ?? currentLine
      pushStep({
        kind: 'assign',
        line: currentLine,
        description: `${name} = ${formatValue(next)}   (${node.operator === '++' ? '' : ''}${srcOf(node)})`,
        result: next,
        focus: { varName: name },
      })
      const out = node.prefix ? next : old
      recordTrail(node, out)
      return out
    }
    if (node.argument.type === 'MemberExpression') {
      const target = node.argument
      const obj = evalExpr(target.object, scope)
      const key = target.computed ? (evalExpr(target.property, scope) as string | number) : target.property.name
      const container = obj as any
      const old = (container?.[key] as number) ?? 0
      const next = node.operator === '++' ? old + 1 : old - 1
      if (container && typeof container === 'object') container[key] = next
      currentLine = node.loc?.start.line ?? currentLine
      noteIndexVar(target.object, target.property, target.computed)
      pushStep({
        kind: 'write',
        line: currentLine,
        description: `${srcOf(target)} = ${formatValue(next)}   (${srcOf(node)})`,
        result: next,
        focus: {
          varName: target.object.type === 'Identifier' ? target.object.name : undefined,
          arrayIndex: Array.isArray(obj) && typeof key === 'number' ? key : undefined,
          objectKey: !Array.isArray(obj) ? String(key) : undefined,
          indexVarName: target.computed && target.property.type === 'Identifier' ? target.property.name : undefined,
          heapId: obj && typeof obj === 'object' ? heapIdOf(obj as object) : undefined,
        },
      })
      const out = node.prefix ? next : old
      recordTrail(node, out)
      return out
    }
    throw new Error(`Unsupported update target: ${node.argument.type}`)
  }

  function applyBinary(op: string, l: RTValue, r: RTValue): RTValue {
    switch (op) {
      case '+': return (typeof l === 'string' || typeof r === 'string') ? (formatValue(l) + formatValue(r)) : ((l as number) + (r as number))
      case '-': return (l as number) - (r as number)
      case '*': return (l as number) * (r as number)
      case '/': return (l as number) / (r as number)
      case '%': return (l as number) % (r as number)
      case '**': return (l as number) ** (r as number)
      case '==': return l == r
      case '!=': return l != r
      case '===': return l === r
      case '!==': return l !== r
      case '<': return (l as number) < (r as number)
      case '<=': return (l as number) <= (r as number)
      case '>': return (l as number) > (r as number)
      case '>=': return (l as number) >= (r as number)
      case '&': return (l as number) & (r as number)
      case '|': return (l as number) | (r as number)
      case '^': return (l as number) ^ (r as number)
      case '<<': return (l as number) << (r as number)
      case '>>': return (l as number) >> (r as number)
      default: throw new Error(`Unsupported binary operator: ${op}`)
    }
  }

  function evalAssignment(node: any, scope: Scope): RTValue {
    const op = node.operator
    if (node.left.type === 'Identifier') {
      const name = node.left.name
      const { value: rhs, trail } = evalWithTrail(node.right, scope)
      let value = rhs
      if (op !== '=') {
        const cur = lookup(scope, name) ?? 0
        const baseOp = op.slice(0, -1) // strip '='
        value = applyBinary(baseOp, cur, rhs)
      }
      setVar(scope, name, value)
      currentLine = node.loc?.start.line ?? currentLine
      pushStep({
        kind: 'assign',
        line: currentLine,
        description: `${name} = ${formatValue(value)}`,
        result: asPrim(value),
        exprTrail: op === '=' ? trailOrUndef(trail) : undefined,
        focus: {
          varName: name,
          heapId: value !== null && typeof value === 'object' ? heapIdOf(value as object) : undefined,
        },
      })
      return value
    }
    if (node.left.type === 'MemberExpression') {
      const obj = evalExpr(node.left.object, scope)
      let key: string | number
      if (node.left.computed) {
        key = evalExpr(node.left.property, scope) as string | number
      } else {
        key = node.left.property.name
      }
      const { value: rhs, trail } = evalWithTrail(node.right, scope)
      let value = rhs
      if (op !== '=') {
        const cur = Array.isArray(obj) ? obj[key as number] : (obj as any)?.[key]
        const baseOp = op.slice(0, -1)
        value = applyBinary(baseOp, cur, rhs)
      }
      noteIndexVar(node.left.object, node.left.property, node.left.computed)
      if (Array.isArray(obj) && typeof key === 'number') {
        obj[key] = value
        currentLine = node.loc?.start.line ?? currentLine
        pushStep({
          kind: 'write',
          line: currentLine,
          description: `${srcOf(node.left.object)}[${key}] = ${formatValue(value)}`,
          result: asPrim(value),
          exprTrail: op === '=' ? trailOrUndef(trail) : undefined,
          focus: {
            varName: node.left.object.type === 'Identifier' ? node.left.object.name : undefined,
            arrayIndex: key,
            indexVarName: node.left.computed && node.left.property.type === 'Identifier' ? node.left.property.name : undefined,
            heapId: heapIdOf(obj),
          },
        })
      } else if (obj && typeof obj === 'object') {
        ;(obj as any)[String(key)] = value
        currentLine = node.loc?.start.line ?? currentLine
        pushStep({
          kind: 'write',
          line: currentLine,
          description: `${srcOf(node.left.object)}.${key} = ${formatValue(value)}`,
          result: asPrim(value),
          exprTrail: op === '=' ? trailOrUndef(trail) : undefined,
          focus: {
            varName: node.left.object.type === 'Identifier' ? node.left.object.name : undefined,
            objectKey: String(key),
            heapId: heapIdOf(obj as object),
          },
        })
      }
      return value
    }
    throw new Error(`Unsupported assignment target: ${node.left.type}`)
  }

  function evalCall(node: any, scope: Scope): RTValue {
    // Resolve callee.
    let fn: any
    let thisArg: any = undefined
    let calleeLabel: string
    if (node.callee.type === 'MemberExpression') {
      thisArg = evalExpr(node.callee.object, scope)
      let key: string | number
      if (node.callee.computed) {
        key = evalExpr(node.callee.property, scope) as string | number
      } else {
        key = node.callee.property.name
      }
      if (Array.isArray(thisArg)) {
        fn = arrayMethod(thisArg, key as string)
      } else if (thisArg && typeof thisArg === 'object') {
        fn = (thisArg as any)[String(key)]
      } else if (typeof thisArg === 'string') {
        fn = stringMethod(thisArg, key as string)
      } else {
        fn = (thisArg as any)?.[String(key)]
      }
      calleeLabel = `${srcOf(node.callee.object)}.${key}`
    } else {
      fn = evalExpr(node.callee, scope)
      calleeLabel = node.callee.name ?? 'anonymous'
    }
    if (typeof fn !== 'function') {
      throw new Error(`${calleeLabel} is not a function`)
    }

    // console.log gets special treatment so the output step can carry an
    // expression trail for its (single) argument.
    if (fn === consoleLog) {
      const args: RTValue[] = []
      let trail: string[] | undefined
      const single = node.arguments.length === 1 && node.arguments[0].type !== 'SpreadElement'
      for (const a of node.arguments) {
        if (a.type === 'SpreadElement') {
          const v = evalExpr(a.argument, scope)
          if (Array.isArray(v)) args.push(...v)
        } else if (single) {
          const r = evalWithTrail(a, scope)
          args.push(r.value)
          trail = trailOrUndef(r.trail)
        } else {
          args.push(evalExpr(a, scope))
        }
      }
      const text = args.map(formatValue).join(' ')
      outputCount++
      currentLine = node.loc?.start.line ?? currentLine
      pushStep({
        kind: 'output',
        line: currentLine,
        description: `console.log → ${text}`,
        output: text,
        exprTrail: trail,
      })
      return undefined
    }

    // Spread args.
    const args: RTValue[] = []
    for (const a of node.arguments) {
      if (a.type === 'SpreadElement') {
        const v = evalExpr(a.argument, scope)
        if (Array.isArray(v)) args.push(...v)
      } else {
        args.push(evalExpr(a, scope))
      }
    }
    currentLine = node.loc?.start.line ?? currentLine
    // User functions are Function objects with a stored AST; we call them
    // through callUserFn so we can keep recording steps.
    if (fn.__userFn) {
      return callUserFn(fn, args, node, calleeLabel)
    }
    // Built-ins like Math.max are plain JS functions we just call.
    const result = fn.apply(thisArg, args)
    if (Array.isArray(thisArg) && node.callee.type === 'MemberExpression') {
      const methodName = node.callee.computed ? '' : node.callee.property.name
      if (methodName === 'push' || methodName === 'unshift' || methodName === 'pop' || methodName === 'shift') {
        currentLine = node.loc?.start.line ?? currentLine
        const arrLabel = srcOf(node.callee.object)
        const isAdd = methodName === 'push' || methodName === 'unshift'
        pushStep({
          kind: 'write',
          line: currentLine,
          description: isAdd
            ? `${arrLabel}.${methodName}(${args.map(formatValue).join(', ')})  → length ${thisArg.length}`
            : `${arrLabel}.${methodName}()  → ${formatValue(result)}`,
          focus: {
            varName: node.callee.object.type === 'Identifier' ? node.callee.object.name : undefined,
            arrayIndex: methodName === 'push' ? thisArg.length - 1 : methodName === 'unshift' ? 0 : undefined,
            heapId: heapIdOf(thisArg),
          },
        })
      }
    }
    return result
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  function makeUserFn(node: any, scope: Scope, nameHint?: string): any {
    const fn = function () { /* interpreted */ } as any
    fn.__userFn = true
    fn.__params = node.params
    fn.__body = node.body
    fn.__exprBody = node.type === 'ArrowFunctionExpression' && node.body.type !== 'BlockStatement'
    fn.__name = node.id?.name ?? nameHint ?? 'anonymous'
    fn.__closure = scope
    fn.__freeVars = collectFreeVars(node)
    fn.__loc = node.loc
      ? { line: node.loc.start.line, endLine: node.loc.end.line }
      : undefined
    return fn
  }

  function callUserFn(fn: any, args: RTValue[], callNode: any, calleeLabel: string): RTValue {
    const params = fn.__params as any[]
    const callLine = callNode.loc?.start.line ?? currentLine

    pushStep({
      kind: 'call',
      line: callLine,
      description: `Call ${calleeLabel}(${args.map(formatValue).join(', ')})`,
      callLine,
      fnLoc: fn.__loc,
    })

    const fnScope = newScope(fn.__closure ?? globalScope, fn.__name)
    const bindings: { name: string; value: string }[] = []
    for (let i = 0; i < params.length; i++) {
      const p = params[i]
      let name: string
      let val: RTValue = args[i]
      if (p.type === 'Identifier') {
        name = p.name
      } else if (p.type === 'AssignmentPattern' && p.left.type === 'Identifier') {
        name = p.left.name
        if (val === undefined) val = evalExpr(p.right, fnScope)
      } else if (p.type === 'RestElement' && p.argument.type === 'Identifier') {
        name = p.argument.name
        val = args.slice(i)
      } else {
        name = `arg${i}`
      }
      fnScope.vars.set(name, val)
      bindings.push({ name, value: formatValue(val) })
    }

    callStack.push({
      name: fn.__name,
      kind: 'function',
      callLine,
      rootScope: fnScope,
      currentScope: fnScope,
    })
    const prevLine = currentLine
    currentLine = fn.__loc?.line ?? prevLine
    pushStep({
      kind: 'enter',
      line: currentLine,
      description: `Enter ${fn.__name}(${bindings.map((b) => `${b.name} = ${b.value}`).join(', ')})`,
      callLine,
      fnLoc: fn.__loc,
      bindings,
    })

    let ret: RTValue = undefined
    let exitTrail: string[] | undefined
    try {
      if (fn.__exprBody) {
        const r = evalWithTrail(fn.__body, fnScope)
        ret = r.value
        exitTrail = trailOrUndef(r.trail)
      } else {
        execBody(fn.__body, fnScope)
      }
    } catch (e) {
      if (e instanceof ReturnSignal) {
        ret = e.value
      } else {
        callStack.pop()
        currentLine = prevLine
        throw e
      }
    }
    callStack.pop()
    currentLine = callLine
    pushStep({
      kind: 'return',
      line: currentLine,
      description: `${fn.__name} returned ${formatValue(ret)}`,
      result: asPrim(ret),
      exprTrail: exitTrail,
      callLine,
      fnLoc: fn.__loc,
    })
    return ret
  }

  // Array methods we support.
  function arrayMethod(arr: RTValue[], name: string): any {
    switch (name) {
      case 'push':
        return (...items: RTValue[]) => { arr.push(...items); return arr.length }
      case 'pop':
        return () => arr.pop()
      case 'shift':
        return () => arr.shift()
      case 'unshift':
        return (...items: RTValue[]) => { arr.unshift(...items); return arr.length }
      case 'slice':
        return (a?: number, b?: number) => arr.slice(a as number, b as number)
      case 'indexOf':
        return (x: RTValue) => arr.indexOf(x)
      case 'includes':
        return (x: RTValue) => arr.includes(x)
      case 'join':
        return (sep?: string) => arr.join(sep ?? ',')
      case 'reverse':
        return () => arr.reverse()
      case 'concat':
        return (...items: RTValue[]) => (arr as RTValue[]).concat(...(items as RTValue[][]))
      default:
        throw new Error(`Unsupported array method: ${name}`)
    }
  }

  function stringMethod(s: string, name: string): any {
    switch (name) {
      case 'toUpperCase': return () => s.toUpperCase()
      case 'toLowerCase': return () => s.toLowerCase()
      case 'charAt': return (i: number) => s.charAt(i)
      case 'charCodeAt': return (i: number) => s.charCodeAt(i)
      case 'slice': return (a?: number, b?: number) => s.slice(a as number, b as number)
      case 'split': return (sep: string) => s.split(sep)
      case 'includes': return (x: string) => s.includes(x)
      case 'indexOf': return (x: string) => s.indexOf(x)
      case 'repeat': return (n: number) => {
        // repeat runs in one step but can allocate an enormous string and hang
        // the tab, so cap it with a friendly error instead of freezing.
        if (n > 100000) {
          throw new Error(`.repeat(${n}) would build a huge string. Try a count of 100000 or less.`)
        }
        return s.repeat(n)
      }
      case 'trim': return () => s.trim()
      default: throw new Error(`Unsupported string method: ${name}`)
    }
  }

  // ---- statement execution ----------------------------------------------

  function execBody(node: any, scope: Scope) {
    // Hoist function declarations so calls above the declaration work.
    for (const stmt of node.body) {
      if (stmt.type === 'FunctionDeclaration' && stmt.id) {
        scope.vars.set(stmt.id.name, makeUserFn(stmt, scope))
      }
    }
    for (const stmt of node.body) {
      execStmt(stmt, scope)
    }
  }

  function execStmt(node: any, scope: Scope) {
    if (!node) return
    currentLine = node.loc?.start.line ?? currentLine
    switch (node.type) {
      case 'VariableDeclaration': {
        for (const decl of node.declarations) {
          if (decl.id.type !== 'Identifier') {
            throw new Error('Destructuring declarations are not supported yet')
          }
          let value: RTValue = undefined
          let trail: string[] | undefined
          if (decl.init) {
            const r = evalWithTrail(decl.init, scope)
            value = r.value
            trail = trailOrUndef(r.trail)
          }
          // Give anonymous function values the variable's name.
          if (typeof value === 'function' && (value as any).__userFn && (value as any).__name === 'anonymous') {
            ;(value as any).__name = decl.id.name
          }
          scope.vars.set(decl.id.name, value)
          currentLine = decl.loc?.start.line ?? currentLine
          pushStep({
            kind: 'declare',
            line: currentLine,
            description: `${node.kind} ${decl.id.name}${decl.init ? ' = ' + formatValue(value) : ''}`,
            result: asPrim(value),
            exprTrail: trail,
            focus: {
              varName: decl.id.name,
              heapId: value !== null && typeof value === 'object' ? heapIdOf(value as object) : undefined,
            },
          })
        }
        return
      }
      case 'ExpressionStatement': {
        evalExpr(node.expression, scope)
        return
      }
      case 'BlockStatement': {
        const blockScope = newScope(scope, 'block')
        withScope(blockScope, () => execBody(node, blockScope))
        return
      }
      case 'IfStatement': {
        currentLine = node.test.loc?.start.line ?? currentLine
        const { value: cond, trail } = evalWithTrail(node.test, scope)
        pushStep({
          kind: 'condition',
          line: currentLine,
          description: `if (${describeTest(node.test)}) → ${cond ? 'true' : 'false'}`,
          conditionResult: !!cond,
          exprTrail: trailOrUndef(trail),
        })
        pushStep({
          kind: 'branch',
          line: (cond ? node.consequent : node.alternate)?.loc?.start.line ?? currentLine,
          description: cond ? 'Take if-branch' : (node.alternate ? 'Take else-branch' : 'Skip (no else)'),
        })
        if (cond) execStmt(node.consequent, scope)
        else if (node.alternate) execStmt(node.alternate, scope)
        return
      }
      case 'ForStatement': {
        const loopScope = newScope(scope, 'for')
        withScope(loopScope, () => {
          let iter = 0
          if (node.init) {
            if (node.init.type === 'VariableDeclaration') execStmt(node.init, loopScope)
            else evalExpr(node.init, loopScope)
          }
          currentLine = node.loc?.start.line ?? currentLine
          pushStep({ kind: 'loop-start', line: currentLine, description: 'for loop begins', iteration: 0 })
          while (true) {
            if (node.test) {
              currentLine = node.test.loc?.start.line ?? currentLine
              const { value: c, trail } = evalWithTrail(node.test, loopScope)
              pushStep({
                kind: 'loop-check',
                line: currentLine,
                description: `Check condition (${describeTest(node.test)}) → ${c ? 'true → iterate' : 'false → exit'}`,
                conditionResult: !!c,
                iteration: iter,
                exprTrail: trailOrUndef(trail),
              })
              if (!c) break
            }
            try {
              execStmt(node.body, loopScope)
            } catch (e) {
              if (e instanceof BreakSignal) break
              if (!(e instanceof ContinueSignal)) throw e
            }
            if (node.update) {
              currentLine = node.update.loc?.start.line ?? currentLine
              evalExpr(node.update, loopScope)
            }
            iter++
            pushStep({
              kind: 'loop-iter',
              line: currentLine,
              description: `Iteration ${iter} complete`,
              iteration: iter,
            })
          }
          pushStep({ kind: 'loop-end', line: currentLine, description: `for loop ended after ${iter} iteration(s)` })
        })
        return
      }
      case 'WhileStatement': {
        let iter = 0
        currentLine = node.loc?.start.line ?? currentLine
        pushStep({ kind: 'loop-start', line: currentLine, description: 'while loop begins', iteration: 0 })
        while (true) {
          currentLine = node.test.loc?.start.line ?? currentLine
          const { value: c, trail } = evalWithTrail(node.test, scope)
          pushStep({
            kind: 'loop-check',
            line: currentLine,
            description: `Check (${describeTest(node.test)}) → ${c ? 'true → iterate' : 'false → exit'}`,
            conditionResult: !!c,
            iteration: iter,
            exprTrail: trailOrUndef(trail),
          })
          if (!c) break
          try {
            execStmt(node.body, scope)
          } catch (e) {
            if (e instanceof BreakSignal) break
            if (!(e instanceof ContinueSignal)) throw e
          }
          iter++
          pushStep({
            kind: 'loop-iter',
            line: currentLine,
            description: `Iteration ${iter} complete`,
            iteration: iter,
          })
        }
        pushStep({ kind: 'loop-end', line: currentLine, description: `while loop ended after ${iter} iteration(s)` })
        return
      }
      case 'DoWhileStatement': {
        let iter = 0
        currentLine = node.loc?.start.line ?? currentLine
        pushStep({ kind: 'loop-start', line: currentLine, description: 'do-while loop begins', iteration: 0 })
        do {
          try {
            execStmt(node.body, scope)
          } catch (e) {
            if (e instanceof BreakSignal) break
            if (!(e instanceof ContinueSignal)) throw e
          }
          iter++
          currentLine = node.test.loc?.start.line ?? currentLine
          const { value: c, trail } = evalWithTrail(node.test, scope)
          pushStep({
            kind: 'loop-check',
            line: currentLine,
            description: `Check (${describeTest(node.test)}) → ${c ? 'true → repeat' : 'false → exit'}`,
            conditionResult: !!c,
            iteration: iter,
            exprTrail: trailOrUndef(trail),
          })
          if (!c) break
        } while (true)
        pushStep({ kind: 'loop-end', line: currentLine, description: `do-while loop ended after ${iter} iteration(s)` })
        return
      }
      case 'ForOfStatement': {
        const loopScope = newScope(scope, 'for-of')
        withScope(loopScope, () => {
          const arr = evalExpr(node.right, scope) as RTValue[]
          currentLine = node.loc?.start.line ?? currentLine
          pushStep({ kind: 'loop-start', line: currentLine, description: `for...of begins over array of ${Array.isArray(arr) ? arr.length : 0} items`, iteration: 0 })
          let i = 0
          for (const item of Array.isArray(arr) ? arr : []) {
            const name = node.left.type === 'VariableDeclaration' ? node.left.declarations[0].id.name : node.left.name
            loopScope.vars.set(name, item)
            currentLine = node.left.loc?.start.line ?? currentLine
            pushStep({
              kind: 'loop-iter',
              line: currentLine,
              description: `${name} = ${formatValue(item)}  (item ${i + 1}/${Array.isArray(arr) ? arr.length : 0})`,
              iteration: i,
              focus: { varName: name },
            })
            try {
              execStmt(node.body, loopScope)
            } catch (e) {
              if (e instanceof BreakSignal) break
              if (!(e instanceof ContinueSignal)) throw e
            }
            i++
          }
          pushStep({ kind: 'loop-end', line: currentLine, description: `for...of ended after ${i} iteration(s)` })
        })
        return
      }
      case 'FunctionDeclaration': {
        // Already hoisted by execBody; just announce the declaration.
        const fn = node.id ? scope.vars.get(node.id.name) : undefined
        currentLine = node.loc?.start.line ?? currentLine
        pushStep({
          kind: 'declare',
          line: currentLine,
          description: `function ${node.id?.name ?? 'anonymous'}(${node.params.map((p: any) => p.name ?? '…').join(', ')}) declared`,
          fnLoc: (fn as any)?.__loc,
          focus: { varName: node.id?.name },
        })
        return
      }
      case 'ReturnStatement': {
        let v: RTValue = undefined
        let trail: string[] | undefined
        if (node.argument) {
          const r = evalWithTrail(node.argument, scope)
          v = r.value
          trail = trailOrUndef(r.trail)
        }
        currentLine = node.loc?.start.line ?? currentLine
        pushStep({
          kind: 'return',
          line: currentLine,
          description: `return ${formatValue(v)}`,
          result: asPrim(v),
          exprTrail: trail,
        })
        throw new ReturnSignal(v)
      }
      case 'BreakStatement':
        throw new BreakSignal()
      case 'ContinueStatement':
        throw new ContinueSignal()
      case 'ThrowStatement':
        throw new Error(String(evalExpr(node.argument, scope)))
      case 'TryStatement': {
        try {
          execStmt(node.block, scope)
        } catch (e: unknown) {
          if (
            e instanceof ReturnSignal ||
            e instanceof BreakSignal ||
            e instanceof ContinueSignal ||
            e instanceof StepLimitSignal
          )
            throw e
          if (node.handler) {
            const catchScope = newScope(scope, 'catch')
            if (node.handler.param) {
              const msg: RTValue = e instanceof Error ? e.message : `${e}`
              catchScope.vars.set(node.handler.param.name, msg)
            }
            withScope(catchScope, () => execStmt(node.handler.body, catchScope))
          }
        } finally {
          if (node.finalizer) execStmt(node.finalizer, scope)
        }
        return
      }
      case 'EmptyStatement':
        return
      case 'DebuggerStatement':
        return
      default:
        throw new Error(`Unsupported statement: ${node.type}`)
    }
  }

  // ---- helpers for human-readable step descriptions ---------------------

  function describeTest(node: any): string {
    // Render the test expression back to source-ish text using the literal
    // source slice, so the description shows the actual condition.
    if (typeof node.start === 'number' && typeof node.end === 'number') {
      return source.slice(node.start, node.end).replace(/\s+/g, ' ').trim()
    }
    return '?'
  }

  function asPrim(v: RTValue): Primitive {
    return (v === null || v === undefined || typeof v !== 'object') && typeof v !== 'function'
      ? (v as Primitive)
      : JSON.stringify(v)
  }

  // ---- main -------------------------------------------------------------

  let ast: any
  try {
    ast = parse(source, {
      ecmaVersion: 'latest',
      sourceType: 'script',
      locations: true,
      ranges: true,
    })
  } catch (e) {
    const err = e as Error & { loc?: { line: number; column: number }; pos?: number }
    throw new ParseError(`Parse error: ${err.message}`, err.loc?.line ?? 1, err.loc?.column ?? 0, err.pos ?? 0)
  }

  // ---- event loop: drain queues after synchronous code finishes -----------
  function drainMicrotasks() {
    while (microtaskQueue.length) {
      asyncPhase = 'microtask'
      const t = microtaskQueue.shift()!
      pushStep({ kind: 'dequeue', line: currentLine, description: `Event loop: run microtask ${t.label}` })
      t.run()
    }
  }
  function runEventLoop() {
    drainMicrotasks()
    while (webApiTimers.length || macrotaskQueue.length) {
      if (macrotaskQueue.length === 0) {
        // A timer expires: move the earliest-due one from Web APIs to the
        // (macro)task queue, then the event loop can pick it up.
        webApiTimers.sort((a, b) => a.delay - b.delay)
        const timer = webApiTimers.shift()!
        asyncPhase = 'macrotask'
        macrotaskQueue.push({ label: timer.label.replace(/ · \d+ms$/, ''), run: timer.run })
        pushStep({ kind: 'schedule', line: currentLine, description: `Timer fired: ${timer.label} moves to the task queue` })
      }
      asyncPhase = 'macrotask'
      const t = macrotaskQueue.shift()!
      pushStep({ kind: 'dequeue', line: currentLine, description: `Event loop: run task ${t.label}` })
      t.run()
      drainMicrotasks()
    }
    asyncPhase = 'sync'
  }

  // Run the program. A StepLimitSignal means we hit the step cap — likely an
  // infinite loop or runaway recursion. We keep the partial trace and diagnose
  // it rather than throwing everything away.
  let truncated = false
  let stackOverflow = false
  try {
    execBody(ast, globalScope)
    if (usedAsync) runEventLoop()
  } catch (e) {
    if (e instanceof ReturnSignal) {
      // top-level return, ignore
    } else if (e instanceof StepLimitSignal) {
      truncated = true
    } else if (e instanceof RangeError && /call stack/i.test(e.message)) {
      // Native call-stack overflow — almost always runaway recursion. Keep the
      // partial trace so the user can watch the stack grow toward the overflow.
      truncated = true
      stackOverflow = true
    } else {
      throw e
    }
  }

  const stopReason = !truncated
    ? undefined
    : stackOverflow
      ? 'Ran out of call-stack space — this is runaway recursion. Make sure every path reaches a base case that returns without calling itself again.'
      : diagnoseTruncation(steps, maxSteps)

  // Add a final terminal step so the UI has a clean last frame — labeled to
  // reflect whether we finished or were stopped at the limit.
  {
    const { frames, heap } = snapshotState()
    const done: Step = {
      kind: 'expr',
      line: lines.length,
      description: truncated
        ? stackOverflow
          ? 'Stopped — call stack overflowed (runaway recursion)'
          : `Stopped — reached the ${maxSteps}-step limit`
        : 'Execution finished',
      frames,
      heap,
      depth: 0,
    }
    if (usedAsync) done.async = asyncSnapshot()
    steps.push(done)
  }

  const indexVars: Record<string, string[]> = {}
  for (const [arr, set] of indexVarsMap) indexVars[arr] = [...set]

  const warnings = computeWarnings(ast)

  return {
    steps,
    lines,
    outputCount,
    indexVars,
    hoisting: computeHoisting(ast),
    hasAsync: usedAsync,
    truncated,
    stopReason,
    warnings: warnings.length ? warnings : undefined,
  }
}

// ---------------------------------------------------------------------------
// Static analysis helpers (pure — no interpreter state)
// ---------------------------------------------------------------------------

// Collect the names bound by a (possibly destructuring) parameter / pattern.
function collectPatternNames(node: any, out: Set<string>): void {
  if (!node) return
  switch (node.type) {
    case 'Identifier': out.add(node.name); break
    case 'AssignmentPattern': collectPatternNames(node.left, out); break
    case 'RestElement': collectPatternNames(node.argument, out); break
    case 'ArrayPattern': for (const e of node.elements) collectPatternNames(e, out); break
    case 'ObjectPattern':
      for (const p of node.properties) {
        collectPatternNames(p.type === 'RestElement' ? p.argument : p.value, out)
      }
      break
  }
}

// The free variables of a function: identifiers it references that are not its
// own parameters and not declared anywhere inside it. These are the names that
// must come from an enclosing scope — i.e. closure candidates.
function collectFreeVars(fnNode: any): string[] {
  const declared = new Set<string>()
  const referenced = new Set<string>()
  for (const p of fnNode.params ?? []) collectPatternNames(p, declared)

  const visit = (node: any): void => {
    if (!node || typeof node !== 'object') return
    if (Array.isArray(node)) { for (const n of node) visit(n); return }
    if (typeof node.type !== 'string') return
    switch (node.type) {
      case 'VariableDeclarator':
        collectPatternNames(node.id, declared)
        visit(node.init)
        return
      case 'FunctionDeclaration':
        if (node.id) declared.add(node.id.name)
        for (const p of node.params) collectPatternNames(p, declared)
        visit(node.body)
        return
      case 'FunctionExpression':
      case 'ArrowFunctionExpression':
        for (const p of node.params) collectPatternNames(p, declared)
        visit(node.body)
        return
      case 'Identifier':
        referenced.add(node.name)
        return
      case 'MemberExpression':
        visit(node.object)
        if (node.computed) visit(node.property)
        return
      case 'Property':
        if (node.computed) visit(node.key)
        visit(node.value)
        return
      case 'CatchClause':
        if (node.param) collectPatternNames(node.param, declared)
        visit(node.body)
        return
      default:
        for (const k in node) {
          if (k === 'loc' || k === 'start' || k === 'end' || k === 'range' || k === 'type') continue
          visit(node[k])
        }
    }
  }
  visit(fnNode.body)

  const free: string[] = []
  for (const r of referenced) if (!declared.has(r)) free.push(r)
  return free
}

// Summarize the global scope's compile phase: hoisted functions and vars, and
// let/const bindings that live in the Temporal Dead Zone until they execute.
function computeHoisting(ast: any): HoistingInfo | undefined {
  const funcs: string[] = []
  const vars: string[] = []
  const tdz: { name: string; line: number; kind: 'let' | 'const' }[] = []
  for (const stmt of ast.body ?? []) {
    if (stmt.type === 'FunctionDeclaration' && stmt.id) {
      funcs.push(stmt.id.name)
    } else if (stmt.type === 'VariableDeclaration') {
      for (const d of stmt.declarations) {
        if (d.id.type !== 'Identifier') continue
        if (stmt.kind === 'var') vars.push(d.id.name)
        else tdz.push({ name: d.id.name, line: d.loc?.start.line ?? 1, kind: stmt.kind })
      }
    }
  }
  if (!funcs.length && !vars.length && !tdz.length) return undefined
  return { funcs, vars, tdz }
}

class ReturnSignal {
  constructor(public value: RTValue) {}
}
class BreakSignal {}
class ContinueSignal {}
// Thrown from pushStep when the step cap is reached; unwinds the whole run so
// the caller can keep the partial trace instead of losing everything.
class StepLimitSignal {}

// Look at the tail of a truncated run and decide whether it reads more like an
// infinite loop or runaway recursion, then return an actionable suggestion.
function diagnoseTruncation(steps: Step[], maxSteps: number): string {
  const tail = steps.slice(-60)
  const loopish = tail.filter((s) => s.kind.startsWith('loop')).length
  const callish = tail.filter((s) => s.kind === 'call' || s.kind === 'enter').length
  const maxDepth = steps.slice(-120).reduce((m, s) => Math.max(m, s.depth), 0)
  const prefix = `Stopped after ${maxSteps} steps. `
  if (callish >= loopish && maxDepth > 6) {
    return (
      prefix +
      `This looks like runaway recursion (call depth reached ${maxDepth}). ` +
      'Make sure every path hits a base case that returns without calling itself again.'
    )
  }
  if (loopish > 0) {
    return (
      prefix +
      'This looks like an infinite (or very long) loop. Check that the loop condition ' +
      'eventually becomes false and that you update the counter each iteration.'
    )
  }
  return (
    prefix +
    'The program produced too many steps to visualize. Try smaller inputs or fewer iterations.'
  )
}

// Cheap static hints surfaced as gentle, non-blocking suggestions. We keep this
// conservative — only flag patterns that are almost always mistakes.
function computeWarnings(ast: any): string[] {
  const warnings: string[] = []
  const seen = new Set<string>()
  const add = (msg: string) => {
    if (!seen.has(msg)) {
      seen.add(msg)
      warnings.push(msg)
    }
  }

  // Does a subtree contain a break/return that could exit the current loop?
  // (A return inside a nested function does NOT count, so we stop at fn bounds.)
  const hasLoopExit = (node: any): boolean => {
    if (!node || typeof node !== 'object') return false
    if (Array.isArray(node)) return node.some(hasLoopExit)
    if (typeof node.type !== 'string') return false
    if (node.type === 'BreakStatement' || node.type === 'ReturnStatement' || node.type === 'ThrowStatement') return true
    // Don't descend into nested loops (their break belongs to them) or functions.
    if (
      node.type === 'FunctionDeclaration' ||
      node.type === 'FunctionExpression' ||
      node.type === 'ArrowFunctionExpression' ||
      node.type === 'ForStatement' ||
      node.type === 'WhileStatement' ||
      node.type === 'DoWhileStatement' ||
      node.type === 'ForOfStatement' ||
      node.type === 'ForInStatement'
    ) {
      return false
    }
    for (const k in node) {
      if (k === 'loc' || k === 'start' || k === 'end' || k === 'range' || k === 'type') continue
      if (hasLoopExit(node[k])) return true
    }
    return false
  }

  const isTruthyLiteral = (t: any): boolean =>
    (t?.type === 'Literal' && !!t.value) ||
    (t?.type === 'Identifier' && t.name === 'true')

  const walk = (node: any): void => {
    if (!node || typeof node !== 'object') return
    if (Array.isArray(node)) {
      node.forEach(walk)
      return
    }
    if (typeof node.type !== 'string') return

    // while (true) / for (;;) with no reachable break or return.
    if (
      (node.type === 'WhileStatement' && isTruthyLiteral(node.test)) ||
      (node.type === 'ForStatement' && !node.test)
    ) {
      if (!hasLoopExit(node.body)) {
        add('Infinite loop: this loop has no exit condition and no break/return. Add a stopping condition or a break.')
      }
    }
    // Assignment used where a comparison was likely intended: if (x = y).
    if (node.type === 'IfStatement' && node.test?.type === 'AssignmentExpression' && node.test.operator === '=') {
      add('Possible mistake: "=" is assignment inside a condition. Did you mean "===" for comparison?')
    }

    for (const k in node) {
      if (k === 'loc' || k === 'start' || k === 'end' || k === 'range' || k === 'type') continue
      walk(node[k])
    }
  }
  walk(ast)
  return warnings
}

// ---------------------------------------------------------------------------
// Formatting helpers (also exported for use by the UI).
// ---------------------------------------------------------------------------

export function formatValue(v: unknown): string {
  if (v === null) return 'null'
  if (v === undefined) return 'undefined'
  if (typeof v === 'string') return v
  if (typeof v === 'number' || typeof v === 'boolean') return String(v)
  if (Array.isArray(v)) return '[' + v.map(formatQuoted).join(', ') + ']'
  if (typeof v === 'function') return `ƒ ${(v as any).__name ?? ''}()`
  if (typeof v === 'object') {
    return '{' + Object.entries(v as object).map(([k, val]) => `${k}: ${formatQuoted(val)}`).join(', ') + '}'
  }
  return String(v)
}

// Like formatValue but quotes strings — used inside containers and trails,
// where "apple" and apple must look different.
function formatQuoted(v: unknown): string {
  if (typeof v === 'string') return `"${v}"`
  return formatValue(v)
}

export function formatPrim(v: Primitive): string {
  if (typeof v === 'string') {
    const s = v.length > 24 ? v.slice(0, 24) + '…' : v
    return `"${s}"`
  }
  return formatValue(v)
}
