'use client'

import { useMemo, useState } from 'react'
import Link from 'next/link'
import { CheckCircle2, Circle, CircleDot, Search, Trophy } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { LeaderboardSheet } from '@/components/gamification/leaderboard-sheet'
import { cn } from '@/lib/utils'
import { DIFFICULTY_META, DIFFICULTY_ORDER } from './difficulty'
import type { ProblemListItem, ProblemStatus } from '@/lib/code-lab/queries'
import type { ProblemDifficulty } from '@/lib/code-lab/types'

type DiffFilter = ProblemDifficulty | 'ALL'
type StatusFilter = ProblemStatus | 'ALL'

export function ProblemList({ problems }: { problems: ProblemListItem[] }) {
  const [q, setQ] = useState('')
  const [diff, setDiff] = useState<DiffFilter>('ALL')
  const [status, setStatus] = useState<StatusFilter>('ALL')
  const [boardOpen, setBoardOpen] = useState(false)

  const solvedCount = problems.filter((p) => p.status === 'solved').length

  const filtered = useMemo(() => {
    const query = q.trim().toLowerCase()
    return problems.filter((p) => {
      if (diff !== 'ALL' && p.difficulty !== diff) return false
      if (status !== 'ALL' && p.status !== status) return false
      if (query && !p.title.toLowerCase().includes(query) && !p.tags.some((t) => t.toLowerCase().includes(query)))
        return false
      return true
    })
  }, [problems, q, diff, status])

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative flex-1 min-w-48">
          <Search className="absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search problems or tags" className="pl-8" />
        </div>
        <FilterGroup value={status} onChange={setStatus} options={[['ALL', 'All'], ['todo', 'Todo'], ['attempted', 'Attempted'], ['solved', 'Solved']]} />
        <Button size="sm" variant="outline" className="h-9 gap-1.5" onClick={() => setBoardOpen(true)}>
          <Trophy className="h-4 w-4 text-amber-500" /> Leaderboard
        </Button>
      </div>

      <LeaderboardSheet
        open={boardOpen}
        onOpenChange={setBoardOpen}
        endpoint="/api/code-lab/leaderboard"
        emptyMessage="Solve problems to climb the board."
        title="Top solvers"
        unit="solved"
        youLabel="Your rank"
        emptyYouMessage="Solve a problem to claim your spot."
      />

      <div className="flex flex-wrap items-center gap-2">
        <FilterGroup
          value={diff}
          onChange={setDiff}
          options={[['ALL', 'All'], ...DIFFICULTY_ORDER.map((d) => [d, DIFFICULTY_META[d].label] as [DiffFilter, string])]}
        />
        <span className="ml-auto text-xs text-muted-foreground">{solvedCount} / {problems.length} solved</span>
      </div>

      <div className="overflow-hidden rounded-lg border">
        {filtered.length === 0 ? (
          <p className="p-8 text-center text-sm text-muted-foreground">No problems match these filters.</p>
        ) : (
          <ul className="divide-y">
            {filtered.map((p) => (
              <li key={p.slug}>
                <Link
                  href={`/labs/code-lab/${p.slug}`}
                  className="flex items-center gap-3 px-4 py-3 transition-colors hover:bg-muted/50"
                >
                  <StatusDot status={p.status} />
                  <span className="font-medium">{p.title}</span>
                  <div className="hidden gap-1 sm:flex">
                    {p.tags.slice(0, 3).map((t) => (
                      <Badge key={t} variant="secondary" className="font-normal">{t}</Badge>
                    ))}
                  </div>
                  <Badge variant="outline" className={cn('ml-auto', DIFFICULTY_META[p.difficulty].className)}>
                    {DIFFICULTY_META[p.difficulty].label}
                  </Badge>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  )
}

function StatusDot({ status }: { status: ProblemStatus }) {
  if (status === 'solved') return <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-500" />
  if (status === 'attempted') return <CircleDot className="h-4 w-4 shrink-0 text-amber-500" />
  return <Circle className="h-4 w-4 shrink-0 text-muted-foreground/40" />
}

function FilterGroup<T extends string>({
  value,
  onChange,
  options,
}: {
  value: T
  onChange: (v: T) => void
  options: [T, string][]
}) {
  return (
    <div className="flex flex-wrap gap-1">
      {options.map(([v, label]) => (
        <Button
          key={v}
          size="sm"
          variant={value === v ? 'default' : 'outline'}
          className="h-7 px-2.5 text-xs"
          onClick={() => onChange(v)}
        >
          {label}
        </Button>
      ))}
    </div>
  )
}
