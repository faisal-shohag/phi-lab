import Link from 'next/link'
import { Code2, CheckCircle2 } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { cn } from '@/lib/utils'
import { DIFFICULTY_META, DIFFICULTY_ORDER } from '@/components/code-lab/difficulty'
import type { CodeLabProfileStats } from '@/lib/code-lab/queries'

// Milestone ladder mirrors the Code Lab solved-count badges.
const MILESTONES = [20, 50, 100, 150, 200]

export function CodeLabSection({ stats, isOwner }: { stats: CodeLabProfileStats; isOwner: boolean }) {
  if (stats.total === 0) {
    if (!isOwner) return null
    return (
      <section className="rounded-2xl border-2 border-border bg-card p-6">
        <Header />
        <p className="mt-3 text-sm text-muted-foreground">
          No problems solved yet.{' '}
          <Link href="/labs/code-lab" className="font-medium text-primary underline-offset-2 hover:underline">
            Start solving →
          </Link>
        </p>
      </section>
    )
  }

  const next = MILESTONES.find((m) => m > stats.total)
  const prev = [...MILESTONES].reverse().find((m) => m <= stats.total) ?? 0
  const progress = next ? (stats.total - prev) / (next - prev) : 1

  return (
    <section className="rounded-2xl border-2 border-border bg-card p-6">
      <div className="flex items-center justify-between">
        <Header />
        <div className="text-right">
          <div className="text-2xl font-bold tabular-nums">{stats.total}</div>
          <div className="text-xs text-muted-foreground">solved</div>
        </div>
      </div>

      <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-4">
        {DIFFICULTY_ORDER.map((d) => (
          <div key={d} className="rounded-lg border p-3 text-center">
            <div className={cn('text-lg font-bold tabular-nums', DIFFICULTY_META[d].className.split(' ')[0])}>
              {stats.byDifficulty[d]}
            </div>
            <div className="text-[11px] text-muted-foreground">{DIFFICULTY_META[d].label}</div>
          </div>
        ))}
      </div>

      {next && (
        <div className="mt-4">
          <div className="mb-1 flex justify-between text-xs text-muted-foreground">
            <span>Next milestone</span>
            <span className="tabular-nums">{stats.total} / {next}</span>
          </div>
          <div className="h-2 overflow-hidden rounded-full bg-muted">
            <div
              className="h-full rounded-full bg-linear-to-r from-sky-400 to-fuchsia-500 transition-[width]"
              style={{ width: `${Math.round(progress * 100)}%` }}
            />
          </div>
        </div>
      )}

      {stats.recent.length > 0 && (
        <div className="mt-4">
          <h3 className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Recently solved</h3>
          <ul className="space-y-1">
            {stats.recent.map((r) => (
              <li key={r.slug} className="flex items-center gap-2 text-sm">
                <CheckCircle2 className="h-3.5 w-3.5 shrink-0 text-emerald-500" />
                <Link href={`/labs/code-lab/${r.slug}`} className="truncate hover:underline">{r.title}</Link>
                <Badge variant="outline" className={cn('ml-auto shrink-0', DIFFICULTY_META[r.difficulty].className)}>
                  {DIFFICULTY_META[r.difficulty].label}
                </Badge>
              </li>
            ))}
          </ul>
        </div>
      )}
    </section>
  )
}

function Header() {
  return (
    <h2 className="flex items-center gap-2 text-lg font-bold">
      <Code2 className="h-5 w-5" /> Code Lab
    </h2>
  )
}
