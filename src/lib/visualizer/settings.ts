// Opt-in learning features for the visualizer. Every feature ships OFF by
// default so the lab stays clean for newcomers; learners turn on the ones they
// want from the settings panel and the choice is remembered in localStorage.

import { useCallback, useEffect, useState } from 'react'

export type FeatureKey =
  | 'diffFlash'
  | 'consoleLane'
  | 'loopUnroll'
  | 'eventLoop'
  | 'closureCapture'
  | 'hoisting'
  | 'recursionTree'
  | 'flowChart'
  | 'callStackStrip'
  | 'complexityMeter'

export type VisualizerSettings = Record<FeatureKey, boolean>

export const DEFAULT_SETTINGS: VisualizerSettings = {
  diffFlash: false,
  consoleLane: false,
  loopUnroll: false,
  eventLoop: false,
  closureCapture: false,
  hoisting: false,
  recursionTree: false,
  flowChart: false,
  callStackStrip: false,
  complexityMeter: false,
}

export interface FeatureMeta {
  key: FeatureKey
  label: string
  blurb: string
  // lucide icon name is resolved by the panel; keep this file React-free-ish.
  group: 'Understanding' | 'Concepts'
}

export const FEATURE_META: FeatureMeta[] = [
  {
    key: 'diffFlash',
    label: 'Change flash',
    blurb: 'Flash exactly which variables changed each step — great when stepping back.',
    group: 'Understanding',
  },
  {
    key: 'consoleLane',
    label: 'Console lane',
    blurb: 'Tie every console.log line to the source line that printed it; click to jump.',
    group: 'Understanding',
  },
  {
    key: 'loopUnroll',
    label: 'Loop unroll table',
    blurb: 'Grow a row per iteration: counter, condition, and effects side by side.',
    group: 'Understanding',
  },
  {
    key: 'callStackStrip',
    label: 'Call-stack strip',
    blurb: 'A breadcrumb of the live call stack — global → add(a, b) → innerCall().',
    group: 'Understanding',
  },
  {
    key: 'complexityMeter',
    label: 'Complexity meter',
    blurb: '"This loop runs 5 times" — a shrinking counter under the editor while inside a loop.',
    group: 'Understanding',
  },
  {
    key: 'flowChart',
    label: 'Flow chart',
    blurb: 'A live flowchart of branches, loops, and calls — the active node lights up.',
    group: 'Concepts',
  },
  {
    key: 'recursionTree',
    label: 'Recursion tree',
    blurb: 'Draw the call tree as it grows and collapses — ideal for fib / factorial.',
    group: 'Concepts',
  },
  {
    key: 'closureCapture',
    label: 'Closure capture',
    blurb: 'Show which outer variables each function closes over and keeps alive.',
    group: 'Concepts',
  },
  {
    key: 'hoisting',
    label: 'Hoisting & TDZ',
    blurb: 'A compile-phase pre-pass: what gets hoisted and which bindings sit in the TDZ.',
    group: 'Concepts',
  },
  {
    key: 'eventLoop',
    label: 'Event loop',
    blurb: 'Visualize the call stack, Web APIs, and micro/macro task queues for async code.',
    group: 'Concepts',
  },
]

const STORAGE_KEY = 'phi-viz-settings'

function readStorage(): VisualizerSettings {
  if (typeof window === 'undefined') return DEFAULT_SETTINGS
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY)
    if (!raw) return DEFAULT_SETTINGS
    const parsed = JSON.parse(raw) as Partial<VisualizerSettings>
    // Merge over defaults so newly added features default to off.
    return { ...DEFAULT_SETTINGS, ...parsed }
  } catch {
    return DEFAULT_SETTINGS
  }
}

// Hook: hydration-safe (starts from defaults, reads localStorage after mount so
// server and first client render agree), persists on every change.
export function useVisualizerSettings() {
  const [settings, setSettings] = useState<VisualizerSettings>(DEFAULT_SETTINGS)
  const [ready, setReady] = useState(false)

  useEffect(() => {
    // Hydration-safe: server render and first client render use defaults; the
    // stored preferences are only read after mount.
    /* eslint-disable react-hooks/set-state-in-effect */
    setSettings(readStorage())
    setReady(true)
    /* eslint-enable react-hooks/set-state-in-effect */
  }, [])

  const setFeature = useCallback((key: FeatureKey, value: boolean) => {
    setSettings((prev) => {
      const next = { ...prev, [key]: value }
      try {
        window.localStorage.setItem(STORAGE_KEY, JSON.stringify(next))
      } catch {
        /* storage may be unavailable (private mode) — keep in-memory only */
      }
      return next
    })
  }, [])

  const resetAll = useCallback(() => {
    setSettings(DEFAULT_SETTINGS)
    try {
      window.localStorage.removeItem(STORAGE_KEY)
    } catch {
      /* ignore */
    }
  }, [])

  const enabledCount = Object.values(settings).filter(Boolean).length

  return { settings, setFeature, resetAll, enabledCount, ready }
}
