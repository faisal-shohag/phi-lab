'use client'

import { useEffect, useState } from 'react'
import { Loader2, Crown } from 'lucide-react'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { cn } from '@/lib/utils'
import type { Standings } from '@/lib/code-lab/contests'

// Heat ramp shared with the weekly leaderboard, so ranks read the same language
// everywhere.
function rankHeat(rank: number): string {
  if (rank === 1) return 'text-orange-500'
  if (rank === 2) return 'text-amber-500'
  if (rank === 3) return 'text-amber-400'
  return 'text-muted-foreground'
}

/** Live contest standings. Polls every 15s while the contest is running. */
export function ContestStandings({ slug, live }: { slug: string; live: boolean }) {
  const [data, setData] = useState<Standings | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let cancelled = false
    const load = () => {
      fetch(`/api/code-lab/contests/${slug}/standings`)
        .then((r) => (r.ok ? r.json() : null))
        .then((d) => { if (!cancelled) { setData(d); setLoading(false) } })
        .catch(() => { if (!cancelled) setLoading(false) })
    }
    load()
    const id = live ? setInterval(load, 15000) : null
    return () => { cancelled = true; if (id) clearInterval(id) }
  }, [slug, live])

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12 text-muted-foreground">
        <Loader2 className="h-5 w-5 animate-spin" />
      </div>
    )
  }
  if (!data || data.rows.length === 0) {
    return <p className="py-12 text-center text-sm text-muted-foreground">No one has scored yet. Be the first.</p>
  }

  return (
    <div className="overflow-hidden rounded-lg border">
      <table className="w-full text-sm">
        <thead className="border-b bg-muted/40 text-xs text-muted-foreground">
          <tr>
            <th className="px-3 py-2 text-left font-medium">#</th>
            <th className="px-3 py-2 text-left font-medium">Learner</th>
            <th className="px-3 py-2 text-right font-medium">Solved</th>
            <th className="px-3 py-2 text-right font-medium">Points</th>
          </tr>
        </thead>
        <tbody className="divide-y">
          {data.rows.map((r, i) => {
            const rank = i + 1
            const me = r.userId === data.meId
            return (
              <tr key={r.userId} className={cn(me && 'bg-primary/5')}>
                <td className={cn('px-3 py-2 font-mono font-semibold tabular-nums', rankHeat(rank))}>
                  <span className="flex items-center gap-1">
                    {rank === 1 && <Crown className="h-3.5 w-3.5" />}
                    {rank}
                  </span>
                </td>
                <td className="px-3 py-2">
                  <span className="flex items-center gap-2">
                    <Avatar className="h-6 w-6">
                      <AvatarImage src={r.image ?? undefined} />
                      <AvatarFallback className="text-[10px]">{r.name.slice(0, 2).toUpperCase()}</AvatarFallback>
                    </Avatar>
                    <span className={cn('truncate', me && 'font-semibold')}>{r.name}{me && ' (you)'}</span>
                  </span>
                </td>
                <td className="px-3 py-2 text-right tabular-nums text-muted-foreground">{r.solved}</td>
                <td className="px-3 py-2 text-right font-semibold tabular-nums">{r.points}</td>
              </tr>
            )
          })}
        </tbody>
      </table>
      {data.you.rank === null && (
        <p className="border-t px-3 py-2 text-xs text-muted-foreground">You haven&apos;t scored in this contest yet.</p>
      )}
    </div>
  )
}
