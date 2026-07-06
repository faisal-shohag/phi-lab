'use client'

import { motion } from 'framer-motion'
import { Gauge } from 'lucide-react'
import type { LoopModel } from '@/lib/visualizer/features'

// "This loop will run 5 times" — a shrinking counter under the editor while
// the playhead is inside a loop, building O(n) intuition before the term.
export function ComplexityMeter({ loop, currentIndex }: { loop: LoopModel | null; currentIndex: number }) {
  if (!loop || loop.iterations.length === 0) return null
  const total = loop.iterations.length
  const completed = loop.iterations.filter((it) => it.stepIndex <= currentIndex).length
  const remaining = Math.max(0, total - completed)
  const pct = Math.min(100, Math.round((completed / total) * 100))

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: -4 }}
      animate={{ opacity: 1, y: 0 }}
      className="flex shrink-0 items-center gap-2 rounded-lg border-2 border-violet-300 bg-violet-50 px-3 py-1.5 text-xs dark:border-violet-700 dark:bg-violet-950/40"
    >
      <Gauge className="h-3.5 w-3.5 shrink-0 text-violet-500" />
      <span className="font-semibold text-violet-800 dark:text-violet-300">
        This {loop.kind} loop runs {total} time{total === 1 ? '' : 's'}
      </span>
      <span className="font-mono text-violet-700 dark:text-violet-400">
        {remaining > 0 ? `${remaining} left` : 'done'}
      </span>
      <div className="ml-auto h-1.5 w-24 shrink-0 overflow-hidden rounded-full bg-violet-200 dark:bg-violet-900">
        <motion.div
          className="h-full bg-violet-500"
          animate={{ width: `${pct}%` }}
          transition={{ type: 'spring', stiffness: 260, damping: 30 }}
        />
      </div>
    </motion.div>
  )
}
