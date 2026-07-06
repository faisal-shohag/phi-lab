// Pure derivations over a finished Trace that power the opt-in learning views.
// Keeping them here (not in the page component) makes them testable and keeps
// the page lean. None of these mutate the trace.

import type { Step, Trace, ValueSnapshot } from './types'

function fmtVS(v: ValueSnapshot): string {
  if (v.t === 'ref') return `#${v.id}`
  const p = v.v
  if (p === null) return 'null'
  if (p === undefined) return 'undefined'
  if (typeof p === 'string') return `"${p}"`
  return String(p)
}

// Primitive locals of the innermost frame at a step — the "effects" columns.
function topPrimitiveVars(step: Step): { name: string; value: string }[] {
  const top = step.frames[step.frames.length - 1]
  if (!top) return []
  return top.vars
    .filter((v) => !v.closure && v.value.t === 'prim')
    .map((v) => ({ name: v.name, value: fmtVS(v.value) }))
}

// ---- console lane --------------------------------------------------------

export interface ConsoleEntry {
  text: string
  line: number
  stepIndex: number
}

export function consoleEntries(trace: Trace, uptoIndex: number): ConsoleEntry[] {
  const out: ConsoleEntry[] = []
  const limit = Math.min(uptoIndex, trace.steps.length - 1)
  for (let i = 0; i <= limit; i++) {
    const s = trace.steps[i]
    if (s.kind === 'output' && s.output != null) {
      out.push({ text: s.output, line: s.line, stepIndex: i })
    }
  }
  return out
}

// ---- loop unroll ---------------------------------------------------------

export interface LoopIteration {
  stepIndex: number
  iteration: number
  condResult?: boolean
  trail?: string[]
  label: string
  vars: { name: string; value: string }[]
}

export interface LoopModel {
  startIndex: number
  endIndex: number
  line: number
  kind: string
  iterations: LoopIteration[]
}

function loopKind(desc: string): string {
  if (desc.startsWith('for...of')) return 'for…of'
  if (desc.startsWith('for')) return 'for'
  if (desc.startsWith('while')) return 'while'
  if (desc.startsWith('do-while')) return 'do…while'
  return 'loop'
}

export function buildLoops(trace: Trace): LoopModel[] {
  const done: LoopModel[] = []
  const stack: LoopModel[] = []
  trace.steps.forEach((s, i) => {
    switch (s.kind) {
      case 'loop-start':
        stack.push({ startIndex: i, endIndex: i, line: s.line, kind: loopKind(s.description), iterations: [] })
        break
      case 'loop-check':
      case 'loop-iter': {
        const top = stack[stack.length - 1]
        if (!top) break
        // loop-check(false) is the exit test, not an iteration body — skip it.
        if (s.kind === 'loop-check' && s.conditionResult === false) break
        top.iterations.push({
          stepIndex: i,
          iteration: s.iteration ?? top.iterations.length,
          condResult: s.conditionResult,
          trail: s.exprTrail,
          label: s.description,
          vars: topPrimitiveVars(s),
        })
        break
      }
      case 'loop-end': {
        const top = stack.pop()
        if (top) {
          top.endIndex = i
          // for / while emit both a condition-check and an "iteration complete"
          // row per pass; keep just the check rows. for…of has only iter rows.
          if (top.iterations.some((it) => it.condResult !== undefined)) {
            top.iterations = top.iterations.filter((it) => it.condResult !== undefined)
          }
          done.push(top)
        }
        break
      }
    }
  })
  // Any loop left open (e.g. step budget hit) still gets shown.
  for (const open of stack) {
    open.endIndex = trace.steps.length - 1
    if (open.iterations.some((it) => it.condResult !== undefined)) {
      open.iterations = open.iterations.filter((it) => it.condResult !== undefined)
    }
    done.push(open)
  }
  return done.sort((a, b) => a.startIndex - b.startIndex)
}

// The innermost loop containing the current step, if any.
export function activeLoop(loops: LoopModel[], currentIndex: number): LoopModel | null {
  let best: LoopModel | null = null
  for (const l of loops) {
    if (currentIndex >= l.startIndex && currentIndex <= l.endIndex) {
      if (!best || l.startIndex > best.startIndex) best = l
    }
  }
  return best
}

// ---- recursion / call tree ----------------------------------------------

export interface CallNode {
  id: number
  name: string
  args: string
  enterIndex: number
  callLine?: number
  returnIndex?: number
  result?: string
  depth: number
  children: CallNode[]
}

export function buildCallTree(trace: Trace): { roots: CallNode[]; totalCalls: number } {
  const roots: CallNode[] = []
  const stack: CallNode[] = []
  let id = 0
  let total = 0

  trace.steps.forEach((s, i) => {
    if (s.kind === 'enter') {
      const name = /^Enter (\w+)/.exec(s.description)?.[1] ?? s.description
      const args = (s.bindings ?? []).map((b) => `${b.name}=${b.value}`).join(', ')
      const node: CallNode = {
        id: id++,
        name,
        args,
        enterIndex: i,
        callLine: s.callLine,
        depth: stack.length,
        children: [],
      }
      total++
      if (stack.length) stack[stack.length - 1].children.push(node)
      else roots.push(node)
      stack.push(node)
    } else if (s.kind === 'return') {
      const node = stack.pop()
      if (node) {
        node.returnIndex = i
        node.result = s.result === undefined ? 'undefined' : String(s.result)
      }
    }
  })
  return { roots, totalCalls: total }
}

// The id of the call whose frame is currently on top of the stack.
export function activeCallId(roots: CallNode[], currentIndex: number): number | null {
  let bestId: number | null = null
  let bestEnter = -1
  const walk = (n: CallNode) => {
    const closes = n.returnIndex ?? Infinity
    if (n.enterIndex <= currentIndex && currentIndex <= closes && n.enterIndex > bestEnter) {
      bestEnter = n.enterIndex
      bestId = n.id
    }
    n.children.forEach(walk)
  }
  roots.forEach(walk)
  return bestId
}
