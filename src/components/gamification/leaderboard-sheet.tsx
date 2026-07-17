'use client'

// The weekly board, in the same flame language as Challenge mode — this is a
// competitive surface, so it should look like the arena it ranks.
//
// A right sheet rather than a centred dialog: the board is a tall, narrow list,
// and sliding it in keeps the editor visible behind, so checking your rank
// doesn't feel like leaving what you were doing.
//
// Shared by every lab that ranks people, which is why it takes an `endpoint`
// rather than knowing one. Each lab's route returns the same shape (see
// lib/hive/leaderboard.ts for the ISO-week helpers they all build on), so the
// only thing that differs between boards is the URL and what to say when nobody
// has scored yet. The flame is deliberately *not* per-lab: a learner should
// recognise a leaderboard on sight, wherever they meet one.

import { useEffect, useState } from 'react'
import { Flame, Loader2, Crown } from 'lucide-react'
import { motion } from 'framer-motion'
import {
  Sheet, SheetContent, SheetFooter, SheetHeader, SheetTitle,
} from '@/components/ui/sheet'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { cn } from '@/lib/utils'

interface Row { userId: string; name: string; image: string | null; xp: number }
interface Data { week: string; rows: Row[]; you: { rank: number | null; xp: number }; meId: string }

// Podium metal. Kept literal rather than folded into the flame ramp: medal
// colours are read instantly and mean a specific place, which heat does not.
const PODIUM = [
  { medal: '🥇', col: 'from-amber-300 to-amber-500', ring: 'border-amber-400', h: 'h-20' },
  { medal: '🥈', col: 'from-slate-300 to-slate-400', ring: 'border-slate-300', h: 'h-14' },
  { medal: '🥉', col: 'from-orange-400 to-orange-600', ring: 'border-orange-400', h: 'h-10' },
]

// How hot a rank runs — the same ramp as the win-streak flame in
// challenge-arena, so the two surfaces speak one language.
function rankHeat(rank: number): string {
  if (rank === 1) return 'text-orange-500'
  if (rank === 2) return 'text-amber-500'
  if (rank === 3) return 'text-amber-400'
  return 'text-muted-foreground'
}

function initials(name: string): string {
  return name.slice(0, 2).toUpperCase()
}

export interface LeaderboardSheetProps {
  open: boolean
  onOpenChange: (v: boolean) => void
  /** A GET returning `{ week, rows, you, meId }`. */
  endpoint: string
  /** Shown when the board is empty. Name what earns XP *in this lab* — "solve a problem" is no help in Pixel Lab. */
  emptyMessage: string
  /** Header title. Defaults to the weekly-XP framing. */
  title?: string
  /** Unit shown after the caller's own score in the footer. Defaults to "XP". */
  unit?: string
  /** Footer label for the caller's rank. Defaults to "Your rank this week". */
  youLabel?: string
  /** Footer text when the caller is unranked. */
  emptyYouMessage?: string
}

export function LeaderboardSheet({
  open,
  onOpenChange,
  endpoint,
  emptyMessage,
  title = 'Weekly ranks',
  unit = 'XP',
  youLabel = 'Your rank this week',
  emptyYouMessage = 'Earn some XP this week to claim your spot.',
}: LeaderboardSheetProps) {
  const [data, setData] = useState<Data | null>(null)
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (!open) return
    /* eslint-disable react-hooks/set-state-in-effect */
    setLoading(true)
    fetch(endpoint)
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => setData(d))
      .catch(() => setData(null))
      .finally(() => setLoading(false))
    /* eslint-enable react-hooks/set-state-in-effect */
  }, [open, endpoint])

  // A podium needs three to stand on. Below that the board is just a list, and
  // rank is its plain number.
  const podium = data && data.rows.length >= 3 ? data.rows.slice(0, 3) : null
  const listRows = data ? (podium ? data.rows.slice(3) : data.rows) : []

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      {/* The width variant must match the default's full key
          (data-[side=right]:sm:max-w-sm) or tailwind-merge keeps both and the
          more specific default wins the cascade — the sheet would silently
          stay at its narrow default. */}
      <SheetContent
        side="right"
        className="data-[side=right]:sm:max-w-md gap-0 border-l-2 border-rose-500/50 bg-linear-to-b from-rose-50 to-orange-50 p-0 dark:from-rose-950/50 dark:to-orange-950/30"
      >
        <SheetHeader className="border-b border-rose-500/30 bg-background/40 p-4">
          <SheetTitle className="flex items-center gap-2 text-base font-black uppercase tracking-wide text-rose-700 dark:text-rose-300">
            <Flame className="h-5 w-5 fill-current text-orange-500" />
            {title}
            {/* The period the board covers. Fetched since day one and never
                rendered — a leaderboard with no date on it can't be read. */}
            {data?.week && (
              <span className="ml-auto mr-6 rounded-full bg-rose-500/15 px-2 py-0.5 font-mono text-[10px] font-bold tracking-normal text-rose-700 dark:text-rose-300">
                {data.week}
              </span>
            )}
          </SheetTitle>
        </SheetHeader>

        <div className="flex-1 overflow-y-auto p-4">
          {loading ? (
            <div className="flex items-center justify-center gap-2 py-16 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin text-rose-500" /> loading…
            </div>
          ) : !data || data.rows.length === 0 ? (
            <div className="flex flex-col items-center gap-3 py-16 text-center">
              <span className="flex h-12 w-12 items-center justify-center rounded-xl bg-linear-to-br from-rose-500 to-orange-600 opacity-40">
                <Flame className="h-6 w-6 text-white" />
              </span>
              <p className="max-w-[15rem] text-sm text-muted-foreground">{emptyMessage}</p>
            </div>
          ) : (
            <>
              {podium && (
                <div className="mb-4 flex items-end justify-center gap-2 rounded-xl bg-linear-to-b from-rose-500/10 to-transparent px-2 pt-3">
                  {/* Rendered 2nd · 1st · 3rd so the winner stands in the middle. */}
                  {[1, 0, 2].map((place, idx) => {
                    const r = podium[place]
                    const p = PODIUM[place]
                    const isMe = r.userId === data.meId
                    return (
                      <motion.div
                        key={r.userId}
                        initial={{ y: 24, opacity: 0 }}
                        animate={{ y: 0, opacity: 1 }}
                        transition={{ delay: 0.06 * idx, type: 'spring', stiffness: 280, damping: 20 }}
                        className="flex w-1/3 flex-col items-center gap-1"
                      >
                        <span className="text-lg">{p.medal}</span>
                        <Avatar className={cn('border-2', place === 0 ? 'h-11 w-11' : 'h-9 w-9', p.ring)}>
                          {r.image && <AvatarImage src={r.image} alt={r.name} referrerPolicy="no-referrer" />}
                          <AvatarFallback className="bg-linear-to-br from-rose-500 to-orange-600 text-[11px] font-semibold text-white">
                            {initials(r.name)}
                          </AvatarFallback>
                        </Avatar>
                        <span className="max-w-full truncate text-[11px] font-semibold">{r.name}</span>
                        <span className="font-mono text-[11px] font-black tabular-nums text-emerald-600 dark:text-emerald-400">
                          {r.xp}
                        </span>
                        {/* The "that's you" ring needs a gap: rose sitting
                            directly on the bronze gradient is rose-on-orange
                            and reads as no ring at all. */}
                        <div
                          className={cn(
                            'w-full rounded-t-md bg-linear-to-b',
                            p.h, p.col,
                            isMe && 'ring-2 ring-rose-500 ring-offset-2 ring-offset-background',
                          )}
                        />
                      </motion.div>
                    )
                  })}
                </div>
              )}

              <ol className="space-y-1">
                {listRows.map((r, idx) => {
                  const rank = podium ? idx + 4 : idx + 1
                  const isMe = r.userId === data.meId
                  return (
                    <li
                      key={r.userId}
                      className={cn(
                        'flex items-center gap-3 rounded-lg px-2.5 py-2',
                        isMe ? 'bg-rose-500/15 ring-1 ring-rose-400/50' : 'hover:bg-rose-500/5',
                      )}
                    >
                      <span className={cn('w-6 text-center font-mono text-sm font-black tabular-nums', rankHeat(rank))}>
                        {rank}
                      </span>
                      <Avatar className="h-8 w-8">
                        {r.image && <AvatarImage src={r.image} alt={r.name} referrerPolicy="no-referrer" />}
                        <AvatarFallback className="bg-linear-to-br from-rose-500 to-orange-600 text-[11px] font-semibold text-white">
                          {initials(r.name)}
                        </AvatarFallback>
                      </Avatar>
                      <span className="min-w-0 flex-1 truncate text-sm font-medium">{r.name}</span>
                      {rank === 1 && <Crown className="h-4 w-4 shrink-0 text-amber-500" />}
                      <span className="shrink-0 font-mono text-sm font-black tabular-nums text-emerald-600 dark:text-emerald-400">
                        {r.xp}
                      </span>
                    </li>
                  )
                })}
              </ol>
            </>
          )}
        </div>

        {/* Your own standing is the one row you always want — pinned, so a long
            board can't scroll it away. */}
        <SheetFooter className="border-t border-rose-500/30 bg-background/40 p-4">
          {data?.you.rank ? (
            <div className="flex items-center justify-between gap-2">
              <span className="text-xs text-muted-foreground">{youLabel}</span>
              <span className="flex items-center gap-2">
                <span className={cn('font-mono text-sm font-black tabular-nums', rankHeat(data.you.rank))}>
                  #{data.you.rank}
                </span>
                <span className="font-mono text-sm font-black tabular-nums text-emerald-600 dark:text-emerald-400">
                  {data.you.xp} {unit}
                </span>
              </span>
            </div>
          ) : (
            <p className="text-center text-xs text-muted-foreground">{emptyYouMessage}</p>
          )}
        </SheetFooter>
      </SheetContent>
    </Sheet>
  )
}
