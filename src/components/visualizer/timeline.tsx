'use client'

import { useEffect, useRef } from 'react'
import { cn } from '@/lib/utils'
import type { Step, StepKind } from '@/lib/visualizer/types'

const KIND_STYLE: Record<string, { bg: string; label: string }> = {
  enter:       { bg: 'bg-teal-500',    label: 'enter' },
  assign:      { bg: 'bg-amber-500',   label: 'assign' },
  declare:     { bg: 'bg-emerald-500', label: 'declare' },
  condition:   { bg: 'bg-fuchsia-500', label: 'cond' },
  branch:      { bg: 'bg-fuchsia-400', label: 'branch' },
  'loop-start':{ bg: 'bg-violet-500',  label: 'loop→' },
  'loop-check':{ bg: 'bg-violet-400',  label: 'check' },
  'loop-iter': { bg: 'bg-violet-300',  label: 'iter' },
  'loop-end':  { bg: 'bg-violet-600',  label: 'loop×' },
  read:        { bg: 'bg-sky-500',     label: 'read' },
  write:       { bg: 'bg-rose-500',    label: 'write' },
  call:        { bg: 'bg-teal-600',    label: 'call' },
  return:      { bg: 'bg-teal-400',    label: 'ret' },
  output:      { bg: 'bg-slate-500',   label: 'log' },
  expr:        { bg: 'bg-slate-400',   label: 'expr' },
  schedule:    { bg: 'bg-orange-500',  label: 'sched' },
  dequeue:     { bg: 'bg-orange-400',  label: 'run' },
}

// Loop bookkeeping steps get thin ticks so long traces stay compact.
const THIN: Set<StepKind> = new Set(['loop-check', 'loop-iter'])

interface TimelineProps {
  steps: Step[]
  currentIndex: number
  onSeek: (index: number) => void
  breakpointLines?: Set<number>
}

export function Timeline({ steps, currentIndex, onSeek, breakpointLines }: TimelineProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const activeRef = useRef<HTMLButtonElement>(null)

  // Keep the playhead centered as it advances.
  useEffect(() => {
    const el = activeRef.current
    const box = containerRef.current
    if (!el || !box) return
    const elCenter = el.offsetLeft + el.offsetWidth / 2
    box.scrollTo({ left: elCenter - box.clientWidth / 2, behavior: 'smooth' })
  }, [currentIndex])

  return (
    <div ref={containerRef} className="relative flex items-stretch gap-[3px] overflow-x-auto py-1 px-1 h-7">
      {steps.map((step, i) => {
        const style = KIND_STYLE[step.kind] ?? KIND_STYLE.expr
        const isCurrent = i === currentIndex
        const isPassed = i < currentIndex
        const thin = THIN.has(step.kind) && !isCurrent
        const isBreak = breakpointLines?.has(step.line)
        return (
          <button
            key={i}
            ref={isCurrent ? activeRef : undefined}
            onClick={() => onSeek(i)}
            title={`Step ${i + 1} · ${step.kind}: ${step.description}`}
            className={cn(
              'group relative shrink-0 rounded-sm transition-all duration-150',
              thin ? 'w-1.5' : 'w-3.5',
              style.bg,
              isCurrent ? 'opacity-100 ring-2 ring-foreground ring-offset-1 ring-offset-background z-10' : '',
              !isCurrent && isPassed && 'opacity-80 hover:opacity-100',
              !isCurrent && !isPassed && 'opacity-30 hover:opacity-60',
            )}
          >
            {isBreak && (
              <span className="absolute -top-1 left-1/2 -translate-x-1/2 w-1.5 h-1.5 rounded-full bg-rose-500 ring-1 ring-background" />
            )}
          </button>
        )
      })}
    </div>
  )
}

export function StepLegend() {
  const entries = Object.entries(KIND_STYLE)
  return (
    <div className="flex flex-wrap gap-x-3 gap-y-1 text-[10px] text-muted-foreground">
      {entries.map(([key, style]) => (
        <span key={key} className="flex items-center gap-1">
          <span className={cn('inline-block w-2.5 h-2.5 rounded-sm', style.bg)} />
          {key}
        </span>
      ))}
    </div>
  )
}
