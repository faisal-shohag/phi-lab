'use client'

import { FunctionSquare, Variable, Ban, Check } from 'lucide-react'
import type { HoistingInfo, Step } from '@/lib/visualizer/types'
import { cn } from '@/lib/utils'

// The "compile phase" pre-pass: what the engine hoists before running a single
// line, plus which let/const bindings are still in the Temporal Dead Zone at
// the current step (they exist but reading them would throw).
export function HoistingPanel({
  hoisting,
  step,
}: {
  hoisting: HoistingInfo | undefined
  step: Step | undefined
}) {
  if (!hoisting) {
    return (
      <div className="flex h-full items-center justify-center p-4 text-center text-xs text-muted-foreground">
        Nothing to hoist in this snippet.
      </div>
    )
  }

  const globalFrame = step?.frames.find((f) => f.kind === 'global')
  const liveNames = new Set((globalFrame?.vars ?? []).map((v) => v.name))

  return (
    <div className="flex h-full flex-col gap-3 overflow-auto p-3 text-sm">
      <p className="rounded-lg bg-muted/60 px-2.5 py-1.5 text-[11px] leading-relaxed text-muted-foreground">
        Before running any line, the engine scans the scope and reserves these names.
      </p>

      {hoisting.funcs.length > 0 && (
        <section>
          <div className="mb-1 flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wide text-teal-600 dark:text-teal-400">
            <FunctionSquare className="h-3.5 w-3.5" /> Functions — hoisted & callable
          </div>
          <div className="flex flex-wrap gap-1.5">
            {hoisting.funcs.map((n) => (
              <span key={n} className="rounded-md border border-teal-300 bg-teal-50 px-2 py-1 font-mono text-[12px] dark:border-teal-700 dark:bg-teal-950/40">
                {n}()
              </span>
            ))}
          </div>
        </section>
      )}

      {hoisting.vars.length > 0 && (
        <section>
          <div className="mb-1 flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wide text-amber-600 dark:text-amber-400">
            <Variable className="h-3.5 w-3.5" /> var — hoisted as undefined
          </div>
          <div className="flex flex-wrap gap-1.5">
            {hoisting.vars.map((n) => (
              <span key={n} className="rounded-md border border-amber-300 bg-amber-50 px-2 py-1 font-mono text-[12px] dark:border-amber-700 dark:bg-amber-950/40">
                {n} = undefined
              </span>
            ))}
          </div>
        </section>
      )}

      {hoisting.tdz.length > 0 && (
        <section>
          <div className="mb-1 flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wide text-rose-600 dark:text-rose-400">
            <Ban className="h-3.5 w-3.5" /> let / const — Temporal Dead Zone
          </div>
          <div className="flex flex-col gap-1">
            {hoisting.tdz.map((t) => {
              const live = liveNames.has(t.name)
              return (
                <div
                  key={t.name}
                  className={cn(
                    'flex items-center gap-2 rounded-md border px-2 py-1 font-mono text-[12px]',
                    live
                      ? 'border-emerald-300 bg-emerald-50 dark:border-emerald-700 dark:bg-emerald-950/40'
                      : 'border-rose-300 bg-rose-50 dark:border-rose-700 dark:bg-rose-950/40',
                  )}
                >
                  <span className="text-muted-foreground">{t.kind}</span>
                  <span className="font-semibold">{t.name}</span>
                  <span className="ml-auto flex items-center gap-1 text-[10px] font-sans font-semibold">
                    {live ? (
                      <><Check className="h-3 w-3 text-emerald-500" /> initialized (line {t.line})</>
                    ) : (
                      <><Ban className="h-3 w-3 text-rose-500" /> in TDZ until line {t.line}</>
                    )}
                  </span>
                </div>
              )
            })}
          </div>
        </section>
      )}
    </div>
  )
}
