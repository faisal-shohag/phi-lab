'use client'

import { AnimatePresence, motion } from 'framer-motion'
import { Layers } from 'lucide-react'
import { cn } from '@/lib/utils'
import type { Step } from '@/lib/visualizer/types'

function shortValue(v: Step['frames'][number]['vars'][number]['value']): string {
  if (v.t === 'ref') return '…'
  const p = v.v
  if (p === null) return 'null'
  if (p === undefined) return 'undef'
  if (typeof p === 'string') return p.length > 10 ? `"${p.slice(0, 10)}…"` : `"${p}"`
  return String(p)
}

// A physical call-stack: each frame is a card and the cards pile up, base
// (global) at the bottom and the innermost/active frame on top. As functions
// are called cards push in from the top; as they return they pop back off —
// so learners feel the stack grow and unwind.
export function CallStackPanel({ step }: { step: Step | undefined }) {
  const frames = step?.frames ?? []

  if (frames.length === 0) {
    return (
      <div className="flex h-full items-center justify-center p-6 text-center text-sm text-muted-foreground italic">
        Stack is empty — press <strong className="mx-1">Run</strong> to begin.
      </div>
    )
  }

  // Top of stack (innermost frame) first so it sits highest in the column.
  const ordered = frames.map((f, i) => ({ f, stackIndex: i })).reverse()

  return (
    <div className="flex h-full flex-col gap-2 overflow-y-auto p-3">
      <div className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
        <Layers className="h-3.5 w-3.5" />
        Call stack
        <span className="ml-auto font-mono text-[10px] normal-case">
          depth {frames.length}
        </span>
      </div>
      <AnimatePresence mode="popLayout" initial={false}>
        {ordered.map(({ f, stackIndex }) => {
          const isTop = stackIndex === frames.length - 1
          const params = f.vars
            .filter((v) => !v.closure)
            .slice(0, 4)
            .map((v) => `${v.name}=${shortValue(v.value)}`)
            .join(', ')
          const label = f.kind === 'global' ? 'global' : `${f.name}(${params})`
          const below = frames[stackIndex - 1]
          return (
            <motion.div
              key={`${stackIndex}:${f.name}:${f.callLine ?? 0}`}
              layout
              initial={{ opacity: 0, y: -24, scale: 0.9 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -24, scale: 0.9 }}
              transition={{ type: 'spring', stiffness: 320, damping: 26 }}
              className={cn(
                'shrink-0 rounded-lg border-2 px-3 py-2 shadow-sm',
                isTop
                  ? 'border-amber-400 bg-amber-50 dark:border-amber-500 dark:bg-amber-950/40'
                  : 'border-border bg-muted/30',
              )}
            >
              <div className="flex items-center gap-2">
                <span
                  className={cn(
                    'font-mono text-[10px] font-bold',
                    isTop ? 'text-amber-600 dark:text-amber-400' : 'text-muted-foreground',
                  )}
                >
                  #{stackIndex}
                </span>
                <span
                  className={cn(
                    'min-w-0 flex-1 truncate font-mono text-[13px]',
                    isTop ? 'font-semibold text-amber-900 dark:text-amber-200' : 'text-foreground',
                  )}
                  title={label}
                >
                  {label}
                </span>
                {isTop && (
                  <span className="shrink-0 rounded-full bg-amber-500 px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wide text-white">
                    top
                  </span>
                )}
              </div>
              {f.callLine != null && (
                <div className="mt-0.5 text-[10px] text-muted-foreground">
                  called from line {f.callLine}
                  {below && (
                    <span className="ml-1 opacity-70">
                      · returns to {below.kind === 'global' ? 'global' : `${below.name}()`}
                    </span>
                  )}
                </div>
              )}
            </motion.div>
          )
        })}
      </AnimatePresence>
    </div>
  )
}
