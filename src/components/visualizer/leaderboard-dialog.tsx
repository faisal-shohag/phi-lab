'use client'

import { useEffect, useState } from 'react'
import { Trophy, Loader2, Crown } from 'lucide-react'
import { motion } from 'framer-motion'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { cn } from '@/lib/utils'

interface Row { userId: string; name: string; image: string | null; xp: number }
interface Data { week: string; rows: Row[]; you: { rank: number | null; xp: number }; meId: string }

const MEDAL = ['🥇', '🥈', '🥉']

export function LeaderboardDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (v: boolean) => void }) {
  const [data, setData] = useState<Data | null>(null)
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (!open) return
    /* eslint-disable react-hooks/set-state-in-effect */
    setLoading(true)
    fetch('/api/labs/js-motion/leaderboard')
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => setData(d))
      .catch(() => setData(null))
      .finally(() => setLoading(false))
    /* eslint-enable react-hooks/set-state-in-effect */
  }, [open])

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Trophy className="h-5 w-5 text-amber-500" /> Weekly leaderboard
          </DialogTitle>
        </DialogHeader>

        {loading ? (
          <div className="flex items-center justify-center gap-2 py-10 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" /> loading…
          </div>
        ) : !data || data.rows.length === 0 ? (
          <div className="py-8 text-center text-sm text-muted-foreground">
            No XP earned yet this week. Run code, ace a quiz, or win a challenge to get on the board!
          </div>
        ) : (
          <>
            {/* Podium — top 3 on gold/silver/bronze columns. */}
            {data.rows.length >= 3 && (() => {
              const [first, second, third] = data.rows
              const order = [
                { r: second, place: 1, h: 'h-14', col: 'from-slate-300 to-slate-400', medal: '🥈' },
                { r: first, place: 0, h: 'h-20', col: 'from-amber-300 to-amber-500', medal: '🥇' },
                { r: third, place: 2, h: 'h-10', col: 'from-orange-400 to-orange-600', medal: '🥉' },
              ]
              return (
                <div className="mb-3 flex items-end justify-center gap-2 rounded-xl bg-linear-to-b from-amber-500/5 to-transparent px-2 pt-3">
                  {order.map(({ r, place, h, col, medal }, idx) => (
                    <motion.div
                      key={r.userId}
                      initial={{ y: 24, opacity: 0 }}
                      animate={{ y: 0, opacity: 1 }}
                      transition={{ delay: 0.06 * idx, type: 'spring', stiffness: 280, damping: 20 }}
                      className="flex w-1/3 flex-col items-center gap-1"
                    >
                      <span className="text-lg">{medal}</span>
                      <Avatar className={cn('border-2', place === 0 ? 'h-11 w-11 border-amber-400' : 'h-9 w-9 border-transparent')}>
                        {r.image && <AvatarImage src={r.image} alt={r.name} referrerPolicy="no-referrer" />}
                        <AvatarFallback className="bg-linear-to-br from-rose-500 to-orange-600 text-[11px] font-semibold text-white">{r.name.slice(0, 2).toUpperCase()}</AvatarFallback>
                      </Avatar>
                      <span className="max-w-full truncate text-[11px] font-semibold">{r.name}</span>
                      <span className="font-mono text-[11px] font-bold text-emerald-600 dark:text-emerald-400">{r.xp}</span>
                      <div className={cn('w-full rounded-t-md bg-linear-to-b', h, col, r.userId === data.meId && 'ring-2 ring-amber-400')} />
                    </motion.div>
                  ))}
                </div>
              )
            })()}
            <ol className="space-y-1">
              {(data.rows.length >= 3 ? data.rows.slice(3) : data.rows).map((r, idx) => {
                const i = data.rows.length >= 3 ? idx + 3 : idx
                return (
                <li
                  key={r.userId}
                  className={cn(
                    'flex items-center gap-3 rounded-lg px-2.5 py-2',
                    r.userId === data.meId ? 'bg-amber-500/15 ring-1 ring-amber-400/50' : 'hover:bg-muted',
                  )}
                >
                  <span className="w-6 text-center text-sm font-bold tabular-nums">{MEDAL[i] ?? i + 1}</span>
                  <Avatar className="h-8 w-8">
                    {r.image && <AvatarImage src={r.image} alt={r.name} referrerPolicy="no-referrer" />}
                    <AvatarFallback className="bg-linear-to-br from-rose-500 to-orange-600 text-[11px] font-semibold text-white">
                      {r.name.slice(0, 2).toUpperCase()}
                    </AvatarFallback>
                  </Avatar>
                  <span className="flex-1 truncate text-sm font-medium">{r.name}</span>
                  {i === 0 && <Crown className="h-4 w-4 text-amber-500" />}
                  <span className="font-mono text-sm font-bold text-emerald-600 dark:text-emerald-400">{r.xp}</span>
                </li>
                )
              })}
            </ol>
            <div className="mt-1 border-t pt-2 text-center text-xs text-muted-foreground">
              {data.you.rank
                ? <>You&apos;re <strong className="text-foreground">#{data.you.rank}</strong> this week with <strong className="text-foreground">{data.you.xp}</strong> XP.</>
                : 'Earn some XP this week to claim your spot.'}
            </div>
          </>
        )}
      </DialogContent>
    </Dialog>
  )
}
