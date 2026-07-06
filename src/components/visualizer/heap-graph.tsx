'use client'

import { useMemo } from 'react'
import {
  Background,
  BackgroundVariant,
  Controls,
  Handle,
  Position,
  ReactFlow,
  type Edge,
  type Node,
  type NodeProps,
} from '@xyflow/react'
import '@xyflow/react/dist/style.css'
import { cn } from '@/lib/utils'
import type { HeapSnapshot, Step, ValueSnapshot } from '@/lib/visualizer/types'

// ---------------------------------------------------------------------------
// Custom nodes
// ---------------------------------------------------------------------------

interface VarNodeData extends Record<string, unknown> {
  name: string
  frame: string
}

function VariableNode({ data }: NodeProps<Node<VarNodeData>>) {
  return (
    <div className="rounded-md border-2 border-amber-400 bg-amber-50 dark:bg-amber-950/70 px-2.5 py-1.5 shadow-sm">
      <div className="text-[9px] uppercase tracking-wide text-muted-foreground leading-none">{data.frame}</div>
      <div className="font-mono text-xs font-bold text-foreground leading-tight mt-0.5">{data.name}</div>
      <Handle type="source" position={Position.Right} className="!bg-amber-500 !w-2 !h-2" />
    </div>
  )
}

interface HeapNodeData extends Record<string, unknown> {
  snap: HeapSnapshot
  focused: boolean
  focusIndex?: number
  focusKey?: string
  touchKind?: 'read' | 'write'
}

function HeapNode({ data }: NodeProps<Node<HeapNodeData>>) {
  const { snap, focused, focusIndex, focusKey, touchKind } = data
  const ring = focused
    ? touchKind === 'write'
      ? 'ring-2 ring-rose-500'
      : 'ring-2 ring-sky-500'
    : ''
  return (
    <div className={cn('rounded-lg border-2 border-border bg-card px-2 py-1.5 shadow-md', ring)}>
      <Handle type="target" position={Position.Left} className="!bg-slate-400 !w-2 !h-2" />
      <div className="text-[9px] uppercase tracking-wide text-muted-foreground leading-none mb-1">
        {snap.kind} #{snap.id}
      </div>
      {snap.kind === 'array' && (
        <div className="flex flex-wrap gap-1">
          {(snap.cells ?? []).map((c, i) => (
            <div
              key={i}
              className={cn(
                'flex flex-col items-center rounded border px-1.5 py-0.5 font-mono',
                focusIndex === i ? 'border-rose-500 bg-rose-100 dark:bg-rose-950/60' : 'border-border bg-background',
              )}
            >
              <span className="text-[8px] text-muted-foreground leading-none">{i}</span>
              <span className="text-[11px] font-bold leading-tight">{cellShort(c)}</span>
            </div>
          ))}
          {(snap.cells ?? []).length === 0 && <span className="text-[10px] text-muted-foreground italic">[ ]</span>}
        </div>
      )}
      {snap.kind === 'object' && (
        <div className="font-mono text-[11px] space-y-0.5">
          {(snap.fields ?? []).map((f) => (
            <div key={f.key} className={cn('flex gap-1.5 rounded px-0.5', focusKey === f.key && 'bg-amber-200/50')}>
              <span className="text-muted-foreground">{f.key}:</span>
              <span className="font-semibold">{cellShort(f.value)}</span>
            </div>
          ))}
          {(snap.fields ?? []).length === 0 && <span className="text-[10px] text-muted-foreground italic">{'{ }'}</span>}
        </div>
      )}
      {snap.kind === 'function' && (
        <div className="font-mono text-xs text-teal-600 dark:text-teal-400">ƒ {snap.label ?? ''}()</div>
      )}
      {(snap.kind === 'array' || snap.kind === 'object') && hasRefs(snap) && (
        <Handle type="source" position={Position.Right} className="!bg-slate-400 !w-2 !h-2" />
      )}
    </div>
  )
}

function cellShort(v: ValueSnapshot): string {
  if (v.t === 'prim') {
    const p = v.v
    if (p === null) return 'null'
    if (p === undefined) return '—'
    return typeof p === 'string' ? `"${p}"` : String(p)
  }
  return `→#${v.id}`
}

function hasRefs(snap: HeapSnapshot): boolean {
  if (snap.cells) return snap.cells.some((c) => c.t === 'ref')
  if (snap.fields) return snap.fields.some((f) => f.value.t === 'ref')
  return false
}

const nodeTypes = { variable: VariableNode, heap: HeapNode }

// ---------------------------------------------------------------------------
// Graph builder — deterministic column layout, no external layout engine.
// ---------------------------------------------------------------------------

const VAR_X = 0
const COL_W = 240
const ROW_H = 92
const VAR_ROW_H = 64

function buildGraph(step: Step | undefined): { nodes: Node[]; edges: Edge[] } {
  if (!step) return { nodes: [], edges: [] }
  const nodes: Node[] = []
  const edges: Edge[] = []

  // Only heap objects referenced by at least one variable (or transitively)
  // are laid out. BFS from variables to assign columns by reference depth.
  const refDepth = new Map<number, number>()
  const heapById = new Map(step.heap.map((h) => [h.id, h]))

  // Collect variable refs (skip functions to keep the graph about data).
  const varRefs: { name: string; frame: string; id: number }[] = []
  for (const frame of step.frames) {
    for (const v of frame.vars) {
      if (v.value.t === 'ref') {
        varRefs.push({ name: v.name, frame: frame.kind === 'global' ? 'global' : `${frame.name}()`, id: v.value.id })
      }
    }
  }

  // BFS to compute depths.
  const queue: { id: number; depth: number }[] = varRefs.map((r) => ({ id: r.id, depth: 0 }))
  while (queue.length) {
    const { id, depth } = queue.shift()!
    const prev = refDepth.get(id)
    if (prev !== undefined && prev >= depth) continue
    refDepth.set(id, Math.max(prev ?? 0, depth))
    const snap = heapById.get(id)
    if (!snap) continue
    const children: number[] = []
    if (snap.cells) for (const c of snap.cells) if (c.t === 'ref') children.push(c.id)
    if (snap.fields) for (const f of snap.fields) if (f.value.t === 'ref') children.push(f.value.id)
    for (const cid of children) queue.push({ id: cid, depth: depth + 1 })
  }

  // Variable nodes, left column.
  varRefs.forEach((r, i) => {
    nodes.push({
      id: `var-${r.frame}-${r.name}-${i}`,
      type: 'variable',
      position: { x: VAR_X, y: i * VAR_ROW_H },
      data: { name: r.name, frame: r.frame } satisfies VarNodeData,
      draggable: true,
    })
    edges.push({
      id: `e-var-${i}`,
      source: `var-${r.frame}-${r.name}-${i}`,
      target: `heap-${r.id}`,
      animated: step.focus?.heapId === r.id,
      style: { stroke: '#f59e0b' },
    })
  })

  // Heap nodes, columns by depth.
  const perColumn = new Map<number, number>()
  const sortedHeap = [...refDepth.entries()].sort((a, b) => a[0] - b[0])
  for (const [id, depth] of sortedHeap) {
    const snap = heapById.get(id)
    if (!snap) continue
    const row = perColumn.get(depth) ?? 0
    perColumn.set(depth, row + 1)
    const focused = step.focus?.heapId === id
    nodes.push({
      id: `heap-${id}`,
      type: 'heap',
      position: { x: COL_W + depth * COL_W, y: row * ROW_H },
      data: {
        snap,
        focused,
        focusIndex: focused ? step.focus?.arrayIndex : undefined,
        focusKey: focused ? step.focus?.objectKey : undefined,
        touchKind: step.kind === 'write' ? 'write' : step.kind === 'read' ? 'read' : undefined,
      } satisfies HeapNodeData,
      draggable: true,
    })
    // Edges to nested refs.
    const childRefs: { cid: number; label: string }[] = []
    if (snap.cells) snap.cells.forEach((c, i) => { if (c.t === 'ref') childRefs.push({ cid: c.id, label: `${i}` }) })
    if (snap.fields) snap.fields.forEach((f) => { if (f.value.t === 'ref') childRefs.push({ cid: f.value.id, label: f.key }) })
    for (const { cid, label } of childRefs) {
      edges.push({
        id: `e-heap-${id}-${cid}-${label}`,
        source: `heap-${id}`,
        target: `heap-${cid}`,
        label,
        style: { stroke: '#94a3b8' },
      })
    }
  }

  return { nodes, edges }
}

export function HeapGraph({ step }: { step?: Step }) {
  const { nodes, edges } = useMemo(() => buildGraph(step), [step])

  if (nodes.length === 0) {
    return (
      <div className="h-full flex items-center justify-center text-sm text-muted-foreground italic px-4 text-center">
        No arrays or objects on the heap yet. Declare an array or object to see references here.
      </div>
    )
  }

  return (
    <div className="h-full w-full">
      <ReactFlow
        nodes={nodes}
        edges={edges}
        nodeTypes={nodeTypes}
        fitView
        fitViewOptions={{ padding: 0.2 }}
        minZoom={0.3}
        maxZoom={1.75}
        proOptions={{ hideAttribution: true }}
        nodesConnectable={false}
        edgesFocusable={false}
      >
        <Background variant={BackgroundVariant.Dots} gap={16} size={1} className="opacity-50" />
        <Controls showInteractive={false} className="!shadow-md" />
      </ReactFlow>
    </div>
  )
}
