'use client'

import { motion } from 'framer-motion'
import { Lasso } from 'lucide-react'
import type { Step } from '@/lib/visualizer/types'

// Shows every live function that closes over outer variables, with those
// captured bindings drawn as chips the function "keeps alive".
export function ClosureCapture({ step }: { step: Step | undefined }) {
  const fns = (step?.heap ?? []).filter((h) => h.kind === 'function' && h.captures && h.captures.length > 0)

  if (fns.length === 0) {
    return (
      <div className="flex h-full items-center justify-center p-4 text-center text-xs text-muted-foreground">
        No closures in scope yet. A function that reads an outer variable will appear here.
      </div>
    )
  }

  return (
    <div className="flex h-full flex-col gap-2 overflow-auto p-3">
      {fns.map((fn) => (
        <motion.div
          key={fn.id}
          layout
          initial={{ opacity: 0, y: -4 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.2 }}
          className="rounded-xl border-2 border-indigo-300 bg-indigo-50 p-2.5 dark:border-indigo-700 dark:bg-indigo-950/40"
        >
          <div className="flex items-center gap-1.5 text-sm font-semibold text-indigo-800 dark:text-indigo-200">
            <Lasso className="h-4 w-4" />
            <span className="font-mono">ƒ {fn.label}</span>
            <span className="text-[11px] font-normal text-muted-foreground">captures</span>
          </div>
          <div className="mt-2 flex flex-wrap gap-1.5">
            {fn.captures!.map((c) => (
              <motion.span
                key={c.name}
                layout
                className="flex items-center gap-1 rounded-lg border border-indigo-400/60 bg-white px-2 py-1 font-mono text-[12px] shadow-sm dark:bg-indigo-900/50"
              >
                <span className="font-semibold text-indigo-700 dark:text-indigo-300">{c.name}</span>
                <span className="text-muted-foreground">=</span>
                <span className="text-sky-600 dark:text-sky-400">{c.value}</span>
              </motion.span>
            ))}
          </div>
        </motion.div>
      ))}
    </div>
  )
}
