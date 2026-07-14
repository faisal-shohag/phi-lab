'use client'

// The bar under the editor while a practice problem or a Bug Hunt level is
// open: what to print, a Check button, and — after a failed run — what came out
// versus what should have. The diff is deliberately generous: seeing both
// columns is how you learn what "off by one line" means.
//
// Takes a title and a goal rather than a Problem so both exercise kinds can use
// it; only the icon changes.

import { AnimatePresence, motion } from 'framer-motion'
import { Bug, CheckCircle2, Loader2, PencilRuler, XCircle } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'

export interface CheckResult {
  passed: boolean
  message?: string
  expected?: string[]
  got?: string[] | null
  xpGained?: number
}

export interface PracticeCheckProps {
  title: string
  goal: string
  /** 'practice' — write it yourself · 'bug' — repair what's there. */
  kind?: 'practice' | 'bug'
  result: CheckResult | null
  busy: boolean
  locked: boolean
  onCheck: () => void
  calm: boolean
}

export function PracticeCheck({ title, goal, kind = 'practice', result, busy, locked, onCheck, calm }: PracticeCheckProps) {
  const Icon = kind === 'bug' ? Bug : PencilRuler
  return (
    <div className={cn(
      'shrink-0 rounded-lg border-2 px-3 py-2',
      result?.passed
        ? 'border-emerald-500/50 bg-emerald-500/5'
        : result && !result.passed
          ? 'border-rose-500/40 bg-rose-500/5'
          : 'border-amber-500/40 bg-amber-500/5',
    )}>
      <div className="flex items-start gap-2">
        <Icon className="h-4 w-4 mt-0.5 shrink-0 text-amber-600 dark:text-amber-400" />
        <div className="min-w-0 flex-1">
          <p className="text-xs font-semibold leading-tight">{title}</p>
          <p className="text-[11px] leading-snug text-muted-foreground mt-0.5">{goal}</p>
        </div>
        <Button
          size="sm"
          onClick={onCheck}
          disabled={busy || locked}
          title={locked ? 'Sign in to check your work' : 'Run your code and check the output'}
          className="shrink-0 bg-linear-to-r from-amber-500 to-orange-500 hover:opacity-90"
        >
          {busy ? <Loader2 className="h-3.5 w-3.5 mr-1 animate-spin" /> : <CheckCircle2 className="h-3.5 w-3.5 mr-1" />}
          {busy ? 'Checking…' : 'Check'}
        </Button>
      </div>

      <AnimatePresence initial={false}>
        {result && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: calm ? 0.3 : 0.16 }}
            className="overflow-hidden"
          >
            <div className="pt-2 mt-2 border-t border-border/60">
              {result.passed ? (
                <p className="flex items-center gap-1.5 text-xs font-semibold text-emerald-600 dark:text-emerald-400">
                  <CheckCircle2 className="h-3.5 w-3.5" />
                  {kind === 'bug' ? 'Fixed!' : 'Solved!'}
                  {typeof result.xpGained === 'number' && result.xpGained > 0 && <span>+{result.xpGained} XP</span>}
                  {result.xpGained === 0 && <span className="font-normal text-muted-foreground">(already counted)</span>}
                </p>
              ) : (
                <>
                  <p className="flex items-center gap-1.5 text-xs font-semibold text-rose-600 dark:text-rose-400">
                    <XCircle className="h-3.5 w-3.5" />
                    {result.message ?? 'Not quite yet'}
                  </p>
                  {result.expected && (
                    <div className="mt-2 grid grid-cols-2 gap-2">
                      <OutputColumn label="Expected" lines={result.expected} tone="good" />
                      <OutputColumn label="Your output" lines={result.got ?? []} tone="bad" empty="(nothing printed)" />
                    </div>
                  )}
                </>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}

function OutputColumn({ label, lines, tone, empty }: { label: string; lines: string[]; tone: 'good' | 'bad'; empty?: string }) {
  return (
    <div className="min-w-0">
      <p className="text-[9.5px] font-bold uppercase tracking-wide text-muted-foreground mb-1">{label}</p>
      <div className={cn(
        'rounded border px-1.5 py-1 font-mono text-[10.5px] leading-relaxed max-h-24 overflow-y-auto',
        tone === 'good' ? 'border-emerald-500/30 bg-emerald-500/5' : 'border-rose-500/30 bg-rose-500/5',
      )}>
        {lines.length === 0
          ? <span className="text-muted-foreground italic">{empty ?? '—'}</span>
          : lines.map((l, i) => <div key={i} className="truncate" title={l}>{l}</div>)}
      </div>
    </div>
  )
}
