'use client'

import { AnimatePresence, motion } from 'framer-motion'
import { GitBranch } from 'lucide-react'
import type { CallNode } from '@/lib/visualizer/features'
import { cn } from '@/lib/utils'

function TreeNode({
  node,
  currentIndex,
  activeId,
  onJump,
}: {
  node: CallNode
  currentIndex: number
  activeId: number | null
  onJump: (stepIndex: number) => void
}) {
  if (node.enterIndex > currentIndex) return null
  const returned = node.returnIndex !== undefined && node.returnIndex <= currentIndex
  const isActive = node.id === activeId

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: -4, scale: 0.96 }}
      animate={{ opacity: returned && !isActive ? 0.65 : 1, y: 0, scale: 1 }}
      transition={{ duration: 0.2 }}
      className="ml-3 border-l border-dashed border-border pl-3"
    >
      <button
        onClick={() => onJump(node.enterIndex)}
        className={cn(
          'my-0.5 flex items-center gap-1.5 rounded-md border px-2 py-1 text-left font-mono text-[12px] transition-colors',
          isActive
            ? 'border-teal-400 bg-teal-500/15 shadow-sm'
            : returned
              ? 'border-border bg-muted/40 hover:bg-accent'
              : 'border-teal-300/60 bg-teal-500/5 hover:bg-accent',
        )}
      >
        <span className="font-semibold text-teal-700 dark:text-teal-300">{node.name}</span>
        <span className="text-muted-foreground">({node.args})</span>
        {returned && (
          <span className="text-emerald-600 dark:text-emerald-400">→ {node.result}</span>
        )}
        {!returned && isActive && (
          <span className="ml-0.5 inline-block h-1.5 w-1.5 animate-pulse rounded-full bg-teal-500" />
        )}
      </button>
      <AnimatePresence>
        {node.children.map((c) => (
          <TreeNode key={c.id} node={c} currentIndex={currentIndex} activeId={activeId} onJump={onJump} />
        ))}
      </AnimatePresence>
    </motion.div>
  )
}

// Draws the call tree as it grows (calls) and settles (returns). Returned nodes
// dim and show their result; the active call pulses.
export function RecursionTree({
  roots,
  totalCalls,
  currentIndex,
  activeId,
  onJump,
}: {
  roots: CallNode[]
  totalCalls: number
  currentIndex: number
  activeId: number | null
  onJump: (stepIndex: number) => void
}) {
  if (totalCalls === 0) {
    return (
      <div className="flex h-full items-center justify-center p-4 text-center text-xs text-muted-foreground">
        No function calls yet — try a recursive example like factorial or fib.
      </div>
    )
  }
  return (
    <div className="flex h-full flex-col">
      <div className="flex items-center gap-2 px-3 py-1.5 text-xs">
        <GitBranch className="h-3.5 w-3.5 text-teal-500" />
        <span className="font-semibold">Call tree</span>
        <span className="ml-auto text-muted-foreground tabular-nums">{totalCalls} call(s)</span>
      </div>
      <div className="min-h-0 flex-1 overflow-auto p-2">
        <AnimatePresence>
          {roots.map((r) => (
            <TreeNode key={r.id} node={r} currentIndex={currentIndex} activeId={activeId} onJump={onJump} />
          ))}
        </AnimatePresence>
      </div>
    </div>
  )
}
