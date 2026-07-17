'use client'

import { useState } from 'react'
import Link from 'next/link'
import { Trophy, Clock, Radio, Lock, CheckCircle2, ListChecks, BarChart3, Award } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { HiveMarkdown } from '@/components/hive/markdown'
import { cn } from '@/lib/utils'
import { DIFFICULTY_META } from './difficulty'
import { ContestStandings } from './contest-standings'
import { useContestClock, Countdown } from './countdown'
import type { ContestDetail } from '@/lib/code-lab/contests'

type Tab = 'problems' | 'standings'

export function ContestView({ contest }: { contest: ContestDetail }) {
  const { status, secondsLeft } = useContestClock(contest.startsAt, contest.endsAt)
  const [tab, setTab] = useState<Tab>('problems')

  return (
    <div className="space-y-6">
      {/* Header card */}
      <div className="overflow-hidden rounded-xl border bg-gradient-to-br from-amber-500/10 to-transparent p-5">
        <div className="mb-2 flex items-center justify-between gap-2">
          <StatusPill status={status} />
          {status !== 'FINISHED' && (
            <span
              className={cn(
                'flex items-center gap-1.5 text-sm font-medium',
                status === 'RUNNING' ? 'text-emerald-600 dark:text-emerald-400' : 'text-amber-600 dark:text-amber-400',
              )}
            >
              <Clock className="h-4 w-4" />
              {status === 'RUNNING' ? 'Ends in ' : 'Starts in '}
              <Countdown secondsLeft={secondsLeft} />
            </span>
          )}
        </div>
        <h1 className="flex items-center gap-2 text-2xl font-bold">
          <Trophy className="h-6 w-6 text-amber-500" /> {contest.title}
        </h1>
        <div className="mt-2 flex flex-wrap items-center gap-3 text-sm text-muted-foreground">
          <span className="flex items-center gap-1.5">
            <Avatar className="h-5 w-5">
              <AvatarImage src={contest.author.image ?? undefined} />
              <AvatarFallback className="text-[9px]">{contest.author.name.slice(0, 2).toUpperCase()}</AvatarFallback>
            </Avatar>
            {contest.author.name}
          </span>
          {status !== 'UPCOMING' && (
            <span className="flex items-center gap-1">
              <Award className="h-3.5 w-3.5" /> Your rank: {contest.myRank ? `#${contest.myRank}` : '—'} · {contest.myPoints} pts
            </span>
          )}
        </div>
      </div>

      <div className="prose-sm">
        <HiveMarkdown className="text-sm">{contest.description}</HiveMarkdown>
      </div>

      {/* Tabs */}
      <div className="flex items-center gap-4 border-b text-sm">
        <TabButton active={tab === 'problems'} onClick={() => setTab('problems')}>
          <ListChecks className="h-4 w-4" /> Problems
        </TabButton>
        <TabButton active={tab === 'standings'} onClick={() => setTab('standings')}>
          <BarChart3 className="h-4 w-4" /> Standings
        </TabButton>
      </div>

      {tab === 'problems' ? (
        status === 'UPCOMING' ? (
          <div className="rounded-lg border border-dashed p-10 text-center text-sm text-muted-foreground">
            <Lock className="mx-auto mb-2 h-6 w-6" />
            Problems unlock when the contest starts.
          </div>
        ) : (
          <div className="overflow-hidden rounded-lg border">
            <ul className="divide-y">
              {contest.problems.map((p, i) => (
                <li key={p.slug}>
                  <Link
                    href={
                      status === 'RUNNING'
                        ? `/labs/code-lab/contests/${contest.slug}/${p.slug}`
                        : `/labs/code-lab/${p.slug}`
                    }
                    className="flex items-center gap-3 px-4 py-3 transition-colors hover:bg-muted/50"
                  >
                    <span className="w-5 text-sm font-mono text-muted-foreground">{String.fromCharCode(65 + i)}</span>
                    {p.solved ? (
                      <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-500" />
                    ) : (
                      <span className="h-4 w-4 shrink-0 rounded-full border border-muted-foreground/30" />
                    )}
                    <span className="font-medium">{p.title}</span>
                    <Badge variant="outline" className={cn('ml-auto', DIFFICULTY_META[p.difficulty].className)}>
                      {DIFFICULTY_META[p.difficulty].label}
                    </Badge>
                    <Badge variant="secondary" className="tabular-nums">{p.points} pts</Badge>
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        )
      ) : (
        <ContestStandings slug={contest.slug} live={status === 'RUNNING'} />
      )}
    </div>
  )
}

function StatusPill({ status }: { status: 'UPCOMING' | 'RUNNING' | 'FINISHED' }) {
  if (status === 'RUNNING')
    return (
      <span className="flex items-center gap-1 rounded-full bg-emerald-500/15 px-2.5 py-0.5 text-xs font-semibold text-emerald-600 dark:text-emerald-400">
        <Radio className="h-3 w-3 animate-pulse" /> Live now
      </span>
    )
  if (status === 'UPCOMING')
    return <span className="rounded-full bg-amber-500/15 px-2.5 py-0.5 text-xs font-semibold text-amber-600 dark:text-amber-400">Upcoming</span>
  return <span className="rounded-full bg-muted px-2.5 py-0.5 text-xs font-semibold text-muted-foreground">Finished</span>
}

function TabButton({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      onClick={onClick}
      className={cn(
        'flex items-center gap-1.5 border-b-2 pb-2 font-medium transition-colors',
        active ? 'border-foreground text-foreground' : 'border-transparent text-muted-foreground hover:text-foreground',
      )}
    >
      {children}
    </button>
  )
}
