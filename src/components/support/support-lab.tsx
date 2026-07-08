'use client'

import { AnimatePresence, motion } from 'framer-motion'
import { AlertCircle } from 'lucide-react'
import { useSupport } from '@/lib/support/use-support'
import { SetupScreen } from '@/components/support/setup-screen'
import { WaitingScreen } from '@/components/support/waiting-screen'
import { GreenRoom } from '@/components/support/green-room'
import { LiveScreen } from '@/components/support/live-screen'
import { FeedbackScreen } from '@/components/support/feedback-screen'
import { AnimatedThemeToggler } from '@/components/ui/animated-theme-toggler'
import { UserMenu } from '@/components/auth/user-menu'
import { XpBadge } from '@/components/gamification/xp-badge'
import { Logo } from '@/components/brand/logo'
import { Button } from '@/components/ui/button'
import { resolveErrorCopy } from '@/lib/interview/errors'

export function SupportLab({ userName }: { userName?: string }) {
  const s = useSupport()

  return (
    <div className="min-h-screen bg-linear-to-br from-zinc-50 via-white to-zinc-100 dark:from-zinc-950 dark:via-zinc-900 dark:to-zinc-950">
      <header className="sticky top-0 z-10 border-b bg-background/70 backdrop-blur-sm">
        <div className="mx-auto flex max-w-5xl items-center gap-3 px-4 py-2.5">
          <Logo className="h-8 w-8" />
          <div>
            <h1 className="text-sm font-bold leading-tight">Support Session</h1>
            <p className="text-[11px] leading-tight text-muted-foreground">Talk it through with a supportive AI</p>
          </div>
          <div className="ml-auto flex items-center gap-2">
            <AnimatedThemeToggler />
            <XpBadge />
            <UserMenu />
          </div>
        </div>
      </header>

      <main className="relative overflow-hidden">
        <div className="pointer-events-none absolute -top-24 -left-24 h-96 w-96 rounded-full bg-rose-400/20 blur-3xl dark:bg-rose-500/10" aria-hidden />
        <div className="pointer-events-none absolute top-1/3 -right-32 h-96 w-96 rounded-full bg-pink-500/20 blur-3xl dark:bg-pink-500/10" aria-hidden />
        <div className="pointer-events-none absolute bottom-0 left-1/4 h-72 w-72 rounded-full bg-fuchsia-400/10 blur-3xl dark:bg-fuchsia-500/10" aria-hidden />

        <AnimatePresence mode="wait">
          {s.phase === 'idle' && (
            <motion.div key="setup" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
              <SetupScreen onSubmit={s.submitProblem} greeting={userName} />
            </motion.div>
          )}

          {s.phase === 'waiting' && (
            <motion.div key="waiting" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
              <WaitingScreen position={s.queuePosition} category={s.category} onLeave={() => void s.leaveQueue()} />
            </motion.div>
          )}

          {s.phase === 'greenroom' && (
            <motion.div key="greenroom" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
              <GreenRoom category={s.category} connecting={false} onStart={s.start} />
            </motion.div>
          )}

          {(s.phase === 'connecting' || s.phase === 'live' || s.phase === 'reconnecting') && (
            <motion.div key="live" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
              <LiveScreen
                category={s.category}
                secondsLeft={s.secondsLeft}
                transcript={s.transcript}
                muted={s.muted}
                agentSpeaking={s.agentSpeaking}
                sharing={s.sharing}
                micAnalyser={s.micAnalyser}
                outputAnalyser={s.outputAnalyser}
                connecting={s.phase === 'connecting'}
                reconnecting={s.phase === 'reconnecting'}
                onMute={s.toggleMute}
                onToggleShare={() => void s.toggleShare()}
                onSendText={s.sendText}
                onEnd={s.endEarly}
              />
            </motion.div>
          )}

          {s.phase === 'feedback' && (
            <motion.div key="feedback" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
              <FeedbackScreen sent={s.feedbackSent} onSubmit={s.submitFeedback} onDone={s.reset} />
            </motion.div>
          )}

          {s.phase === 'error' && (
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
                <p className="text-lg font-semibold">{resolveErrorCopy(s.errorCode).title}</p>
                <p className="mt-1 text-sm text-muted-foreground">{s.error ?? resolveErrorCopy(s.errorCode).message}</p>
              </div>
              <Button onClick={s.reset}>Back to start</Button>
            </motion.div>
          )}
        </AnimatePresence>
      </main>
    </div>
  )
}
