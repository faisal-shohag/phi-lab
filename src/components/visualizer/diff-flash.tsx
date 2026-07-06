'use client'

import { useEffect, useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { ArrowRight } from 'lucide-react'
import type { Step, ValueSnapshot } from '@/lib/visualizer/types'

function fmt(v: ValueSnapshot): string {
  if (v.t === 'ref') return `→#${v.id}`
  const p = v.v
  if (p === null) return 'null'
  if (p === undefined) return 'undefined'
  if (typeof p === 'string') return `"${p}"`
  return String(p)
}

interface Change {
  scope: string
  name: string
  before?: string
  after?: string
}

function diff(prev: Step | undefined, cur: Step | undefined): Change[] {
  if (!cur) return []
  const before = new Map<string, string>()
  if (prev) {
    for (const f of prev.frames) for (const v of f.vars) before.set(`${f.name}:${v.name}`, fmt(v.value))
  }
  const out: Change[] = []
  const seen = new Set<string>()
  for (const f of cur.frames) {
    for (const v of f.vars) {
      const key = `${f.name}:${v.name}`
      seen.add(key)
      const now = fmt(v.value)
      const was = before.get(key)
      if (was !== now) out.push({ scope: f.name, name: v.name, before: was, after: now })
    }
  }
  return out.slice(0, 5)
}

// A transient card that flashes exactly what changed on the last step move.
// Especially useful when stepping backward, where the "cause" is otherwise
// invisible. Re-triggers whenever the step index changes.
export function DiffFlash({
  currentStep,
  previousStep,
  stepIndex,
}: {
  currentStep: Step | undefined
  previousStep: Step | undefined
  stepIndex: number
}) {
  const [visible, setVisible] = useState(false)
  const changes = diff(previousStep, currentStep)

  useEffect(() => {
    if (changes.length === 0) return
    // Flash on each step move, then fade out on a timer.
    /* eslint-disable react-hooks/set-state-in-effect */
    setVisible(true)
    /* eslint-enable react-hooks/set-state-in-effect */
    const t = setTimeout(() => setVisible(false), 1500)
    return () => clearTimeout(t)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [stepIndex])

  return (
    <div className="pointer-events-none absolute right-2 top-2 z-20 flex flex-col items-end gap-1">
      <AnimatePresence>
        {visible &&
          changes.map((c, i) => (
            <motion.div
              key={`${stepIndex}-${c.scope}-${c.name}`}
              initial={{ opacity: 0, x: 14, scale: 0.9 }}
              animate={{ opacity: 1, x: 0, scale: 1 }}
              exit={{ opacity: 0, x: 14 }}
              transition={{ duration: 0.22, delay: i * 0.04 }}
              className="flex items-center gap-1.5 rounded-lg border-2 border-amber-400 bg-amber-50 dark:bg-amber-950/80 dark:border-amber-600 px-2 py-1 shadow-md font-mono text-[11px]"
            >
              <span className="font-bold text-amber-900 dark:text-amber-200">{c.name}</span>
              {c.before !== undefined && (
                <span className="text-rose-500 line-through decoration-rose-400">{c.before}</span>
              )}
              <ArrowRight className="h-3 w-3 text-amber-500" />
              <span className="font-bold text-emerald-600 dark:text-emerald-400">{c.after}</span>
            </motion.div>
          ))}
      </AnimatePresence>
    </div>
  )
}
