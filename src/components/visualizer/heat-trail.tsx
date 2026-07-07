'use client'

import { useMemo, useRef } from 'react'
import { cn } from '@/lib/utils'
import type { Step, ValueSnapshot } from '@/lib/visualizer/types'

// How many variable lanes we draw at most — busy traces can touch dozens of
// variables and we keep the strip compact by showing the most active ones.
const MAX_LANES = 8

// A small categorical palette for non-numeric values (strings / bools / refs).
const CAT_COLORS = [
  '#0ea5e9', // sky
  '#f59e0b', // amber
  '#10b981', // emerald
  '#ef4444', // rose
  '#8b5cf6', // violet
  '#ec4899', // pink
  '#14b8a6', // teal
  '#eab308', // yellow
]

interface Point {
  step: number
  // The raw value at this step, formatted for the tooltip.
  label: string
  // Numeric value when the variable held a number at this step.
  num?: number
}

interface Lane {
  key: string
  frame: string
  name: string
  points: Point[]
  numeric: boolean
  min: number
  max: number
  // Distinct values -> color, for categorical lanes.
  colorOf: (label: string) => string
}

function formatValue(v: ValueSnapshot): { label: string; num?: number } {
  if (v.t === 'ref') return { label: `→#${v.id}` }
  const p = v.v
  if (p === null) return { label: 'null' }
  if (p === undefined) return { label: '—' }
  if (typeof p === 'number') return { label: String(p), num: p }
  if (typeof p === 'string') return { label: p.length > 12 ? `"${p.slice(0, 12)}…"` : `"${p}"` }
  return { label: String(p) }
}

function buildLanes(steps: Step[]): { lanes: Lane[]; truncated: number } {
  // Collect a time series per variable, keyed by frame label + name so a var
  // that appears in several frames (recursion) shares one lane.
  const series = new Map<string, { frame: string; name: string; points: Point[] }>()

  steps.forEach((step, si) => {
    for (const frame of step.frames) {
      const frameLabel = frame.kind === 'global' ? 'global' : frame.name
      for (const v of frame.vars) {
        const key = `${frameLabel}:${v.name}`
        let entry = series.get(key)
        if (!entry) {
          entry = { frame: frameLabel, name: v.name, points: [] }
          series.set(key, entry)
        }
        // One point per step — last write wins if the var appears twice.
        const last = entry.points[entry.points.length - 1]
        const { label, num } = formatValue(v.value)
        if (last && last.step === si) {
          last.label = label
          last.num = num
        } else {
          entry.points.push({ step: si, label, num })
        }
      }
    }
  })

  // Rank by how much a lane changes (distinct consecutive values) so the most
  // "interesting" variables surface first.
  const scored = [...series.entries()].map(([key, s]) => {
    let changes = 0
    for (let i = 1; i < s.points.length; i++) {
      if (s.points[i].label !== s.points[i - 1].label) changes++
    }
    return { key, s, score: changes * 100 + s.points.length }
  })
  scored.sort((a, b) => b.score - a.score)

  const chosen = scored.slice(0, MAX_LANES)
  const truncated = Math.max(0, scored.length - chosen.length)

  const lanes: Lane[] = chosen.map(({ key, s }) => {
    const nums = s.points.filter((p) => p.num !== undefined).map((p) => p.num!)
    const numeric = nums.length >= 2 && nums.length >= s.points.length * 0.5
    const min = numeric ? Math.min(...nums) : 0
    const max = numeric ? Math.max(...nums) : 0
    // Assign a stable color per distinct categorical value.
    const distinct = [...new Set(s.points.map((p) => p.label))]
    const colorMap = new Map(distinct.map((d, i) => [d, CAT_COLORS[i % CAT_COLORS.length]]))
    return {
      key,
      frame: s.frame,
      name: s.name,
      points: s.points,
      numeric,
      min,
      max,
      colorOf: (label: string) => colorMap.get(label) ?? '#94a3b8',
    }
  })

  return { lanes, truncated }
}

// A per-variable "heat lane" strip that sits under the timeline: scrub a
// variable's whole life at a glance, click a point to jump to that step.
export function HeatTrail({
  steps,
  currentIndex,
  onSeek,
}: {
  steps: Step[]
  currentIndex: number
  onSeek: (index: number) => void
}) {
  const { lanes, truncated } = useMemo(() => buildLanes(steps), [steps])
  const n = steps.length

  if (lanes.length === 0 || n < 2) return null

  return (
    <div className="mt-1.5 pt-1.5 border-t">
      <div className="mb-1 flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
        Heat trail
        {truncated > 0 && (
          <span className="ml-auto font-normal normal-case text-[10px] opacity-70">
            +{truncated} more variable{truncated > 1 ? 's' : ''} hidden
          </span>
        )}
      </div>
      <div className="flex flex-col gap-1">
        {lanes.map((lane) => (
          <LaneRow key={lane.key} lane={lane} n={n} currentIndex={currentIndex} onSeek={onSeek} />
        ))}
      </div>
    </div>
  )
}

function LaneRow({
  lane,
  n,
  currentIndex,
  onSeek,
}: {
  lane: Lane
  n: number
  currentIndex: number
  onSeek: (index: number) => void
}) {
  const trackRef = useRef<HTMLDivElement>(null)

  const seekFromEvent = (clientX: number) => {
    const el = trackRef.current
    if (!el) return
    const rect = el.getBoundingClientRect()
    const frac = Math.min(1, Math.max(0, (clientX - rect.left) / rect.width))
    onSeek(Math.round(frac * (n - 1)))
  }

  const range = lane.max - lane.min || 1
  const H = 22

  return (
    <div className="flex items-center gap-2">
      <span
        className="w-24 shrink-0 truncate text-right font-mono text-[10px] text-muted-foreground"
        title={`${lane.frame} · ${lane.name}`}
      >
        <span className="opacity-50">{lane.frame === 'global' ? '' : `${lane.frame}.`}</span>
        {lane.name}
      </span>
      <div
        ref={trackRef}
        onPointerDown={(e) => seekFromEvent(e.clientX)}
        className="relative h-[22px] flex-1 cursor-pointer rounded bg-muted/40 ring-1 ring-inset ring-border/50"
      >
        <svg
          viewBox={`0 0 ${n} ${H}`}
          preserveAspectRatio="none"
          className="absolute inset-0 h-full w-full"
        >
          {lane.numeric ? (
            <polyline
              points={lane.points
                .map((p) => `${p.step + 0.5},${H - 2 - ((p.num! - lane.min) / range) * (H - 4)}`)
                .join(' ')}
              fill="none"
              stroke="#0ea5e9"
              strokeWidth={1.5}
              vectorEffect="non-scaling-stroke"
              strokeLinejoin="round"
            />
          ) : (
            lane.points.map((p, i) => {
              const next = lane.points[i + 1]
              const w = (next ? next.step : p.step + 1) - p.step
              return (
                <rect
                  key={i}
                  x={p.step}
                  y={4}
                  width={Math.max(w, 0.9)}
                  height={H - 8}
                  fill={lane.colorOf(p.label)}
                  opacity={0.85}
                />
              )
            })
          )}
        </svg>
        {/* Value dots for numeric lanes so hovering shows the value. */}
        {lane.numeric &&
          lane.points.map((p, i) => (
            <span
              key={i}
              title={`step ${p.step + 1}: ${lane.name} = ${p.label}`}
              className="absolute -translate-x-1/2 -translate-y-1/2"
              style={{
                left: `${((p.step + 0.5) / n) * 100}%`,
                top: `${((H - 2 - ((p.num! - lane.min) / range) * (H - 4)) / H) * 100}%`,
              }}
            >
              <span className="block h-1.5 w-1.5 rounded-full bg-sky-500 ring-1 ring-background" />
            </span>
          ))}
        {/* Playhead. */}
        <span
          className="pointer-events-none absolute top-0 bottom-0 w-px bg-foreground/70"
          style={{ left: `${((currentIndex + 0.5) / n) * 100}%` }}
        />
      </div>
    </div>
  )
}
