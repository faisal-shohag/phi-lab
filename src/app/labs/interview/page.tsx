'use client'

import { AnimatePresence, motion } from 'framer-motion'
import { Loader2, AlertCircle } from 'lucide-react'
import { useInterview } from '@/lib/interview/use-interview'
import { SetupScreen } from '@/components/interview/setup-screen'
import { LiveScreen } from '@/components/interview/live-screen'
import { ReportScreen } from '@/components/interview/report-screen'
import { AnimatedThemeToggler } from '@/components/ui/animated-theme-toggler'
import { Button } from '@/components/ui/button'

export default function InterviewLabPage() {
  const iv = useInterview()

  return (
    <div className="min-h-screen bg-linear-to-br from-slate-50 via-white to-slate-100 dark:from-slate-950 dark:via-slate-900 dark:to-slate-950">
      <header className="sticky top-0 z-10 border-b bg-background/70 backdrop-blur-sm">
        <div className="mx-auto flex max-w-5xl items-center gap-3 px-4 py-2.5">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-linear-to-br from-amber-500 via-fuchsia-500 to-violet-600 shadow">
            <span className="text-sm font-bold text-white">Φ</span>
          </div>
          <div>
            <h1 className="text-sm font-bold leading-tight">Interview Lab</h1>
            <p className="text-[11px] leading-tight text-muted-foreground">AI live technical interview</p>
          </div>
          <div className="ml-auto">
            <AnimatedThemeToggler />
          </div>
        </div>
      </header>

      <main className="relative">
        <AnimatePresence mode="wait">
          {(iv.phase === 'idle' || iv.phase === 'connecting') && (
            <motion.div key="setup" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
              <SetupScreen onStart={iv.start} connecting={iv.phase === 'connecting'} error={null} />
            </motion.div>
          )}

          {iv.phase === 'live' && (
            <motion.div key="live" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
              <LiveScreen
                topic={iv.topic}
                level={iv.level}
                secondsLeft={iv.secondsLeft}
                transcript={iv.transcript}
                muted={iv.muted}
                modelSpeaking={iv.modelSpeaking}
                micAnalyser={iv.micAnalyser}
                outputAnalyser={iv.outputAnalyser}
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
                onNew={iv.reset}
                onRetry={() => {
                  if (iv.topic && iv.level) iv.start(iv.topic, iv.level)
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
                <p className="text-lg font-semibold">Something went wrong</p>
                <p className="mt-1 text-sm text-muted-foreground">{iv.error}</p>
              </div>
              <Button onClick={iv.reset}>Back to start</Button>
            </motion.div>
          )}
        </AnimatePresence>
      </main>
    </div>
  )
}
