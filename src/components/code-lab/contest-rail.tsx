'use client'

import Link from 'next/link'
import { Trophy, ChevronRight } from 'lucide-react'
import { ContestCard } from './contest-card'
import type { ContestSummary } from '@/lib/code-lab/contests'

// The strip of live + upcoming contests at the top of the problem list. Finished
// contests are not shown here — they live on the /contests index. Renders nothing
// when there's nothing active, so the list page stays clean.
export function ContestRail({ contests }: { contests: ContestSummary[] }) {
  const active = contests.filter((c) => c.status !== 'FINISHED')
  if (active.length === 0) return null

  return (
    <section className="mb-8">
      <div className="mb-3 flex items-center justify-between">
        <h2 className="flex items-center gap-1.5 text-sm font-semibold">
          <Trophy className="h-4 w-4 text-amber-500" /> Contests
        </h2>
        <Link
          href="/labs/code-lab/contests"
          className="flex items-center gap-0.5 text-xs text-muted-foreground hover:text-foreground"
        >
          See all <ChevronRight className="h-3.5 w-3.5" />
        </Link>
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        {active.map((c) => (
          <ContestCard key={c.slug} contest={c} />
        ))}
      </div>
    </section>
  )
}
