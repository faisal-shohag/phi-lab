'use client'

import Link from 'next/link'
import { AnimatePresence, motion } from 'framer-motion'
import { Loader2, AlertCircle, History } from 'lucide-react'
import { useInterview } from '@/lib/interview/use-interview'
import { SetupScreen } from '@/components/interview/setup-screen'
import { GreenRoom } from '@/components/interview/green-room'
import { LiveScreen } from '@/components/interview/live-screen'
import { ReportScreen } from '@/components/interview/report-screen'
import { AnimatedThemeToggler } from '@/components/ui/animated-theme-toggler'
import { Button } from '@/components/ui/button'
import { UserMenu } from '@/components/auth/user-menu'
import { XpBadge } from '@/components/gamification/xp-badge'
import { Logo } from '@/components/brand/logo'
import { resolveErrorCopy } from '@/lib/interview/errors'

export function InterviewLab({ userName }: { userName?: string }) {
  const iv = useInterview()

  return (
    <div className="min-h-screen bg-linear-to-br from-zinc-50 via-white to-zinc-100 dark:from-zinc-950 dark:via-zinc-900 dark:to-zinc-950">
      <header className="sticky top-0 z-10 border-b bg-background/70 backdrop-blur-sm">
        <div className="mx-auto flex max-w-5xl items-center gap-3 px-4 py-2.5">
          <Logo className="h-8 w-8" />
          <div>
            <h1 className="text-sm font-bold leading-tight">Interview Lab</h1>
            <p className="text-[11px] leading-tight text-muted-foreground">AI live technical interview</p>
          </div>
          <div className="ml-auto flex items-center gap-2">
            <Button asChild variant="ghost" size="sm">
              <Link href="/labs/interview/history">
                <History className="h-4 w-4" />
                <span className="hidden sm:inline">History</span>
              </Link>
            </Button>
            <AnimatedThemeToggler />
            <XpBadge />
            <UserMenu />
          </div>
        </div>
      </header>

      <main className="relative overflow-hidden">
        <div
          className="pointer-events-none absolute -top-24 -left-24 h-96 w-96 rounded-full bg-amber-400/20 blur-3xl dark:bg-amber-500/10"
          aria-hidden
        />
        <div
          className="pointer-events-none absolute top-1/3 -right-32 h-96 w-96 rounded-full bg-violet-500/20 blur-3xl dark:bg-violet-500/10"
          aria-hidden
        />
        <div
          className="pointer-events-none absolute bottom-0 left-1/4 h-72 w-72 rounded-full bg-fuchsia-400/10 blur-3xl dark:bg-fuchsia-500/10"
          aria-hidden
        />

        <AnimatePresence mode="wait">
          {iv.phase === 'idle' && (
            <motion.div key="setup" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
              <SetupScreen onContinue={(topic, level, pressure, subtopicIds) => iv.enterGreenRoom(topic, level, pressure, subtopicIds)} greeting={userName} />
            </motion.div>
          )}

          {iv.phase === 'greenroom' && (
            <motion.div key="greenroom" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
              <GreenRoom
                topic={iv.topic}
                level={iv.level}
                pressure={iv.pressure}
                connecting={false}
                onStart={iv.start}
                onBack={iv.reset}
              />
            </motion.div>
          )}

          {(iv.phase === 'connecting' || iv.phase === 'live' || iv.phase === 'reconnecting') && (
            <motion.div key="live" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
              <LiveScreen
                topic={iv.topic}
                level={iv.level}
                secondsLeft={iv.secondsLeft}
                roundTotal={iv.roundTotal}
                transcript={iv.transcript}
                muted={iv.muted}
                modelSpeaking={iv.modelSpeaking}
                micAnalyser={iv.micAnalyser}
                outputAnalyser={iv.outputAnalyser}
                connecting={iv.phase === 'connecting'}
                reconnecting={iv.phase === 'reconnecting'}
                onMute={iv.toggleMute}
                onEnd={iv.endEarly}
              />
            </motion.div>
          )}

          {iv.phase === 'generating' && (
            <motion.div
              key="generating"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="flex min-h-[60vh] flex-col items-center justify-center gap-4 px-4 text-center"
            >
              <Loader2 className="h-10 w-10 animate-spin text-amber-500" />
              <div>
                <p className="text-lg font-semibold">Scoring your interview…</p>
                <p className="text-sm text-muted-foreground">Reviewing the transcript and writing your report.</p>
              </div>
            </motion.div>
          )}

          {iv.phase === 'report' && iv.report && (
            <motion.div key="report" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
              <ReportScreen
                report={iv.report}
                topic={iv.topic}
                level={iv.level}
                sessionId={iv.sessionId}
                onNew={iv.reset}
                onRetry={() => {
                  if (iv.topic && iv.level) iv.enterGreenRoom(iv.topic, iv.level, iv.pressure, iv.subtopicIds)
                }}
              />
            </motion.div>
          )}

          {iv.phase === 'error' && (
            <motion.div
              key="error"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="flex min-h-[60vh] flex-col items-center justify-center gap-4 px-4 text-center"
            >
              <div className="flex h-12 w-12 items-center justify-center rounded-full bg-rose-100 dark:bg-rose-950/50">
                <AlertCircle className="h-6 w-6 text-rose-500" />
              </div>
              <div className="max-w-md">
                <p className="text-lg font-semibold">{resolveErrorCopy(iv.errorCode).title}</p>
                <p className="mt-1 text-sm text-muted-foreground">{iv.error ?? resolveErrorCopy(iv.errorCode).message}</p>
              </div>
              <div className="flex items-center gap-2">
                {iv.errorCode === 'REPORT_FAILED' && iv.canRetryReport && (
                  <Button onClick={iv.retryReport}>Try scoring again</Button>
                )}
                <Button variant={iv.errorCode === 'REPORT_FAILED' ? 'outline' : 'default'} onClick={iv.reset}>
                  Back to start
                </Button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </main>
    </div>
  )
}
