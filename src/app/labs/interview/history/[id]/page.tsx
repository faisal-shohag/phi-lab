import Link from 'next/link'
import { redirect, notFound } from 'next/navigation'
import type { Metadata } from 'next'
import { ArrowLeft } from 'lucide-react'
import { requireUser } from '@/lib/auth-server'
import { prisma } from '@/lib/prisma'
import { type LevelId } from '@/lib/interview/topics'
import type { InterviewReport } from '@/lib/interview/report-types'
import { ReportScreen } from '@/components/interview/report-screen'
import { RetryScoreButton } from '@/components/interview/history/retry-score-button'
import { AnimatedThemeToggler } from '@/components/ui/animated-theme-toggler'
import { UserMenu } from '@/components/auth/user-menu'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'

export const metadata: Metadata = { title: 'Interview report' }

interface TurnEntry { role: 'interviewer' | 'candidate'; text: string }

export default async function InterviewReportPage(
  { params }: { params: Promise<{ id: string }> },
) {
  const user = await requireUser()
  if (!user) redirect('/sign-in?redirect=/labs/interview/history')

  const { id } = await params
  const session = await prisma.interviewSession.findUnique({ where: { id } })
  if (!session || session.userId !== user.id) notFound()

  const report = session.report as unknown as InterviewReport | null
  const transcript = (Array.isArray(session.transcript) ? session.transcript : []) as unknown as TurnEntry[]

  return (
    <div className="min-h-screen bg-linear-to-br from-slate-50 via-white to-slate-100 dark:from-slate-950 dark:via-slate-900 dark:to-slate-950">
      <header className="sticky top-0 z-10 border-b bg-background/70 backdrop-blur-sm">
        <div className="mx-auto flex max-w-3xl items-center gap-3 px-4 py-2.5">
          <Button asChild variant="ghost" size="sm">
            <Link href="/labs/interview/history">
              <ArrowLeft className="h-4 w-4" />
              <span className="hidden sm:inline">History</span>
            </Link>
          </Button>
          <div className="ml-auto flex items-center gap-2">
            <AnimatedThemeToggler />
            <UserMenu />
          </div>
        </div>
      </header>

      <main>
        {report && session.status === 'COMPLETED' ? (
          <ReportScreen report={report} topic={session.topic} level={session.level as LevelId} sessionId={session.id} />
        ) : (
          <div className="mx-auto flex max-w-md flex-col items-center gap-4 px-4 py-16 text-center">
            <p className="text-lg font-semibold">
              {session.status === 'FAILED' ? 'This interview was not scored' : 'This interview has no report yet'}
            </p>
            <p className="text-sm text-muted-foreground">
              Your answers are saved. You can run the scoring again to generate a report.
            </p>
            {session.status === 'FAILED' && <RetryScoreButton sessionId={session.id} size="default" />}
          </div>
        )}

        {/* Transcript */}
        {transcript.length > 0 && (
          <div className="mx-auto w-full max-w-3xl px-4 pb-12">
            <h2 className="mb-3 text-sm font-semibold text-muted-foreground">Transcript</h2>
            <div className="space-y-3 rounded-2xl border-2 border-border bg-card p-4 shadow-sm">
              {transcript.map((t, i) => {
                const isCandidate = t.role === 'candidate'
                return (
                  <div key={i} className={cn('flex flex-col', isCandidate ? 'items-end' : 'items-start')}>
                    <span className={cn('mb-0.5 px-1 text-[10px] font-semibold uppercase tracking-wide', isCandidate ? 'text-rose-500' : 'text-violet-500')}>
                      {isCandidate ? 'You' : 'Interviewer'}
                    </span>
                    <div
                      className={cn(
                        'font-bn max-w-[85%] rounded-2xl px-3.5 py-2 text-sm leading-relaxed',
                        isCandidate
                          ? 'rounded-br-sm bg-rose-50 text-rose-950 dark:bg-rose-950/40 dark:text-rose-100'
                          : 'rounded-bl-sm bg-violet-50 text-violet-950 dark:bg-violet-950/40 dark:text-violet-100',
                      )}
                    >
                      {t.text}
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        )}
      </main>
    </div>
  )
}
