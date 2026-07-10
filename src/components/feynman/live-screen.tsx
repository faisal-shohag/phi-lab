'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { ArrowDown, Loader2, Mic, MicOff, PhoneOff, Wifi } from 'lucide-react'
import { SpeakingOrb } from '@/components/interview/speaking-orb'
import { CountdownRing } from '@/components/interview/countdown-ring'
import { useAnalyserLevel } from '@/components/interview/use-analyser-level'
import { conceptById } from '@/lib/feynman/concepts'
import type { TranscriptEntry } from '@/lib/feynman/use-feynman'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'

const BOTTOM_THRESHOLD = 48

interface LiveScreenProps {
  concept: string | null
  secondsLeft: number
  roundTotal: number
  transcript: TranscriptEntry[]
  muted: boolean
  studentSpeaking: boolean
  micAnalyser: AnalyserNode | null
  outputAnalyser: AnalyserNode | null
  connecting?: boolean
  reconnecting?: boolean
  onMute: () => void
  onEnd: () => void
}

export function LiveScreen(props: LiveScreenProps) {
  const {
    concept, secondsLeft, roundTotal, transcript, muted, studentSpeaking,
    micAnalyser, outputAnalyser, connecting, reconnecting, onMute, onEnd,
  } = props

  const { level: outLevel } = useAnalyserLevel(outputAnalyser, studentSpeaking)
  const { level: micLevel } = useAnalyserLevel(micAnalyser, !muted)

  const teacherSpeaking = !muted && micLevel > 0.08 && !studentSpeaking
  // The orb represents the AI student; reuse the interview orb's "interviewer"
  // visual for the AI voice and "candidate" for the human.
  const speaker: 'interviewer' | 'candidate' | 'idle' =
    studentSpeaking ? 'interviewer' : teacherSpeaking ? 'candidate' : 'idle'
  const orbLevel = studentSpeaking ? outLevel : teacherSpeaking ? micLevel : 0.02

  const conceptLabel = conceptById(concept ?? '')?.label ?? concept ?? ''

  const statusText = reconnecting
    ? 'Reconnecting…'
    : connecting
      ? 'Connecting…'
      : studentSpeaking
        ? 'Your student is asking…'
        : teacherSpeaking
          ? 'Listening to you teach…'
          : muted
            ? 'You are muted'
            : 'Your turn — start explaining'

  const feedRef = useRef<HTMLDivElement | null>(null)
  const isAtBottomRef = useRef(true)
  const [showJumpToLatest, setShowJumpToLatest] = useState(false)

  const handleFeedScroll = useCallback(() => {
    const el = feedRef.current
    if (!el) return
    const atBottom = el.scrollHeight - el.scrollTop - el.clientHeight < BOTTOM_THRESHOLD
    isAtBottomRef.current = atBottom
    setShowJumpToLatest(!atBottom)
  }, [])

  useEffect(() => {
    const el = feedRef.current
    if (el && isAtBottomRef.current) el.scrollTop = el.scrollHeight
  }, [transcript])

  const jumpToLatest = useCallback(() => {
    const el = feedRef.current
    if (el) el.scrollTo({ top: el.scrollHeight, behavior: 'smooth' })
    isAtBottomRef.current = true
    setShowJumpToLatest(false)
  }, [])

  return (
    <div className="relative mx-auto grid h-[calc(100dvh-4.5rem)] w-full max-w-5xl grid-cols-1 grid-rows-[auto_1fr] gap-4 px-4 py-6 lg:grid-cols-[minmax(0,360px)_1fr] lg:grid-rows-[1fr]">
      <AnimatePresence>
        {reconnecting && (
          <motion.div
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            className="absolute inset-x-0 top-2 z-20 mx-auto flex w-fit items-center gap-2 rounded-full border-2 border-amber-300 bg-amber-50 px-4 py-1.5 text-sm font-medium text-amber-900 shadow-md dark:border-amber-800 dark:bg-amber-950/70 dark:text-amber-100"
          >
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
            <Wifi className="h-3.5 w-3.5" />
            Connection lost — reconnecting…
          </motion.div>
        )}
      </AnimatePresence>

      {/* Left: orb + controls */}
      <div className="flex flex-col items-center gap-6 overflow-y-auto rounded-2xl border-2 border-border bg-card p-6 shadow-sm">
        <div className="flex items-center gap-2 self-start">
          <Badge variant="outline" className="gap-1">
            <span className="inline-block h-1.5 w-1.5 animate-pulse rounded-full bg-emerald-500" /> LIVE
          </Badge>
          <Badge variant="secondary">Teaching: {conceptLabel}</Badge>
        </div>

        <div className={cn('relative flex h-56 w-56 items-center justify-center transition-opacity', reconnecting && 'opacity-40')}>
          <SpeakingOrb level={reconnecting ? 0.02 : orbLevel} speaker={reconnecting ? 'idle' : speaker} className="absolute inset-0" />
        </div>

        <div className="text-center">
          <p className="text-lg font-semibold">{statusText}</p>
        </div>

        <CountdownRing secondsLeft={secondsLeft} total={roundTotal} />

        <div className="flex h-6 items-center gap-1">
          {Array.from({ length: 9 }).map((_, i) => {
            const base = muted ? 0 : micLevel
            const h = 6 + Math.abs(Math.sin(i * 1.3)) * base * 26
            return (
              <motion.span
                key={i}
                className={cn('w-1 rounded-full', muted ? 'bg-muted' : 'bg-sky-400')}
                animate={{ height: Math.max(6, h) }}
                transition={{ type: 'spring', stiffness: 300, damping: 20 }}
              />
            )
          })}
        </div>

        <div className="flex items-center gap-5">
          <button
            onClick={onMute}
            className={cn(
              'flex h-12 w-12 items-center justify-center rounded-full border-2 transition-colors',
              muted
                ? 'border-rose-300 bg-rose-50 text-rose-600 dark:bg-rose-950/40'
                : 'border-border bg-background text-foreground hover:bg-muted',
            )}
            title={muted ? 'Unmute' : 'Mute'}
          >
            {muted ? <MicOff className="h-5 w-5" /> : <Mic className="h-5 w-5" />}
          </button>
          <button
            onClick={onEnd}
            className="flex h-14 w-14 items-center justify-center rounded-full bg-rose-500 text-white shadow-lg transition-transform hover:scale-105 hover:bg-rose-600"
            title="End session"
          >
            <PhoneOff className="h-6 w-6" />
          </button>
        </div>
      </div>

      {/* Right: live transcript */}
      <div className="relative flex h-full min-h-0 flex-col rounded-2xl border-2 border-border bg-card shadow-sm">
        <div className="flex items-center gap-2 border-b px-4 py-3">
          <span className="inline-block h-2 w-2 rounded-full bg-emerald-500" />
          <span className="text-sm font-semibold">Live transcript</span>
          <span className="ml-auto text-xs text-muted-foreground">{transcript.length} message(s)</span>
        </div>
        <div ref={feedRef} onScroll={handleFeedScroll} className="min-h-0 flex-1 space-y-3 overflow-y-auto p-4">
          {transcript.length === 0 ? (
            <div className="flex h-full items-center justify-center text-center text-sm text-muted-foreground">
              Your student will say hello — then start explaining the concept…
            </div>
          ) : (
            <AnimatePresence initial={false}>
              {transcript.map((entry, i) => {
                const isTeacher = entry.role === 'teacher'
                return (
                  <motion.div
                    key={i}
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    className={cn('flex flex-col', isTeacher ? 'items-end' : 'items-start')}
                  >
                    <span className={cn('mb-0.5 px-1 text-[10px] font-semibold uppercase tracking-wide', isTeacher ? 'text-sky-500' : 'text-violet-500')}>
                      {isTeacher ? 'You' : 'Student'}
                    </span>
                    <div
                      className={cn(
                        'font-bn max-w-[85%] rounded-2xl px-3.5 py-2 text-sm leading-relaxed',
                        isTeacher
                          ? 'rounded-br-sm bg-sky-50 text-sky-950 dark:bg-sky-950/40 dark:text-sky-100'
                          : 'rounded-bl-sm bg-violet-50 text-violet-950 dark:bg-violet-950/40 dark:text-violet-100',
                      )}
                    >
                      {entry.text || <span className="opacity-50">…</span>}
                    </div>
                  </motion.div>
                )
              })}
            </AnimatePresence>
          )}
        </div>

        <AnimatePresence>
          {showJumpToLatest && (
            <motion.div
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 8 }}
              className="absolute bottom-3 left-1/2 -translate-x-1/2"
            >
              <Button size="sm" variant="secondary" className="rounded-full shadow-md" onClick={jumpToLatest}>
                <ArrowDown className="h-3.5 w-3.5" />
                Jump to latest
              </Button>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  )
}
