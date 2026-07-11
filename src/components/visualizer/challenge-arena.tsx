'use client'

import { useEffect, useState } from 'react'
import { Swords, Flame, Send, Flag, Loader2, Clock, Hash, Lightbulb } from 'lucide-react'
import { motion } from 'framer-motion'
import { MODE } from '@/lib/visualizer/challenge'
import { cn } from '@/lib/utils'
import type { ActiveChallenge, SubmitResult } from './challenge-setup'

interface Props {
  challenge: ActiveChallenge
  busy?: boolean
  lastResult?: SubmitResult | null
  hint?: string | null
  hintBusy?: boolean
  hintUsed?: boolean
  onHint: () => void
  onSubmit: () => void
  onGiveUp: () => void
}

function fmt(ms: number): string {
  const s = Math.max(0, Math.round(ms / 1000))
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`
}

export function ChallengeArena({ challenge, busy, lastResult, hint, hintBusy, hintUsed, onHint, onSubmit, onGiveUp }: Props) {
  const [remaining, setRemaining] = useState<number | null>(null)

  useEffect(() => {
    /* eslint-disable react-hooks/set-state-in-effect */
    if (!challenge.expiresAt) { setRemaining(null); return }
    const end = new Date(challenge.expiresAt).getTime()
    const tick = () => setRemaining(end - Date.now())
    tick()
    const id = setInterval(tick, 500)
    return () => clearInterval(id)
    /* eslint-enable react-hooks/set-state-in-effect */
  }, [challenge.expiresAt])

  const timeUp = remaining !== null && remaining <= 0
  const triesLeft = challenge.maxAttempts >= 9999 ? null : challenge.maxAttempts - challenge.attemptsUsed

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.97 }}
      animate={{ opacity: 1, scale: 1 }}
      className="flex h-full flex-col overflow-hidden rounded-xl border-2 border-rose-500/50 bg-linear-to-b from-rose-50 to-orange-50 dark:from-rose-950/50 dark:to-orange-950/30"
    >
      <div className="flex items-center gap-2 border-b border-rose-500/30 px-3 py-2">
        <Swords className="h-4 w-4 text-rose-500" />
        <span className="text-sm font-bold text-rose-700 dark:text-rose-300">In the Arena</span>
        <span className="ml-auto rounded-full bg-rose-500/15 px-2 py-0.5 font-mono text-[10px] font-bold text-rose-700 dark:text-rose-300">
          {challenge.difficulty} · {MODE[challenge.mode].label}
        </span>
      </div>

      {/* HUD */}
      <div className="flex items-center gap-3 border-b border-rose-500/20 bg-background/40 px-3 py-1.5 text-[11px] font-mono">
        <span className="flex items-center gap-1 text-rose-600 dark:text-rose-400"><Flame className="h-3 w-3" /> {challenge.stake} staked</span>
        {triesLeft !== null && (
          <span className="flex items-center gap-1"><Hash className="h-3 w-3" /> {triesLeft} tr{triesLeft === 1 ? 'y' : 'ies'} left</span>
        )}
        {remaining !== null && (
          <span className={cn('flex items-center gap-1 ml-auto', remaining < 60_000 ? 'text-rose-600 dark:text-rose-400 font-bold' : '')}>
            <Clock className="h-3 w-3" /> {fmt(remaining)}
          </span>
        )}
      </div>

      <div className="flex-1 space-y-3 overflow-y-auto p-3">
        <div>
          <div className="mb-1 text-[11px] font-semibold uppercase tracking-wide text-rose-600 dark:text-rose-400">Your task</div>
          <p className="text-[15px] leading-relaxed text-foreground" style={{ fontFamily: 'var(--font-bengali)' }}>{challenge.prompt}</p>
        </div>
        <div className="rounded-lg border border-border bg-background/60 p-2 font-mono text-[12px]">
          <div className="text-[10px] uppercase tracking-wide text-muted-foreground">Write</div>
          <div className="font-bold text-foreground">{challenge.signature ?? `${challenge.fnName}(…)`}</div>
          <div className="mt-1.5 text-[10px] uppercase tracking-wide text-muted-foreground">Example</div>
          <div className="text-foreground">{challenge.fnName}({JSON.stringify(challenge.sample.input).slice(1, -1)}) → <span className="text-emerald-600 dark:text-emerald-400">{challenge.sample.output}</span></div>
        </div>

        {lastResult && lastResult.status === 'active' && (
          <div className="rounded-lg border border-amber-400/50 bg-amber-50 dark:bg-amber-950/40 px-2.5 py-1.5 text-xs text-amber-800 dark:text-amber-200">
            <strong>{lastResult.passed}/{lastResult.total}</strong> hidden tests passed. Keep going —{' '}
            {lastResult.remainingAttempts !== undefined ? `${lastResult.remainingAttempts} tries left.` : 'try again.'}
          </div>
        )}

        {/* Hint */}
        {hint ? (
          <div className="rounded-lg border border-violet-400/50 bg-violet-50 dark:bg-violet-950/40 px-2.5 py-2 text-[13px] leading-relaxed text-violet-900 dark:text-violet-200" style={{ fontFamily: 'var(--font-bengali)' }}>
            <span className="mr-1">💡</span>{hint}
          </div>
        ) : !hintUsed ? (
          <button
            onClick={onHint}
            disabled={hintBusy || busy}
            className="flex items-center gap-1.5 rounded-lg border border-violet-400/50 px-2.5 py-1.5 text-xs font-semibold text-violet-700 dark:text-violet-300 hover:bg-violet-500/10 disabled:opacity-50"
          >
            {hintBusy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Lightbulb className="h-3.5 w-3.5" />}
            Get a hint (−15 XP)
          </button>
        ) : null}
      </div>

      <div className="flex items-center gap-2 border-t border-rose-500/20 p-2.5">
        <button
          onClick={onGiveUp}
          disabled={busy}
          className="flex items-center gap-1 rounded-lg border border-border px-2.5 py-2 text-xs font-semibold text-muted-foreground hover:bg-muted disabled:opacity-50"
        >
          <Flag className="h-3.5 w-3.5" /> Give up
        </button>
        <button
          onClick={onSubmit}
          disabled={busy || timeUp}
          className={cn(
            'flex flex-1 items-center justify-center gap-2 rounded-lg px-3 py-2 text-sm font-bold text-white transition-opacity',
            busy || timeUp ? 'bg-muted-foreground/40 cursor-not-allowed' : 'bg-linear-to-r from-rose-500 to-orange-600 hover:opacity-90 shadow-lg shadow-rose-500/30',
          )}
        >
          {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
          {timeUp ? "Time's up" : 'Submit solution'}
        </button>
      </div>
    </motion.div>
  )
}
