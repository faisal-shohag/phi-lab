'use client'

import { useMemo, useRef } from 'react'
import { cn } from '@/lib/utils'
import type { Step } from '@/lib/visualizer/types'

// One call frame's lifetime, measured in steps.
interface Interval {
  label: string
  depth: number
  callLine?: number
  startStep: number
  endStep: number
}

// Warm "flame" palette, indexed by call depth.
const DEPTH_COLORS = [
  { bg: '#64748b', fg: '#ffffff' }, // slate  (global / depth 0)
  { bg: '#f59e0b', fg: '#3b2503' }, // amber
  { bg: '#f97316', fg: '#3a1a03' }, // orange
  { bg: '#ef4444', fg: '#ffffff' }, // red
  { bg: '#ec4899', fg: '#ffffff' }, // pink
  { bg: '#a855f7', fg: '#ffffff' }, // purple
  { bg: '#6366f1', fg: '#ffffff' }, // indigo
]

function buildIntervals(steps: Step[]): { intervals: Interval[]; maxDepth: number } {
  const open = new Map<number, Interval & { id: string }>()
  const intervals: Interval[] = []
  let maxDepth = 0

  const close = (cur: Interval & { id: string }, endStep: number) => {
    intervals.push({
      label: cur.label,
      depth: cur.depth,
      callLine: cur.callLine,
      startStep: cur.startStep,
      endStep,
    })
  }

  steps.forEach((step, i) => {
    const present = new Set<number>()
    step.frames.forEach((frame, d) => {
      present.add(d)
      maxDepth = Math.max(maxDepth, d)
      const label = frame.kind === 'global' ? 'global' : frame.name
      const id = `${d}|${label}|${frame.callLine ?? -1}`
      const cur = open.get(d)
      if (cur && cur.id === id) return
      if (cur) close(cur, i - 1)
      open.set(d, { id, label, depth: d, callLine: frame.callLine, startStep: i, endStep: i })
    })
    // Close frames that popped off this step.
    for (const [d, cur] of open) {
      if (!present.has(d)) {
        close(cur, i - 1)
        open.delete(d)
      }
    }
  })
  // Close whatever is still on the stack at the end of the trace.
  const last = steps.length - 1
  for (const cur of open.values()) close(cur, last)

  return { intervals, maxDepth }
}

const ROW = 24

// A profiler-style flame graph of the whole run: each call frame is a bar whose
// width is the number of steps spent in it and whose row is its call depth.
// Hover a bar for detail, click it to jump to where that call began.
export function FlameGraph({
  steps,
  currentIndex,
  onSeek,
}: {
  steps: Step[]
  currentIndex: number
  onSeek: (index: number) => void
}) {
  const { intervals, maxDepth } = useMemo(() => buildIntervals(steps), [steps])
  const scrollRef = useRef<HTMLDivElement>(null)
  const n = steps.length

  if (n === 0 || intervals.length === 0) {
    return (
      <div className="flex h-full items-center justify-center p-6 text-center text-sm text-muted-foreground italic">
        Run the code to see the flame graph.
      </div>
    )
  }

  return (
    <div ref={scrollRef} className="h-full overflow-auto p-3">
      <div className="mb-2 flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
        Flame graph
        <span className="ml-auto font-mono text-[10px] normal-case">
          {intervals.length} calls · depth {maxDepth}
        </span>
      </div>
      <div
        className="relative w-full min-w-[320px]"
        style={{ height: (maxDepth + 1) * ROW + 4 }}
      >
        {intervals.map((iv, i) => {
          const width = iv.endStep - iv.startStep + 1
          const leftPct = (iv.startStep / n) * 100
          const widthPct = (width / n) * 100
          const isActive = currentIndex >= iv.startStep && currentIndex <= iv.endStep
          const color = DEPTH_COLORS[iv.depth % DEPTH_COLORS.length]
          return (
            <button
              key={i}
              onClick={() => onSeek(iv.startStep)}
              title={`${iv.label}${iv.callLine ? ` — called at line ${iv.callLine}` : ''}\n${width} step${width > 1 ? 's' : ''} (steps ${iv.startStep + 1}–${iv.endStep + 1})`}
              className={cn(
                'absolute overflow-hidden rounded-sm border border-black/10 px-1.5 text-left font-mono text-[11px] leading-[22px] transition-all hover:brightness-110',
                isActive && 'ring-2 ring-foreground ring-offset-1 ring-offset-background z-10',
              )}
              style={{
                left: `${leftPct}%`,
                width: `calc(${widthPct}% - 1px)`,
                top: iv.depth * ROW,
                height: ROW - 2,
                background: color.bg,
                color: color.fg,
              }}
            >
              <span className="truncate">{iv.label}</span>
            </button>
          )
        })}
        {/* Playhead across all rows. */}
        <span
          className="pointer-events-none absolute top-0 bottom-0 z-20 w-px bg-foreground/70"
          style={{ left: `${((currentIndex + 0.5) / n) * 100}%` }}
        />
      </div>
      <div className="mt-2 text-[10px] text-muted-foreground">
        Bar width = time spent (steps) · rows stack by call depth · click a bar to jump.
      </div>
    </div>
  )
}
