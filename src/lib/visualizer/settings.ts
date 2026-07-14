// Opt-in learning features for the visualizer. Every feature ships OFF by
// default so the lab stays clean for newcomers; learners turn on the ones they
// want from the settings panel and the choice is remembered in localStorage.

import { useCallback, useEffect, useState } from 'react'

export type FeatureKey =
  | 'realEngine'
  | 'diffFlash'
  | 'consoleLane'
  | 'loopUnroll'
  | 'eventLoop'
  | 'closureCapture'
  | 'hoisting'
  | 'recursionTree'
  | 'flowChart'
  | 'heapGraph'
  | 'callStack'
  | 'complexityMeter'
  | 'heatTrail'
  | 'flameGraph'
  | 'aliasWires'
  | 'aiTutor'
  | 'calmMode'
  | 'ambientSound'
  | 'focusDim'

export type VisualizerSettings = Record<FeatureKey, boolean>

export const DEFAULT_SETTINGS: VisualizerSettings = {
  realEngine: true,
  diffFlash: false,
  consoleLane: false,
  loopUnroll: false,
  eventLoop: false,
  closureCapture: false,
  hoisting: false,
  recursionTree: false,
  flowChart: false,
  heapGraph: false,
  callStack: true,
  complexityMeter: true,
  heatTrail: false,
  flameGraph: false,
  aliasWires: false,
  aiTutor: true,
  calmMode: false,
  ambientSound: false,
  focusDim: false,
}

export interface FeatureMeta {
  key: FeatureKey
  label: string
  blurb: string
  // lucide icon name is resolved by the panel; keep this file React-free-ish.
  group: 'Understanding' | 'Concepts' | 'Comfort'
}

export const FEATURE_META: FeatureMeta[] = [
  {
    key: 'realEngine',
    label: 'Real JS engine',
    blurb: 'Run your code on the real JavaScript engine — every language feature (regex, classes, generators, Symbol, Date, real throw/catch), exactly like Node. Turn off to fall back to the classic teaching interpreter.',
    group: 'Understanding',
  },
  {
    key: 'aiTutor',
    label: 'AI tutor',
    blurb: 'Ask "why?" on any step, or "help me fix" on an error — a friendly explanation in Banglish or English. Needs sign-in.',
    group: 'Understanding',
  },
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
    key: 'heapGraph',
    label: 'Heap graph',
    blurb: 'A live object/array reference graph — see what points to what on the heap.',
    group: 'Understanding',
  },
  {
    key: 'callStack',
    label: 'Call stack',
    blurb: 'Watch frames push on and pop off the stack as functions are called and return.',
    group: 'Understanding',
  },
  {
    key: 'complexityMeter',
    label: 'Complexity meter',
    blurb: '"This loop runs 5 times" — a shrinking counter under the editor while inside a loop.',
    group: 'Understanding',
  },
  {
    key: 'heatTrail',
    label: 'Heat trail',
    blurb: "See each variable's value change across the whole run as a heat lane — click any point to jump there.",
    group: 'Understanding',
  },
  {
    key: 'aliasWires',
    label: 'Aliasing',
    blurb: 'Highlight when two variables point at the same array/object — spot aliasing at a glance.',
    group: 'Understanding',
  },
  {
    key: 'flowChart',
    label: 'Flow chart',
    blurb: 'A live flowchart of branches, loops, and calls — the active node lights up.',
    group: 'Concepts',
  },
  {
    key: 'flameGraph',
    label: 'Flame graph',
    blurb: 'A profiler-style flame graph of every call — bar width = steps spent, nesting = call depth. Hover to jump.',
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
  {
    key: 'calmMode',
    label: 'Calm mode',
    blurb: 'A gentler pace and softer motion — slower auto-play and no confetti bursts. Relax and watch.',
    group: 'Comfort',
  },
  {
    key: 'ambientSound',
    label: 'Ambient sound',
    blurb: 'Soft, procedural blips as each step runs — a quiet chime on output and when a function returns.',
    group: 'Comfort',
  },
  {
    key: 'focusDim',
    label: 'Focus dimming',
    blurb: 'While playing, dim every line except the one running now, so your eye rests on the active step.',
    group: 'Comfort',
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
