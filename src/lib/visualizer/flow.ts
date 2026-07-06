// Derives a "control-flow chart" from a finished Trace: one node per distinct
// branch / loop / call site in the source, in source order, with enough
// history attached to say whether it's currently active and what happened
// last time the playhead passed through it. Built from the trace rather than
// a fresh AST walk so it reuses the same step data as the other feature views.

import type { Trace } from './types'
import { buildLoops, buildCallTree, type CallNode } from './features'

export type FlowKind = 'condition' | 'loop' | 'call'

export interface FlowOccurrence {
  stepIndex: number
  endIndex: number
  result?: boolean // condition
  totalIterations?: number // loop
  name?: string // call
  args?: string // call
}

export interface FlowNode {
  id: string
  kind: FlowKind
  line: number
  label: string
  occurrences: FlowOccurrence[]
}

function conditionLabel(description: string): string {
  // "if (score >= 90) → true" -> "score >= 90"
  const m = /^if \((.*)\) → (?:true|false)$/.exec(description)
  return m ? m[1] : description
}

export function buildFlowNodes(trace: Trace): FlowNode[] {
  const byKey = new Map<string, FlowNode>()
  const order: string[] = []

  function ensure(kind: FlowKind, line: number, label: string): FlowNode {
    const key = `${kind}:${line}`
    let n = byKey.get(key)
    if (!n) {
      n = { id: key, kind, line, label, occurrences: [] }
      byKey.set(key, n)
      order.push(key)
    }
    return n
  }

  trace.steps.forEach((s, i) => {
    if (s.kind === 'condition') {
      const n = ensure('condition', s.line, conditionLabel(s.description))
      n.occurrences.push({ stepIndex: i, endIndex: i, result: s.conditionResult })
    }
  })

  for (const loop of buildLoops(trace)) {
    const n = ensure('loop', loop.line, `${loop.kind} loop`)
    n.occurrences.push({
      stepIndex: loop.startIndex,
      endIndex: loop.endIndex,
      totalIterations: loop.iterations.length,
    })
  }

  const { roots } = buildCallTree(trace)
  const walk = (node: CallNode) => {
    if (node.callLine != null) {
      const n = ensure('call', node.callLine, `${node.name}()`)
      n.occurrences.push({
        stepIndex: node.enterIndex,
        endIndex: node.returnIndex ?? trace.steps.length - 1,
        name: node.name,
        args: node.args,
      })
    }
    node.children.forEach(walk)
  }
  roots.forEach(walk)

  return order.map((k) => byKey.get(k)!).sort((a, b) => a.line - b.line)
}

export interface FlowStatus {
  // The playhead is currently inside one of this node's occurrences.
  active: boolean
  // The most recent occurrence at or before the current step (so the node can
  // keep showing "last time" info even after the playhead has moved past it).
  latest?: FlowOccurrence
}

export function flowNodeStatus(node: FlowNode, currentIndex: number): FlowStatus {
  let active = false
  let latest: FlowOccurrence | undefined
  for (const occ of node.occurrences) {
    if (currentIndex >= occ.stepIndex && currentIndex <= occ.endIndex) active = true
    if (occ.stepIndex <= currentIndex) latest = occ
  }
  return { active, latest }
}
