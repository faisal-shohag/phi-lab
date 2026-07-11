'use client'

import { useCallback, useRef, useState } from 'react'
import Link from 'next/link'
import { Sparkles, Loader2, RefreshCw, Lock, WandSparkles } from 'lucide-react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover'
import { cn } from '@/lib/utils'
import type { LabLang } from '@/lib/visualizer/lang'

// The lab-wide language now drives the tutor; the old per-popover toggle is gone.
export type TutorLang = LabLang

// The request body sent to /api/labs/js-motion/explain, built at click time so
// it always reflects the step the learner is actually looking at.
export interface TutorRequest {
  mode: 'step' | 'error'
  code: string
  step?: { description?: string; kind?: string; line?: number; vars?: string }
  error?: string
}

interface AiTutorProps {
  // Builds the request lazily (captures the current step/error at click time).
  getRequest: () => TutorRequest
  // Changes when the underlying step/error changes, so a stale answer is cleared.
  resetKey: string | number
  // The lab-wide language (bengali | english).
  lang: TutorLang
  // Guest (signed-out) users see a friendly upsell instead of the tutor.
  locked?: boolean
  variant?: 'why' | 'fix'
  // Gate run before a (paid) AI call; resolve false to abort. Returns true when omitted.
  onBeforeAi?: () => Promise<boolean>
}

interface Answer {
  explanation: string
  tip: string
}

export function AiTutor({ getRequest, resetKey, lang, locked, variant = 'why', onBeforeAi }: AiTutorProps) {
  const [open, setOpen] = useState(false)
  const [loading, setLoading] = useState(false)
  const [answer, setAnswer] = useState<Answer | null>(null)
  const [err, setErr] = useState<string | null>(null)
  // The resetKey the current answer belongs to. If it drifts, the answer is stale.
  const answerKeyRef = useRef<string | number | null>(null)

  const fetchAnswer = useCallback(
    async (forLang: TutorLang) => {
      // Confirm/charge gate before spending XP on the AI.
      if (onBeforeAi && !(await onBeforeAi())) return
      setLoading(true)
      setErr(null)
      try {
        const res = await fetch('/api/labs/js-motion/explain', {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ ...getRequest(), lang: forLang }),
        })
        const data = await res.json()
        if (!res.ok) throw new Error(data?.message || 'The tutor is unavailable right now.')
        setAnswer({ explanation: data.explanation, tip: data.tip })
        answerKeyRef.current = resetKey
      } catch (e) {
        setErr(e instanceof Error ? e.message : 'Something went wrong.')
      } finally {
        setLoading(false)
      }
    },
    [getRequest, resetKey, onBeforeAi],
  )

  const onOpenChange = useCallback(
    (next: boolean) => {
      setOpen(next)
      if (next && !locked) {
        // Fresh step (or no answer yet) → fetch. Same step → keep the answer.
        if (answerKeyRef.current !== resetKey || !answer) {
          setAnswer(null)
          void fetchAnswer(lang)
        }
      }
    },
    [locked, resetKey, answer, fetchAnswer, lang],
  )

  const isFix = variant === 'fix'
  const bnFont = lang === 'bengali' ? { fontFamily: 'var(--font-bengali)' } : undefined

  return (
    <Popover open={open} onOpenChange={onOpenChange}>
      <PopoverTrigger asChild>
        <button
          title={locked ? 'Sign in to unlock the AI tutor' : isFix ? 'Ask the AI tutor to help you fix this' : 'Ask the AI tutor why this happened'}
          className={cn(
            'inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-semibold transition-colors',
            locked
              ? 'border border-dashed border-muted-foreground/40 text-muted-foreground hover:bg-muted'
              : isFix
                ? 'bg-rose-500/15 text-rose-700 dark:text-rose-300 hover:bg-rose-500/25'
                : 'bg-violet-500/15 text-violet-700 dark:text-violet-300 hover:bg-violet-500/25',
          )}
        >
          {locked ? <Lock className="h-3 w-3" /> : isFix ? <WandSparkles className="h-3 w-3" /> : <Sparkles className="h-3 w-3" />}
          {isFix ? 'Help me fix' : 'Why?'}
        </button>
      </PopoverTrigger>
      <PopoverContent align={isFix ? 'start' : 'end'} className="w-80 p-0 overflow-hidden">
        {locked ? (
          <GuestUpsell />
        ) : (
          <div className="flex flex-col">
            <div className="flex items-center gap-2 border-b bg-muted/50 px-3 py-2">
              <Sparkles className="h-4 w-4 text-violet-500" />
              <span className="text-sm font-semibold">AI Tutor</span>
            </div>
            <div className="min-h-24 p-3 text-sm">
              <AnimatePresence mode="wait" initial={false}>
                {loading ? (
                  <motion.div key="loading" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="space-y-2">
                    <div className="flex items-center gap-2 text-xs text-muted-foreground">
                      <Loader2 className="h-3.5 w-3.5 animate-spin" /> thinking…
                    </div>
                    <div className="h-3 w-full animate-pulse rounded bg-muted" />
                    <div className="h-3 w-5/6 animate-pulse rounded bg-muted" />
                    <div className="h-3 w-4/6 animate-pulse rounded bg-muted" />
                  </motion.div>
                ) : err ? (
                  <motion.div key="err" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="space-y-2">
                    <p className="text-xs text-rose-600 dark:text-rose-400">{err}</p>
                    <button
                      onClick={() => void fetchAnswer(lang)}
                      className="inline-flex items-center gap-1 rounded-md border px-2 py-1 text-xs font-semibold hover:bg-muted"
                    >
                      <RefreshCw className="h-3 w-3" /> Try again
                    </button>
                  </motion.div>
                ) : answer ? (
                  <motion.div key={`ans-${lang}`} initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className="space-y-2" style={bnFont}>
                    <p className="leading-relaxed text-foreground">{answer.explanation}</p>
                    {answer.tip && (
                      <p className={cn(
                        'rounded-md px-2 py-1.5 text-[13px] leading-relaxed',
                        isFix ? 'bg-rose-500/10 text-rose-800 dark:text-rose-200' : 'bg-violet-500/10 text-violet-800 dark:text-violet-200',
                      )}>
                        {isFix ? '💡 ' : '🍵 '}{answer.tip}
                      </p>
                    )}
                  </motion.div>
                ) : null}
              </AnimatePresence>
            </div>
          </div>
        )}
      </PopoverContent>
    </Popover>
  )
}

// Shown to signed-out learners: warm, no-pressure, "you're missing the best part".
function GuestUpsell() {
  return (
    <div className="flex flex-col gap-3 p-4">
      <div className="flex items-center gap-2">
        <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-linear-to-br from-violet-500 to-fuchsia-600">
          <Sparkles className="h-4 w-4 text-white" />
        </div>
        <span className="text-sm font-bold">You&apos;re missing the best part!</span>
      </div>
      <p className="text-xs leading-relaxed text-muted-foreground">
        Sign in (it&apos;s free) to unlock the <strong className="text-foreground">AI tutor</strong> — ask
        &quot;why?&quot; on any step and get a friendly explanation in Banglish or English. Plus quizzes and XP.
      </p>
      <p className="text-[11px] leading-relaxed text-muted-foreground">
        No pressure though — keep exploring the visualizer as a guest.
      </p>
      <Link
        href="/sign-in?next=/labs/js-motion"
        className="inline-flex items-center justify-center rounded-lg bg-linear-to-r from-violet-500 to-fuchsia-600 px-3 py-1.5 text-sm font-semibold text-white shadow-sm transition-opacity hover:opacity-90"
      >
        Sign in free
      </Link>
    </div>
  )
}
