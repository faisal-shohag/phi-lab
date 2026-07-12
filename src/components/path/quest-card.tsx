'use client'

import Link from 'next/link'
import { Flame, CheckCircle2, Circle, Sparkles, RotateCcw } from 'lucide-react'
import type { QuestView } from '@/lib/path/types'
import { cn } from '@/lib/utils'

export function QuestCard({ quest }: { quest: QuestView | null }) {
  if (!quest || quest.items.length === 0) {
    return (
      <div className="rounded-2xl border bg-card p-5">
        <div className="flex items-center gap-2 text-sm font-bold">
          <Sparkles className="h-4 w-4 text-emerald-500" /> Daily Quest
        </div>
        <p className="mt-3 text-sm text-muted-foreground">
          Nothing queued right now. Master a node to unlock tomorrow&apos;s quest.
        </p>
      </div>
    )
  }

  return (
    <div className="rounded-2xl border bg-card p-5">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2 text-sm font-bold">
          <Sparkles className="h-4 w-4 text-emerald-500" /> Daily Quest
        </div>
        <div
          className={cn(
            'flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-bold',
            quest.streak > 0 ? 'bg-orange-500/15 text-orange-600 dark:text-orange-400' : 'text-muted-foreground',
          )}
          title={quest.onGrace ? 'One skipped day forgiven — keep it alive today!' : `${quest.streak}-day streak`}
        >
          <Flame className={cn('h-3.5 w-3.5', quest.onGrace && 'opacity-50')} />
          {quest.streak}
        </div>
      </div>

      <ul className="mt-3 space-y-1.5">
        {quest.items.map((it) => (
          <li key={`${it.nodeId}-${it.stepId}`}>
            <Link
              href={it.href}
              className={cn(
                'flex items-center gap-2 rounded-lg px-2 py-1.5 text-sm transition hover:bg-muted',
                it.done && 'text-muted-foreground',
              )}
            >
              {it.done
                ? <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-500" />
                : it.review
                  ? <RotateCcw className="h-4 w-4 shrink-0 text-sky-500" />
                  : <Circle className="h-4 w-4 shrink-0 text-muted-foreground" />}
              <span className={cn('flex-1', it.done && 'line-through')}>{it.label}</span>
              <span className="text-xs text-muted-foreground">{it.minutes}m</span>
            </Link>
          </li>
        ))}
      </ul>

      <div className="mt-3 border-t pt-2 text-xs font-semibold text-muted-foreground">
        {quest.complete ? '✅ Done for today — see you tomorrow!' : `~${quest.minutes} min · +30 XP on completion`}
      </div>
    </div>
  )
}
