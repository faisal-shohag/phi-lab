'use client'

import { useMemo } from 'react'
import { motion } from 'framer-motion'
import { GitFork, Repeat, FunctionSquare, Workflow } from 'lucide-react'
import { cn } from '@/lib/utils'
import { buildFlowNodes, flowNodeStatus, type FlowNode } from '@/lib/visualizer/flow'
import type { Trace } from '@/lib/visualizer/types'

const ICON: Record<FlowNode['kind'], typeof GitFork> = {
  condition: GitFork,
  loop: Repeat,
  call: FunctionSquare,
}

const TONE: Record<FlowNode['kind'], string> = {
  condition: 'border-fuchsia-400 bg-fuchsia-500/10 text-fuchsia-800 dark:text-fuchsia-300',
  loop: 'border-violet-400 bg-violet-500/10 text-violet-800 dark:text-violet-300',
  call: 'border-teal-400 bg-teal-500/10 text-teal-800 dark:text-teal-300',
}

const RING: Record<FlowNode['kind'], string> = {
  condition: 'ring-fuchsia-400',
  loop: 'ring-violet-400',
  call: 'ring-teal-400',
}

// A live flowchart built from the trace: one node per if/loop/call site in
// source order, connected by a simple vertical spine. The node the playhead is
// currently inside lights up; each node also shows the outcome of its most
// recent pass (which branch was taken, how many iterations, call state).
export function FlowChart({
  trace,
  currentIndex,
  onJump,
}: {
  trace: Trace | null
  currentIndex: number
  onJump: (stepIndex: number) => void
}) {
  const nodes = useMemo(() => (trace ? buildFlowNodes(trace) : []), [trace])

  if (nodes.length === 0) {
    return (
      <div className="flex h-full items-center justify-center p-4 text-center text-xs text-muted-foreground">
        No branches, loops, or calls to chart in this snippet yet.
      </div>
    )
  }

  return (
    <div className="flex h-full flex-col">
      <div className="flex items-center gap-2 px-3 py-1.5 text-xs">
        <Workflow className="h-3.5 w-3.5 text-sky-500" />
        <span className="font-semibold">Control-flow chart</span>
        <span className="ml-auto text-muted-foreground tabular-nums">{nodes.length} node(s)</span>
      </div>
      <div className="min-h-0 flex-1 overflow-auto p-3">
        <div className="mx-auto flex max-w-md flex-col items-stretch">
          {nodes.map((node, i) => {
            const status = flowNodeStatus(node, currentIndex)
            const Icon = ICON[node.kind]
            return (
              <div key={node.id} className="flex flex-col items-center">
                {i > 0 && <div className="h-3 w-px bg-border" />}
                <motion.button
                  layout
                  onClick={() => onJump(status.latest?.stepIndex ?? node.occurrences[0].stepIndex)}
                  className={cn(
                    'w-full rounded-lg border-2 px-3 py-2 text-left transition-shadow',
                    TONE[node.kind],
                    status.active
                      ? cn('shadow-md ring-2 ring-offset-1 ring-offset-background', RING[node.kind])
                      : 'opacity-75 hover:opacity-100',
                  )}
                >
                  <div className="flex items-center gap-1.5 font-mono text-[12px] font-semibold">
                    <Icon className="h-3.5 w-3.5 shrink-0" />
                    <span className="truncate">{node.label}</span>
                    <span className="ml-auto shrink-0 text-[10px] font-normal text-muted-foreground">
                      L{node.line}
                    </span>
                  </div>
                  {node.kind === 'condition' && status.latest?.result !== undefined && (
                    <span
                      className={cn(
                        'mt-1 inline-block rounded px-1.5 py-0.5 text-[10px] font-bold text-white',
                        status.latest.result ? 'bg-emerald-500' : 'bg-rose-500',
                      )}
                    >
                      {status.latest.result ? 'true → if-branch taken' : 'false → else/skip'}
                    </span>
                  )}
                  {node.kind === 'loop' && status.latest && (
                    <span className="mt-1 inline-block font-mono text-[10px] text-muted-foreground">
                      {status.active ? 'running…' : `ran ${status.latest.totalIterations} time(s)`}
                    </span>
                  )}
                  {node.kind === 'call' && status.latest && (
                    <span className="mt-1 inline-block font-mono text-[10px] text-muted-foreground">
                      {status.active ? 'on call stack' : 'returned'}
                    </span>
                  )}
                </motion.button>
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}
