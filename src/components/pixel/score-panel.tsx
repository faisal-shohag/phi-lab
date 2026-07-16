'use client'

import { AlertTriangle, ChevronDown, Loader2, Target, Trophy } from 'lucide-react'

import { TIER_BLURB, TIER_LABEL, TIERS, type Tier } from '@/lib/pixel/score'
import { cn } from '@/lib/utils'

export interface ScoreResult {
  /** Of the pixels either side painted, how many are right. The headline. */
  score: number
  percent: number
  /** How much of the whole canvas is identical. Shown beside the score, never as it. */
  match: number
  matchPercent: number
  diffPixels: number
  unionPixels: number
  totalPixels: number
  tiers: Tier[]
  freshTiers: Tier[]
  next: { tier: Tier; at: number } | null
  perfectAt: number
  xpGained: number
}

function Bar({ percent, perfectAt }: { percent: number; perfectAt: number }) {
  return (
    <div className="relative h-2 w-full overflow-hidden rounded-full bg-muted">
      <div
        className={cn(
          'h-full rounded-full transition-[width] duration-500',
          percent >= perfectAt * 100
            ? 'bg-emerald-500'
            : percent >= 90
              ? 'bg-sky-500'
              : percent >= 75
                ? 'bg-amber-500'
                : 'bg-rose-500',
        )}
        style={{ width: `${Math.max(0, Math.min(100, percent))}%` }}
      />
    </div>
  )
}

export function ScorePanel({
  result,
  pending,
  error,
  onHide,
}: {
  result: ScoreResult | null
  pending: boolean
  error: string | null
  /** Give the space back. The panel is worth a third of the column only once it has a number. */
  onHide?: () => void
}) {
  return (
    <section className="flex h-full min-h-0 flex-col overflow-hidden rounded-xl border-2 border-border bg-card shadow-sm">
      <div className="flex shrink-0 items-center gap-2 border-b bg-muted/50 px-3 py-2">
        <Target className="h-4 w-4 text-muted-foreground" />
        <span className="text-sm font-semibold">Score</span>
        {result && (
          <span className="ml-auto font-mono text-[11px] text-muted-foreground tabular-nums">
            {result.diffPixels.toLocaleString()} / {result.unionPixels.toLocaleString()} drawn px off
          </span>
        )}
        {onHide && (
          <button
            type="button"
            onClick={onHide}
            aria-label="Hide the score panel"
            title="Hide"
            className={cn(
              'shrink-0 rounded p-0.5 text-muted-foreground transition-colors hover:bg-accent hover:text-foreground',
              !result && 'ml-auto',
            )}
          >
            <ChevronDown className="size-3.5" />
          </button>
        )}
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto">
        {pending ? (
          <div className="flex items-center gap-2 p-4 text-sm text-muted-foreground">
            <Loader2 className="size-4 animate-spin text-pink-500" />
            Rendering your build and comparing it…
          </div>
        ) : error ? (
          <div className="flex items-start gap-2 p-4 text-sm text-rose-600 dark:text-rose-400">
            <AlertTriangle className="mt-0.5 size-4 shrink-0" />
            <p>{error}</p>
          </div>
        ) : !result ? (
          <div className="p-4 text-sm text-muted-foreground">
            <p>Build it, then score it.</p>
            <p className="mt-1 text-xs">
              Your code is rendered in a real browser on our side and compared to the target, pixel by
              pixel.
            </p>
          </div>
        ) : (
          <div className="space-y-4 p-4">
            <div>
              <div className="mb-2 flex items-baseline gap-3">
                <span className="font-mono text-3xl font-bold tabular-nums">{result.percent}%</span>
                <span className="text-[11px] leading-tight text-muted-foreground">
                  of what you and the target both drew
                </span>
                {result.xpGained > 0 && (
                  <span className="ml-auto font-mono text-sm font-black tabular-nums text-emerald-600 dark:text-emerald-400">
                    +{result.xpGained} XP
                  </span>
                )}
              </div>
              <Bar percent={result.percent} perfectAt={result.perfectAt} />
              {/* The raw match, always. It answers a real question — "how much of
                  this picture is already identical" — that the score deliberately
                  does not, because on a sparse canvas the honest answer to that
                  question is 98% before you have written a line. */}
              <p className="mt-2 font-mono text-[11px] text-muted-foreground tabular-nums">
                {result.matchPercent}% of the whole canvas matches ·{' '}
                {result.diffPixels.toLocaleString()} of {result.totalPixels.toLocaleString()} pixels
                differ
              </p>
            </div>

            <div className="space-y-2">
              {TIERS.map((tier) => {
                const earned = result.tiers.includes(tier)
                return (
                  <div key={tier} className="flex items-start gap-2.5">
                    <Trophy
                      aria-hidden
                      className={cn(
                        'mt-0.5 size-4 shrink-0',
                        earned ? 'text-amber-500' : 'text-muted-foreground/30',
                      )}
                    />
                    <div>
                      <p className={cn('text-sm font-medium', !earned && 'text-muted-foreground')}>
                        {TIER_LABEL[tier]}
                      </p>
                      <p className="text-xs text-muted-foreground">{TIER_BLURB[tier]}</p>
                    </div>
                  </div>
                )
              })}
            </div>

            {/* The next bar, not a lecture. A learner who can see they are 1.2% off
                Close will go and find the 1.2%. */}
            {result.next && (
              <p className="rounded-md bg-muted px-3 py-2 text-xs text-muted-foreground">
                {Math.round(result.next.at * 1000) / 10}% gets you {TIER_LABEL[result.next.tier]} — you
                are{' '}
                <span className="font-mono font-medium tabular-nums">
                  {Math.round((result.next.at - result.score) * 1000) / 10}%
                </span>{' '}
                away. Try Diff mode: anything you can see is a mistake.
              </p>
            )}
          </div>
        )}
      </div>
    </section>
  )
}
