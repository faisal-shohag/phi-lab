'use client'

import { AnimatePresence, motion } from 'framer-motion'
import { ChevronRight, Layers } from 'lucide-react'
import { cn } from '@/lib/utils'
import type { Step } from '@/lib/visualizer/types'

function shortValue(v: Step['frames'][number]['vars'][number]['value']): string {
  if (v.t === 'ref') return '…'
  const p = v.v
  if (p === null) return 'null'
  if (p === undefined) return 'undef'
  if (typeof p === 'string') return p.length > 8 ? `"${p.slice(0, 8)}…"` : `"${p}"`
  return String(p)
}

// A thin breadcrumb strip: global → add(a=7, b=5) → innerCall(). Each frame is
// a pill; the active (innermost) frame is highlighted; a frame animates out
// the moment its function returns.
export function CallStackStrip({ step }: { step: Step | undefined }) {
  const frames = step?.frames ?? []
  if (frames.length === 0) return null

  return (
    <div className="flex shrink-0 items-center gap-1 overflow-x-auto rounded-lg border-2 border-border bg-card px-2.5 py-1.5">
      <Layers className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
      <AnimatePresence initial={false}>
        {frames.map((f, i) => {
          const isActive = i === frames.length - 1
          const params = f.vars
            .filter((v) => !v.closure)
            .slice(0, 3)
            .map((v) => `${v.name}=${shortValue(v.value)}`)
            .join(', ')
          const label = f.kind === 'global' ? 'global' : `${f.name}(${params})`
          return (
            <motion.div
              key={`${i}:${f.name}:${f.callLine ?? 0}`}
              layout
              initial={{ opacity: 0, scale: 0.9, x: -6 }}
              animate={{ opacity: 1, scale: 1, x: 0 }}
              exit={{ opacity: 0, scale: 0.9, x: 6 }}
              transition={{ type: 'spring', stiffness: 300, damping: 26 }}
              className="flex shrink-0 items-center gap-1"
            >
              {i > 0 && <ChevronRight className="h-3 w-3 shrink-0 text-muted-foreground" />}
              <span
                className={cn(
                  'whitespace-nowrap rounded-md border px-2 py-0.5 font-mono text-[11px]',
                  isActive
                    ? 'border-amber-400 bg-amber-50 font-semibold text-amber-800 dark:bg-amber-950/50 dark:text-amber-300'
                    : 'border-border bg-muted/40 text-muted-foreground',
                )}
              >
                {label}
              </span>
            </motion.div>
          )
        })}
      </AnimatePresence>
    </div>
  )
}
