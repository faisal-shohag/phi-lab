'use client'

import Link from 'next/link'
import { Trophy, Clock, ListChecks, Radio } from 'lucide-react'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { cn } from '@/lib/utils'
import { useContestClock, Countdown } from './countdown'
import type { ContestSummary } from '@/lib/code-lab/contests'

// A contest, as a card. Live status: the clock ticks locally so a "starts in"
// card becomes a "live" card the moment the window opens, without a reload.
export function ContestCard({ contest, className }: { contest: ContestSummary; className?: string }) {
  const { status, secondsLeft } = useContestClock(contest.startsAt, contest.endsAt)

  const accent =
    status === 'RUNNING'
      ? 'from-emerald-500/15 to-teal-500/5 border-emerald-500/30'
      : status === 'UPCOMING'
        ? 'from-amber-500/15 to-orange-500/5 border-amber-500/30'
        : 'from-muted/40 to-transparent'

  return (
    <Link
      href={`/labs/code-lab/contests/${contest.slug}`}
      className={cn(
        'group relative flex flex-col gap-3 overflow-hidden rounded-xl border bg-gradient-to-br p-4 transition-shadow hover:shadow-md',
        accent,
        className,
      )}
    >
      <div className="flex items-center justify-between gap-2">
        <StatusBadge status={status} />
        <span className="flex items-center gap-1 text-xs text-muted-foreground">
          <ListChecks className="h-3.5 w-3.5" /> {contest.problemCount} problems
        </span>
      </div>

      <div className="flex items-start gap-2">
        <Trophy className="mt-0.5 h-5 w-5 shrink-0 text-amber-500" />
        <div className="min-w-0">
          <h3 className="truncate font-semibold leading-tight">{contest.title}</h3>
          <p className="line-clamp-2 text-xs text-muted-foreground">{contest.description}</p>
        </div>
      </div>

      <div className="mt-auto flex items-center justify-between gap-2 pt-1">
        <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
          <Avatar className="h-5 w-5">
            <AvatarImage src={contest.author.image ?? undefined} />
            <AvatarFallback className="text-[9px]">{contest.author.name.slice(0, 2).toUpperCase()}</AvatarFallback>
          </Avatar>
          {contest.author.name}
        </span>
        {status !== 'FINISHED' && (
          <span
            className={cn(
              'flex items-center gap-1 text-xs font-medium',
              status === 'RUNNING' ? 'text-emerald-600 dark:text-emerald-400' : 'text-amber-600 dark:text-amber-400',
            )}
          >
            <Clock className="h-3.5 w-3.5" />
            {status === 'RUNNING' ? 'Ends in ' : 'Starts in '}
            <Countdown secondsLeft={secondsLeft} />
          </span>
        )}
      </div>
    </Link>
  )
}

function StatusBadge({ status }: { status: 'UPCOMING' | 'RUNNING' | 'FINISHED' }) {
  if (status === 'RUNNING')
    return (
      <span className="flex items-center gap-1 rounded-full bg-emerald-500/15 px-2 py-0.5 text-xs font-semibold text-emerald-600 dark:text-emerald-400">
        <Radio className="h-3 w-3 animate-pulse" /> Live
      </span>
    )
  if (status === 'UPCOMING')
    return (
      <span className="rounded-full bg-amber-500/15 px-2 py-0.5 text-xs font-semibold text-amber-600 dark:text-amber-400">
        Upcoming
      </span>
    )
  return <span className="rounded-full bg-muted px-2 py-0.5 text-xs font-semibold text-muted-foreground">Finished</span>
}
