'use client'

// Everything you have tried on this challenge, and what it scored.
//
// The value is the arc, not any one row: seeing 12% become 46% become 100% is
// the only place this lab shows a learner that they got better at something.
// The score panel shows the last attempt and the map shows the best; neither
// shows the climb.
//
// Restoring an attempt puts old code back in the editor, so it doubles as an
// undo for "I broke it and I liked it better before".

import { useCallback, useEffect, useState } from 'react'
import { Clock, Loader2, RotateCcw, Trophy } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet'
import { matchPercent } from '@/lib/pixel/diff'
import { TIER_LABEL, type Tier } from '@/lib/pixel/score'
import { cn } from '@/lib/utils'

export interface Submission {
  id: string
  challengeId: string
  html: string
  css: string
  score: number
  match: number
  diffPixels: number
  unionPixels: number
  tiers: Tier[]
  createdAt: string
}

function when(iso: string): string {
  const then = new Date(iso).getTime()
  const mins = Math.round((Date.now() - then) / 60_000)
  if (mins < 1) return 'just now'
  if (mins < 60) return `${mins}m ago`
  const hours = Math.round(mins / 60)
  if (hours < 24) return `${hours}h ago`
  return `${Math.round(hours / 24)}d ago`
}

export function HistorySheet({
  open,
  onOpenChange,
  challengeId,
  challengeTitle,
  onRestore,
}: {
  open: boolean
  onOpenChange: (v: boolean) => void
  challengeId: string
  challengeTitle: string
  onRestore: (s: Submission) => void
}) {
  const [rows, setRows] = useState<Submission[] | null>(null)
  const [loading, setLoading] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch(`/api/labs/pixel-lab/submissions?challengeId=${encodeURIComponent(challengeId)}`)
      const body = res.ok ? await res.json() : { submissions: [] }
      setRows(body.submissions ?? [])
    } catch {
      setRows([])
    } finally {
      setLoading(false)
    }
  }, [challengeId])

  useEffect(() => {
    if (!open) return
    /* eslint-disable react-hooks/set-state-in-effect */
    void load()
    /* eslint-enable react-hooks/set-state-in-effect */
  }, [open, load])

  const best = rows?.reduce((b, r) => (!b || r.score > b.score ? r : b), null as Submission | null)

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      {/* The width override must repeat the default's full key
          (data-[side=right]:sm:max-w-sm) or tailwind-merge keeps both and the
          narrow default wins. Same trap as the leaderboard. */}
      <SheetContent side="right" className="gap-0 p-0 data-[side=right]:sm:max-w-md">
        <SheetHeader className="border-b bg-muted/50 p-4">
          <SheetTitle className="flex items-center gap-2 text-base font-bold">
            <Clock className="size-4 text-muted-foreground" />
            Your attempts
            <span className="ml-auto truncate text-xs font-medium text-muted-foreground">{challengeTitle}</span>
          </SheetTitle>
        </SheetHeader>

        <div className="flex-1 overflow-y-auto p-4">
          {loading ? (
            <div className="flex items-center justify-center gap-2 py-16 text-sm text-muted-foreground">
              <Loader2 className="size-4 animate-spin text-pink-500" /> loading…
            </div>
          ) : !rows || rows.length === 0 ? (
            <div className="py-16 text-center text-sm text-muted-foreground">
              <p>No attempts yet.</p>
              <p className="mt-1 text-xs">Press Score and this fills up.</p>
            </div>
          ) : (
            <ol className="space-y-2">
              {rows.map((s) => {
                const pct = matchPercent(s.score)
                const isBest = best?.id === s.id
                return (
                  <li
                    key={s.id}
                    className={cn(
                      'rounded-lg border-2 p-3 transition-colors',
                      isBest ? 'border-amber-400/60 bg-amber-400/5' : 'border-border bg-card',
                    )}
                  >
                    <div className="flex items-baseline gap-2">
                      <span className="font-mono text-lg font-bold tabular-nums">{pct}%</span>
                      {isBest && (
                        <span className="flex items-center gap-1 rounded-full bg-amber-400/20 px-1.5 py-0.5 text-[10px] font-bold uppercase text-amber-600 dark:text-amber-400">
                          <Trophy className="size-2.5" />
                          best
                        </span>
                      )}
                      {s.tiers.length > 0 && (
                        <span className="text-[11px] text-muted-foreground">{TIER_LABEL[s.tiers[s.tiers.length - 1]]}</span>
                      )}
                      <span className="ml-auto shrink-0 text-[11px] text-muted-foreground">{when(s.createdAt)}</span>
                    </div>

                    <p className="mt-1 font-mono text-[10px] text-muted-foreground tabular-nums">
                      {matchPercent(s.match)}% of the canvas · {s.diffPixels.toLocaleString()} of{' '}
                      {s.unionPixels.toLocaleString()} drawn px off
                    </p>

                    <div className="mt-2 flex items-center gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        className="h-6 gap-1 text-[11px]"
                        onClick={() => {
                          onRestore(s)
                          onOpenChange(false)
                        }}
                      >
                        <RotateCcw className="size-3" />
                        Load into the editor
                      </Button>
                      <span className="truncate font-mono text-[10px] text-muted-foreground/70">
                        {s.css.replace(/\s+/g, ' ').trim().slice(0, 40) || '(no css)'}
                      </span>
                    </div>
                  </li>
                )
              })}
            </ol>
          )}
        </div>
      </SheetContent>
    </Sheet>
  )
}
