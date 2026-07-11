'use client'

import { useCallback, useRef, useState } from 'react'
import Link from 'next/link'
import { BookOpen, Gauge, Dumbbell, Loader2, RefreshCw, Lock, Sparkles, Check } from 'lucide-react'
import { motion, AnimatePresence } from 'framer-motion'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { interpret } from '@/lib/visualizer/interpreter'
import { cn } from '@/lib/utils'
import type { TutorLang } from './ai-tutor'

type Kind = 'story' | 'complexity' | 'challenge'

interface AiInsightsProps {
  code: string
  // The lab-wide language (bengali | english).
  lang: TutorLang
  locked?: boolean
  // Load a generated challenge program into the editor and run it.
  onUseChallenge: (code: string) => void
  // Gate run before a (paid) AI call; resolve false to abort. Returns true when omitted.
  onBeforeAi?: () => Promise<boolean>
}

const META: Record<Kind, { label: string; icon: typeof BookOpen; title: string }> = {
  story: { label: 'Story', icon: BookOpen, title: 'What this code does, as a story' },
  complexity: { label: 'Complexity', icon: Gauge, title: 'Algorithm & Big-O' },
  challenge: { label: 'Harder one', icon: Dumbbell, title: 'A harder program to load & trace (no stakes)' },
}

export function AiInsights({ code, lang, locked, onUseChallenge, onBeforeAi }: AiInsightsProps) {
  return (
    <div className="flex items-center gap-1.5">
      <span className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground pl-1">AI</span>
      {(Object.keys(META) as Kind[]).map((k) => (
        <InsightAction
          key={k}
          kind={k}
          code={code}
          lang={lang}
          locked={locked}
          onUseChallenge={onUseChallenge}
          onBeforeAi={onBeforeAi}
        />
      ))}
    </div>
  )
}

interface Result {
  title?: string
  story?: string
  name?: string
  bigO?: string
  why?: string
  idea?: string
  code?: string
}

function InsightAction({ kind, code, lang, locked, onUseChallenge, onBeforeAi }: AiInsightsProps & { kind: Kind }) {
  const { label, icon: Icon, title } = META[kind]
  const [open, setOpen] = useState(false)
  const [loading, setLoading] = useState(false)
  const [data, setData] = useState<Result | null>(null)
  const [err, setErr] = useState<string | null>(null)
  // For a challenge: whether the generated program actually runs in the interpreter.
  const [challengeOk, setChallengeOk] = useState(false)
  const forRef = useRef<string>('')

  const run = useCallback(
    async (forLang: TutorLang) => {
      if (onBeforeAi && !(await onBeforeAi())) return
      setLoading(true)
      setErr(null)
      setChallengeOk(false)
      try {
        const res = await fetch('/api/labs/js-motion/insight', {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ kind, code, lang: forLang }),
        })
        const body = await res.json()
        if (!res.ok) throw new Error(body?.message || 'The AI is unavailable right now.')
        setData(body)
        forRef.current = code
        // Validate a generated challenge by actually running it through the
        // interpreter — drop it if it throws or blows the step budget.
        if (kind === 'challenge' && typeof body.code === 'string') {
          try {
            const trace = interpret(body.code, { maxSteps: 2000 })
            setChallengeOk(!trace.truncated && trace.steps.length > 1)
          } catch {
            setChallengeOk(false)
          }
        }
      } catch (e) {
        setErr(e instanceof Error ? e.message : 'Something went wrong.')
      } finally {
        setLoading(false)
      }
    },
    [kind, code, onBeforeAi],
  )

  const onOpenChange = useCallback(
    (next: boolean) => {
      setOpen(next)
      if (next && !locked && (forRef.current !== code || !data)) {
        setData(null)
        void run(lang)
      }
    },
    [locked, code, data, run, lang],
  )

  return (
    <Popover open={open} onOpenChange={onOpenChange}>
      <PopoverTrigger asChild>
        <button
          title={locked ? 'Sign in to unlock' : title}
          className={cn(
            'inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-semibold transition-colors',
            locked
              ? 'border border-dashed border-muted-foreground/40 text-muted-foreground hover:bg-muted'
              : 'bg-violet-500/10 text-violet-700 dark:text-violet-300 hover:bg-violet-500/20',
          )}
        >
          {locked ? <Lock className="h-3 w-3" /> : <Icon className="h-3 w-3" />}
          {label}
        </button>
      </PopoverTrigger>
      <PopoverContent align="start" className="w-80 p-0 overflow-hidden">
        {locked ? (
          <GuestUpsell />
        ) : (
          <div className="flex flex-col">
            <div className="flex items-center gap-2 border-b bg-muted/50 px-3 py-2">
              <Icon className="h-4 w-4 text-violet-500" />
              <span className="text-sm font-semibold">{label}</span>
            </div>
            <div className="min-h-24 p-3 text-sm">
              <AnimatePresence mode="wait" initial={false}>
                {loading ? (
                  <motion.div key="l" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="space-y-2">
                    <div className="flex items-center gap-2 text-xs text-muted-foreground"><Loader2 className="h-3.5 w-3.5 animate-spin" /> thinking…</div>
                    <div className="h-3 w-full animate-pulse rounded bg-muted" />
                    <div className="h-3 w-5/6 animate-pulse rounded bg-muted" />
                  </motion.div>
                ) : err ? (
                  <motion.div key="e" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="space-y-2">
                    <p className="text-xs text-rose-600 dark:text-rose-400">{err}</p>
                    <button onClick={() => void run(lang)} className="inline-flex items-center gap-1 rounded-md border px-2 py-1 text-xs font-semibold hover:bg-muted"><RefreshCw className="h-3 w-3" /> Try again</button>
                  </motion.div>
                ) : data ? (
                  <motion.div key={`d-${lang}`} initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className="space-y-2">
                    {kind === 'story' && (
                      <div style={lang !== 'english' ? { fontFamily: 'var(--font-bengali)' } : undefined}>
                        {data.title && <div className="font-bold text-foreground">{data.title}</div>}
                        <p className="leading-relaxed text-foreground text-[15px]">{data.story}</p>
                      </div>
                    )}
                    {kind === 'complexity' && (
                      <>
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-bold" style={lang !== 'english' ? { fontFamily: 'var(--font-bengali)' } : undefined}>{data.name}</span>
                          <span className="rounded-md bg-violet-500 px-2 py-0.5 font-mono text-xs font-bold text-white">{data.bigO}</span>
                        </div>
                        <p className="leading-relaxed text-muted-foreground text-[15px]" style={lang !== 'english' ? { fontFamily: 'var(--font-bengali)' } : undefined}>{data.why}</p>
                      </>
                    )}
                    {kind === 'challenge' && (
                      <div style={lang !== 'english' ? { fontFamily: 'var(--font-bengali)' } : undefined}>
                        {data.title && <div className="font-bold text-foreground">{data.title}</div>}
                        {data.idea && <p className="text-[14px] leading-relaxed text-muted-foreground">{data.idea}</p>}
                        {data.code && (
                          <pre className="max-h-40 overflow-auto rounded-md bg-muted p-2 font-mono text-[11px] leading-snug">{data.code}</pre>
                        )}
                        {challengeOk && data.code ? (
                          <button
                            onClick={() => { onUseChallenge(data.code!); setOpen(false) }}
                            className="inline-flex items-center gap-1 rounded-md bg-linear-to-r from-violet-500 to-fuchsia-600 px-2.5 py-1 text-xs font-semibold text-white hover:opacity-90"
                          >
                            <Check className="h-3 w-3" /> Load into editor
                          </button>
                        ) : (
                          <div className="flex items-center gap-2">
                            <p className="text-[11px] text-amber-600 dark:text-amber-400">That one didn&apos;t run cleanly.</p>
                            <button onClick={() => void run(lang)} className="inline-flex items-center gap-1 rounded-md border px-2 py-0.5 text-[11px] font-semibold hover:bg-muted"><RefreshCw className="h-3 w-3" /> Regenerate</button>
                          </div>
                        )}
                      </div>
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

function GuestUpsell() {
  return (
    <div className="flex flex-col gap-3 p-4">
      <div className="flex items-center gap-2">
        <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-linear-to-br from-violet-500 to-fuchsia-600">
          <Sparkles className="h-4 w-4 text-white" />
        </div>
        <span className="text-sm font-bold">Unlock AI insights</span>
      </div>
      <p className="text-xs leading-relaxed text-muted-foreground">
        Sign in (free) to get a plain-language <strong className="text-foreground">story</strong> of any program, its
        <strong className="text-foreground"> complexity</strong>, and a <strong className="text-foreground">harder challenge</strong> to trace.
      </p>
      <Link href="/sign-in?next=/labs/js-motion" className="inline-flex items-center justify-center rounded-lg bg-linear-to-r from-violet-500 to-fuchsia-600 px-3 py-1.5 text-sm font-semibold text-white hover:opacity-90">
        Sign in free
      </Link>
    </div>
  )
}
