'use client'

import { useEffect } from 'react'
import Link from 'next/link'
import { AnimatePresence, motion } from 'framer-motion'
import { Loader2, AlertCircle, History } from 'lucide-react'
import { useFeynman } from '@/lib/feynman/use-feynman'
import { conceptById } from '@/lib/feynman/concepts'
import { SetupScreen } from '@/components/feynman/setup-screen'
import { GreenRoom } from '@/components/feynman/green-room'
import { LiveScreen } from '@/components/feynman/live-screen'
import { ReportScreen } from '@/components/feynman/report-screen'
import { AnimatedThemeToggler } from '@/components/ui/animated-theme-toggler'
import { Button } from '@/components/ui/button'
import { UserMenu } from '@/components/auth/user-menu'
import { XpBadge } from '@/components/gamification/xp-badge'
import { Logo } from '@/components/brand/logo'
import { resolveErrorCopy } from '@/lib/interview/errors'

export function FeynmanLab({ userName }: { userName?: string }) {
  const fx = useFeynman()

  // The Path deep-links here as `/labs/feynman?concept=<id>` to satisfy a
  // "teach it back" step. Jump straight into the green room for that concept
  // instead of making the learner re-pick what the path already chose. Guarded
  // to a known concept id, and only on the idle setup screen.
  useEffect(() => {
    if (fx.phase !== 'idle') return
    const wanted = new URLSearchParams(window.location.search).get('concept')
    if (wanted && conceptById(wanted)) fx.enterGreenRoom(wanted)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  return (
    <div className="min-h-screen bg-linear-to-br from-zinc-50 via-white to-zinc-100 dark:from-zinc-950 dark:via-zinc-900 dark:to-zinc-950">
      <header className="sticky top-0 z-10 border-b bg-background/70 backdrop-blur-sm">
        <div className="mx-auto flex max-w-5xl items-center gap-3 px-4 py-2.5">
          <Logo className="h-8 w-8" />
          <div>
            <h1 className="text-sm font-bold leading-tight">Feynman Lab</h1>
            <p className="text-[11px] leading-tight text-muted-foreground">Learn by teaching it aloud</p>
          </div>
          <div className="ml-auto flex items-center gap-2">
            <Button asChild variant="ghost" size="sm">
              <Link href="/labs/feynman/history">
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
        <div className="pointer-events-none absolute -top-24 -left-24 h-96 w-96 rounded-full bg-indigo-400/20 blur-3xl dark:bg-indigo-500/10" aria-hidden />
        <div className="pointer-events-none absolute top-1/3 -right-32 h-96 w-96 rounded-full bg-emerald-500/20 blur-3xl dark:bg-emerald-500/10" aria-hidden />
        <div className="pointer-events-none absolute bottom-0 left-1/4 h-72 w-72 rounded-full bg-sky-400/10 blur-3xl dark:bg-sky-500/10" aria-hidden />

        <AnimatePresence mode="wait">
          {fx.phase === 'idle' && (
            <motion.div key="setup" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
              <SetupScreen onContinue={fx.enterGreenRoom} greeting={userName} />
            </motion.div>
          )}

          {fx.phase === 'greenroom' && (
            <motion.div key="greenroom" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
              <GreenRoom concept={fx.concept} connecting={false} onStart={fx.start} onBack={fx.reset} />
            </motion.div>
          )}

          {(fx.phase === 'connecting' || fx.phase === 'live' || fx.phase === 'reconnecting') && (
            <motion.div key="live" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
              <LiveScreen
                concept={fx.concept}
                secondsLeft={fx.secondsLeft}
                roundTotal={fx.roundTotal}
                transcript={fx.transcript}
                muted={fx.muted}
                studentSpeaking={fx.studentSpeaking}
                micAnalyser={fx.micAnalyser}
                outputAnalyser={fx.outputAnalyser}
                connecting={fx.phase === 'connecting'}
                reconnecting={fx.phase === 'reconnecting'}
                onMute={fx.toggleMute}
                onEnd={fx.endEarly}
              />
            </motion.div>
          )}

          {fx.phase === 'generating' && (
            <motion.div
              key="generating"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="flex min-h-[60vh] flex-col items-center justify-center gap-4 px-4 text-center"
            >
              <Loader2 className="h-10 w-10 animate-spin text-indigo-500" />
              <div>
                <p className="text-lg font-semibold">Grading your explanation…</p>
                <p className="text-sm text-muted-foreground">Checking clarity, gaps and what your student learned.</p>
              </div>
            </motion.div>
          )}

          {fx.phase === 'report' && fx.report && (
            <motion.div key="report" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
              <ReportScreen
                report={fx.report}
                concept={fx.concept}
                onNew={fx.reset}
                onRetry={() => { if (fx.concept) fx.enterGreenRoom(fx.concept) }}
              />
            </motion.div>
          )}

          {fx.phase === 'error' && (
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
                <p className="text-lg font-semibold">{resolveErrorCopy(fx.errorCode).title}</p>
                <p className="mt-1 text-sm text-muted-foreground">{fx.error ?? resolveErrorCopy(fx.errorCode).message}</p>
              </div>
              <div className="flex items-center gap-2">
                {fx.errorCode === 'REPORT_FAILED' && fx.canRetryReport && (
                  <Button onClick={fx.retryReport}>Try scoring again</Button>
                )}
                <Button variant={fx.errorCode === 'REPORT_FAILED' ? 'outline' : 'default'} onClick={fx.reset}>
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
