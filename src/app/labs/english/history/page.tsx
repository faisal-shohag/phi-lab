import Link from 'next/link'
import { redirect } from 'next/navigation'
import type { Metadata } from 'next'
import { ArrowLeft, ChevronRight } from 'lucide-react'
import { requireUser } from '@/lib/auth-server'
import { prisma } from '@/lib/prisma'
import { scenarioById } from '@/lib/english/scenarios'
import { AnimatedThemeToggler } from '@/components/ui/animated-theme-toggler'
import { UserMenu } from '@/components/auth/user-menu'
import { Logo } from '@/components/brand/logo'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'

export const metadata: Metadata = { title: 'English practice history' }

const STATUS_STYLES: Record<string, string> = {
  COMPLETED: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-300',
  FAILED: 'bg-rose-100 text-rose-700 dark:bg-rose-950/50 dark:text-rose-300',
  IN_PROGRESS: 'bg-amber-100 text-amber-700 dark:bg-amber-950/50 dark:text-amber-300',
  // Walked away mid-session. Muted: it is not a failure, it just never happened.
  ABANDONED: 'bg-muted text-muted-foreground',
}

function scoreChip(score: number): string {
  if (score >= 75) return 'bg-emerald-500'
  if (score >= 50) return 'bg-amber-500'
  return 'bg-rose-500'
}

export default async function EnglishHistoryPage() {
  const user = await requireUser()
  if (!user) redirect('/sign-in?redirect=/labs/english/history')

  const sessions = await prisma.englishSession.findMany({
    where: { userId: user.id },
    orderBy: { createdAt: 'desc' },
    select: { id: true, scenario: true, status: true, overallScore: true, createdAt: true },
  })

  const scored = sessions.filter((s) => s.status === 'COMPLETED' && typeof s.overallScore === 'number')
  const avg = scored.length ? Math.round(scored.reduce((a, s) => a + (s.overallScore ?? 0), 0) / scored.length) : null
  const best = scored.reduce((m, s) => Math.max(m, s.overallScore ?? 0), 0)

  return (
    <div className="min-h-screen bg-linear-to-br from-slate-50 via-white to-slate-100 dark:from-slate-950 dark:via-slate-900 dark:to-slate-950">
      <header className="sticky top-0 z-10 border-b bg-background/70 backdrop-blur-sm">
        <div className="mx-auto flex max-w-4xl items-center gap-3 px-4 py-2.5">
          <Logo className="h-8 w-8" />
          <div>
            <h1 className="text-sm font-bold leading-tight">English practice history</h1>
            <p className="text-[11px] leading-tight text-muted-foreground">Your past sessions & scores</p>
          </div>
          <div className="ml-auto flex items-center gap-2">
            <Button asChild variant="ghost" size="sm">
              <Link href="/labs/english">
                <ArrowLeft className="h-4 w-4" />
                <span className="hidden sm:inline">New session</span>
              </Link>
            </Button>
            <AnimatedThemeToggler />
            <UserMenu />
          </div>
        </div>
      </header>

      <main className="mx-auto w-full max-w-4xl px-4 py-8">
        {sessions.length === 0 ? (
          <div className="flex flex-col items-center gap-4 rounded-2xl border-2 border-border bg-card py-16 text-center">
            <p className="text-lg font-semibold">No practice yet</p>
            <p className="max-w-sm text-sm text-muted-foreground">
              Practise speaking English in a real work situation and your scores will show up here.
            </p>
            <Button asChild>
              <Link href="/labs/english">Start practising</Link>
            </Button>
          </div>
        ) : (
          <>
            <div className="grid grid-cols-3 gap-3">
              <Stat label="Sessions" value={String(sessions.length)} />
              <Stat label="Avg score" value={avg === null ? '—' : String(avg)} />
              <Stat label="Best score" value={scored.length ? String(best) : '—'} />
            </div>

            <div className="mt-6 space-y-2.5">
              {sessions.map((s) => {
                const scenarioLabel = scenarioById(s.scenario)?.label ?? s.scenario
                const isDone = s.status === 'COMPLETED'
                const row = (
                  <div
                    className={cn(
                      'flex items-center gap-3 rounded-2xl border-2 border-border bg-card p-3.5 shadow-sm transition-colors',
                      isDone && 'hover:border-foreground/30 hover:bg-accent',
                    )}
                  >
                    {isDone && typeof s.overallScore === 'number' ? (
                      <div className={cn('flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-sm font-bold text-white', scoreChip(s.overallScore))}>
                        {s.overallScore}
                      </div>
                    ) : (
                      <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-muted text-xs font-semibold text-muted-foreground">—</div>
                    )}
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-1.5">
                        <span className="text-sm font-semibold">{scenarioLabel}</span>
                        <span className={cn('rounded-full px-1.5 py-0.5 text-[10px] font-semibold', STATUS_STYLES[s.status] ?? '')}>
                          {s.status.replace('_', ' ').toLowerCase()}
                        </span>
                      </div>
                      <p className="mt-0.5 text-xs text-muted-foreground">
                        {s.createdAt.toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' })}
                        {' · '}
                        {s.createdAt.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' })}
                      </p>
                    </div>
                    {isDone && <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground" />}
                  </div>
                )
                return isDone ? (
                  <Link key={s.id} href={`/labs/english/history/${s.id}`} className="block">{row}</Link>
                ) : (
                  <div key={s.id}>{row}</div>
                )
              })}
            </div>
          </>
        )}
      </main>
    </div>
  )
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border-2 border-border bg-card p-4 text-center shadow-sm">
      <div className="truncate text-xl font-bold sm:text-2xl">{value}</div>
      <div className="mt-0.5 text-[11px] text-muted-foreground">{label}</div>
    </div>
  )
}
