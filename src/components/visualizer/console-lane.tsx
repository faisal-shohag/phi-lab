'use client'

import { AnimatePresence, motion } from 'framer-motion'
import { CornerDownRight } from 'lucide-react'
import type { ConsoleEntry } from '@/lib/visualizer/features'
import { cn } from '@/lib/utils'

// The console.log lane: every printed line is tied to the source line that
// produced it, and clicking a line jumps the player to that step.
export function ConsoleLane({
  entries,
  currentIndex,
  onJump,
}: {
  entries: ConsoleEntry[]
  currentIndex: number
  onJump: (stepIndex: number) => void
}) {
  if (entries.length === 0) {
    return (
      <div className="text-sm text-slate-500 italic text-center py-6 font-mono">
        console output will appear here — each line linked to its source line
      </div>
    )
  }
  return (
    <div className="font-mono text-[13px] space-y-1">
      <AnimatePresence initial={false}>
        {entries.map((e) => {
          const isCurrent = e.stepIndex === currentIndex
          return (
            <motion.button
              key={e.stepIndex}
              layout
              initial={{ opacity: 0, x: -8 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.25, ease: 'easeOut' }}
              onClick={() => onJump(e.stepIndex)}
              className={cn(
                'group flex w-full items-center gap-2 rounded px-1.5 py-1 text-left transition-colors',
                isCurrent ? 'bg-emerald-500/15 ring-1 ring-emerald-500/40' : 'hover:bg-white/5',
              )}
            >
              <span className="shrink-0 rounded bg-slate-700 px-1.5 py-0.5 text-[10px] text-slate-300 tabular-nums group-hover:bg-emerald-700 group-hover:text-white">
                L{e.line}
              </span>
              <CornerDownRight className="h-3 w-3 shrink-0 text-slate-600" />
              <span className="break-all whitespace-pre-wrap text-emerald-300">{e.text}</span>
            </motion.button>
          )
        })}
      </AnimatePresence>
    </div>
  )
}
