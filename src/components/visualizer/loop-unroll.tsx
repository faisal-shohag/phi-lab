'use client'

import { AnimatePresence, motion } from 'framer-motion'
import { Repeat } from 'lucide-react'
import type { LoopModel } from '@/lib/visualizer/features'
import { cn } from '@/lib/utils'

// Unrolls the innermost active loop into a table that grows one row per
// iteration: counter/effects on the left, the condition test on the right.
export function LoopUnroll({
  loop,
  currentIndex,
  onJump,
}: {
  loop: LoopModel | null
  currentIndex: number
  onJump: (stepIndex: number) => void
}) {
  if (!loop) {
    return (
      <div className="flex h-full items-center justify-center p-4 text-center text-xs text-muted-foreground">
        Step into a loop to see it unroll iteration by iteration.
      </div>
    )
  }

  const visible = loop.iterations.filter((it) => it.stepIndex <= currentIndex)
  // Stable column order across the variables seen so far.
  const cols: string[] = []
  for (const it of visible) for (const v of it.vars) if (!cols.includes(v.name)) cols.push(v.name)

  return (
    <div className="flex h-full flex-col">
      <div className="flex items-center gap-2 px-3 py-1.5 text-xs">
        <Repeat className="h-3.5 w-3.5 text-violet-500" />
        <span className="font-semibold">{loop.kind} loop</span>
        <span className="text-muted-foreground">line {loop.line}</span>
        <span className="ml-auto text-muted-foreground tabular-nums">
          {visible.length}/{loop.iterations.length} iters
        </span>
      </div>
      <div className="min-h-0 flex-1 overflow-auto px-2 pb-2">
        <table className="w-full border-collapse text-[12px]">
          <thead>
            <tr className="text-left text-[10px] uppercase tracking-wide text-muted-foreground">
              <th className="px-2 py-1 font-semibold">#</th>
              {cols.map((c) => (
                <th key={c} className="px-2 py-1 font-mono font-semibold">{c}</th>
              ))}
              <th className="px-2 py-1 font-semibold">condition</th>
            </tr>
          </thead>
          <tbody>
            <AnimatePresence initial={false}>
              {visible.map((it) => {
                const isCurrent = it.stepIndex === currentIndex
                return (
                  <motion.tr
                    key={it.stepIndex}
                    layout
                    initial={{ opacity: 0, y: -6 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.2 }}
                    onClick={() => onJump(it.stepIndex)}
                    className={cn(
                      'cursor-pointer border-t border-border/60 transition-colors',
                      isCurrent ? 'bg-violet-500/15' : 'hover:bg-accent',
                    )}
                  >
                    <td className="px-2 py-1 tabular-nums text-muted-foreground">{it.iteration}</td>
                    {cols.map((c) => {
                      const cell = it.vars.find((v) => v.name === c)
                      return (
                        <td key={c} className="px-2 py-1 font-mono text-sky-600 dark:text-sky-400">
                          {cell ? cell.value : '·'}
                        </td>
                      )
                    })}
                    <td className="px-2 py-1">
                      {it.condResult !== undefined ? (
                        <span
                          className={cn(
                            'rounded px-1.5 py-0.5 text-[10px] font-bold text-white',
                            it.condResult ? 'bg-emerald-500' : 'bg-rose-500',
                          )}
                        >
                          {it.trail?.[0] ?? (it.condResult ? 'true' : 'false')}
                        </span>
                      ) : (
                        <span className="font-mono text-[11px] text-muted-foreground">{it.label}</span>
                      )}
                    </td>
                  </motion.tr>
                )
              })}
            </AnimatePresence>
          </tbody>
        </table>
      </div>
    </div>
  )
}
