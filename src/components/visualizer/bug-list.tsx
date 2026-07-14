'use client'

// The Bug Hunt sidebar: a flat run of broken programs, each showing its symptom
// and what it pays. No topic accordion — these are picked by appetite, not by
// syllabus order, so the whole list stays visible.

import { motion } from 'framer-motion'
import { Bug, Check } from 'lucide-react'
import { BUG_LEVELS, type BugLevel } from '@/lib/visualizer/bugs'
import { cn } from '@/lib/utils'

export interface BugListProps {
  activeBugId: string
  completedIds: Set<string>
  onPick: (b: BugLevel) => void
  /** XP payout per difficulty, so the list can price each level. */
  xpFor: (difficulty: number) => number
  calm: boolean
  signedIn: boolean
}

const DIFFICULTY_LABEL: Record<number, string> = { 1: 'Easy', 2: 'Tricky', 3: 'Nasty' }

const DIFFICULTY_TINT: Record<number, string> = {
  1: 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-400',
  2: 'bg-amber-500/15 text-amber-700 dark:text-amber-400',
  3: 'bg-rose-500/15 text-rose-700 dark:text-rose-400',
}

export function BugList({ activeBugId, completedIds, onPick, xpFor, calm, signedIn }: BugListProps) {
  const done = BUG_LEVELS.filter((b) => completedIds.has(b.id)).length

  return (
    <div className="flex-1 overflow-y-auto p-2 space-y-2">
      <div className="rounded-lg border-2 border-border bg-muted/40 p-2.5">
        <div className="flex items-center justify-between text-[11px] font-semibold">
          <span>Bugs squashed</span>
          {signedIn && <span className="tabular-nums text-muted-foreground">{done}/{BUG_LEVELS.length}</span>}
        </div>
        {signedIn && (
          <div className="mt-1.5 h-1.5 w-full overflow-hidden rounded-full bg-border">
            <motion.div
              className="h-full rounded-full bg-linear-to-r from-lime-500 to-emerald-600"
              initial={false}
              animate={{ width: `${BUG_LEVELS.length ? (done / BUG_LEVELS.length) * 100 : 0}%` }}
              transition={calm ? { duration: 0.6 } : { type: 'spring', stiffness: 120, damping: 20 }}
            />
          </div>
        )}
        <p className="mt-2 text-[10.5px] leading-snug text-muted-foreground">
          Each program is already written, and already wrong. Read it, find the mistake, fix it — then press{' '}
          <strong>Check</strong>. Run it first: watching it go wrong is half the hunt.
        </p>
      </div>

      {BUG_LEVELS.map((b) => {
        const isDone = completedIds.has(b.id)
        const isActive = activeBugId === b.id
        return (
          <button
            key={b.id}
            onClick={() => onPick(b)}
            className={cn(
              'w-full text-left p-2 rounded-lg border-2 transition-colors duration-150',
              isActive
                ? 'border-foreground bg-foreground text-background'
                : 'border-border bg-card hover:border-foreground/30 hover:bg-accent',
            )}
          >
            <div className="flex items-start gap-1.5">
              <span className={cn(
                'mt-0.5 shrink-0',
                isDone ? 'text-emerald-500' : isActive ? 'text-background/50' : 'text-muted-foreground/60',
              )}>
                {isDone ? <Check className="h-3.5 w-3.5" /> : <Bug className="h-3.5 w-3.5" />}
              </span>
              <span className="min-w-0 flex-1">
                <span className="flex items-center gap-1.5">
                  <span className="font-medium text-xs leading-tight truncate flex-1">{b.title}</span>
                  <span className={cn(
                    'shrink-0 rounded px-1 py-px text-[9px] font-bold uppercase tracking-wide',
                    isActive ? 'bg-background/20 text-background' : DIFFICULTY_TINT[b.difficulty],
                  )}>
                    {DIFFICULTY_LABEL[b.difficulty]} · {xpFor(b.difficulty)} XP
                  </span>
                </span>
                <span className={cn(
                  'mt-0.5 block text-[10px] leading-snug',
                  isActive ? 'text-background/70' : 'text-muted-foreground',
                )}>
                  {b.symptom}
                </span>
              </span>
            </div>
          </button>
        )
      })}
    </div>
  )
}
