'use client'

import { useEffect, useState } from 'react'
import { Trophy, Loader2, Crown } from 'lucide-react'
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
            <ol className="space-y-1">
              {data.rows.map((r, i) => (
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
              ))}
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
