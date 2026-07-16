'use client'

// The run, at a glance, without leaving the work.
//
// The full board is a dialog: opening it covers the editor and the target, which
// is right when you are choosing what to do next and wrong when you just want to
// know how far along you are. This is the same road at a size that fits in a
// corner — no labels, no XP, no tooltips, just shape and position.
//
// It shares `mapLayout` with the big board rather than drawing its own, so the
// two cannot disagree about where the run goes. That is the whole reason the
// geometry lives in a pure module.

import { useMemo } from 'react'
import { Maximize2 } from 'lucide-react'

import { mapLayout, travelled } from '@/lib/pixel/map-layout'
import { unlockStates, type TiersByChallenge } from '@/lib/pixel/unlock'
import { cn } from '@/lib/utils'

export function MiniMap({
  tiers,
  currentId,
  nextId,
  onOpen,
  className,
}: {
  tiers: TiersByChallenge
  currentId: string
  nextId: string | null
  onOpen: () => void
  className?: string
}) {
  const layout = useMemo(() => mapLayout(), [])
  const states = useMemo(() => unlockStates(tiers), [tiers])
  const here = nextId ?? currentId
  const position = Math.max(0, layout.nodes.findIndex((n) => n.id === here))
  const cleared = layout.nodes.filter((n) => states[n.id] === 'cleared' || states[n.id] === 'perfect').length

  return (
    <button
      type="button"
      onClick={onOpen}
      title="Open the run"
      aria-label={`Open the run — ${cleared} of ${layout.nodes.length} cleared`}
      className={cn(
        'group absolute bottom-3 right-3 z-20 overflow-hidden rounded-lg border-2 border-border/80 bg-slate-950/85 shadow-lg backdrop-blur-sm transition-colors hover:border-pink-500/70',
        className,
      )}
    >
      <svg
        viewBox={`0 0 ${layout.width} ${layout.height}`}
        className="h-28 w-auto"
        aria-hidden
      >
        {/* No animation here on purpose. This thing is on screen the whole time
            someone is trying to concentrate on their CSS; a road that redraws
            itself in the corner every time the panel re-renders is a distraction
            with no information in it. The big board does the celebrating. */}
        <path
          d={layout.d}
          className="fill-none stroke-white/25"
          strokeWidth={10}
          strokeLinecap="round"
        />
        <path
          d={layout.d}
          className="fill-none stroke-pink-500"
          strokeWidth={10}
          strokeLinecap="round"
          pathLength={1}
          strokeDasharray={`${travelled(position, layout.nodes.length)} 1`}
        />
        {layout.nodes.map((node) => {
          const state = states[node.id]
          const isHere = node.id === here
          return (
            <circle
              key={node.id}
              cx={node.x}
              cy={node.y}
              r={isHere ? 20 : 13}
              className={cn(
                state === 'perfect' && 'fill-amber-400',
                state === 'cleared' && 'fill-emerald-500',
                state === 'available' && 'fill-pink-500',
                state === 'locked' && 'fill-slate-600',
              )}
              stroke={isHere ? 'white' : 'none'}
              strokeWidth={isHere ? 5 : 0}
            />
          )
        })}
      </svg>

      <span className="pointer-events-none absolute inset-x-0 bottom-0 flex items-center justify-center gap-1 bg-slate-950/80 py-0.5 font-mono text-[9px] font-bold text-white/80 tabular-nums">
        {cleared}/{layout.nodes.length}
        <Maximize2 className="size-2.5 opacity-0 transition-opacity group-hover:opacity-100" />
      </span>
    </button>
  )
}
