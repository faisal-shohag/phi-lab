'use client'

import { RefreshCw, Trophy } from 'lucide-react'
import type { PathSnapshot } from '@/lib/path/types'
import { cn } from '@/lib/utils'

interface Props {
  snap: PathSnapshot
  userName: string
  onRefresh: () => void
  refreshing: boolean
}

export function PathHeader({ snap, userName, onRefresh, refreshing }: Props) {
  const pct = snap.totalNodes > 0 ? Math.round((snap.masteredCount / snap.totalNodes) * 100) : 0
  const first = userName.split(' ')[0]

  return (
    <div className="rounded-2xl border bg-linear-to-br from-amber-500/10 via-background to-orange-500/5 p-5">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-widest text-amber-600 dark:text-amber-400">
            Level {snap.level} · {snap.levelTitle}
          </p>
          <h2 className="mt-1 text-xl font-black">
            {snap.masteredCount === 0 ? `Welcome, ${first}. Let's begin.` : `Keep going, ${first}.`}
          </h2>
        </div>
        <button
          onClick={onRefresh}
          className="rounded-lg border px-2.5 py-1.5 text-xs font-semibold text-muted-foreground transition hover:bg-muted"
          title="Refresh progress"
        >
          <RefreshCw className={cn('h-3.5 w-3.5', refreshing && 'animate-spin')} />
        </button>
      </div>

      <div className="mt-4 flex items-center gap-3">
        <div className="flex items-center gap-1.5 text-sm font-bold">
          <Trophy className="h-4 w-4 text-amber-500" />
          {snap.masteredCount}/{snap.totalNodes} mastered
        </div>
        <div className="h-2 flex-1 overflow-hidden rounded-full bg-muted">
          <div
            className="h-full rounded-full bg-linear-to-r from-amber-400 to-orange-500 transition-all"
            style={{ width: `${pct}%` }}
          />
        </div>
        <span className="text-sm font-mono font-bold text-muted-foreground">{pct}%</span>
      </div>
    </div>
  )
}
