'use client'

import { useEffect, useRef, useState } from 'react'
import { Swords, Flame, Send, Flag, Loader2, Clock, Heart, HeartCrack, Lightbulb } from 'lucide-react'
import { motion, AnimatePresence } from 'framer-motion'
import { MODE, streakMultiplier } from '@/lib/visualizer/challenge'
import { playShatter, playTick, playCharge, playComboBlip } from '@/lib/visualizer/sound'
import { cn } from '@/lib/utils'
import { ArenaEmbers, useArenaJuice } from './arena-fx'
import type { ActiveChallenge, SubmitResult } from './challenge-setup'

interface Props {
  challenge: ActiveChallenge
  busy?: boolean
  lastResult?: SubmitResult | null
  hint?: string | null
  hintBusy?: boolean
  hintUsed?: boolean
  calm?: boolean
  sound?: boolean
  onHint: () => void
  onSubmit: () => void
  onGiveUp: () => void
}

function fmt(ms: number): string {
  const s = Math.max(0, Math.round(ms / 1000))
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`
}

const HOLD_MS = 450 // press-and-hold duration to fire a submit

export function ChallengeArena({ challenge, busy, lastResult, hint, hintBusy, hintUsed, calm, sound, onHint, onSubmit, onGiveUp }: Props) {
  const [remaining, setRemaining] = useState<number | null>(null)
  const juice = useArenaJuice(calm)

  // Per-second tick in the last 10s (timed mode). Track the last whole second.
  const lastTickSec = useRef<number | null>(null)
  useEffect(() => {
    /* eslint-disable react-hooks/set-state-in-effect */
    if (!challenge.expiresAt) { setRemaining(null); return }
    const end = new Date(challenge.expiresAt).getTime()
    const tick = () => {
      const rem = end - Date.now()
      setRemaining(rem)
      const sec = Math.ceil(rem / 1000)
      if (rem > 0 && rem <= 10_000 && sec !== lastTickSec.current) {
        lastTickSec.current = sec
        if (sound && juice) playTick()
      }
    }
    tick()
    const id = setInterval(tick, 250)
    return () => clearInterval(id)
    /* eslint-enable react-hooks/set-state-in-effect */
  }, [challenge.expiresAt, sound, juice])

  const timeUp = remaining !== null && remaining <= 0
  const capped = challenge.maxAttempts < 9999
  const triesLeft = capped ? challenge.maxAttempts - challenge.attemptsUsed : null

  // Detect a just-lost try to shatter its pip + play a crack.
  const prevTries = useRef(triesLeft)
  const [shatterIdx, setShatterIdx] = useState<number | null>(null)
  useEffect(() => {
    if (triesLeft === null || prevTries.current === null) { prevTries.current = triesLeft; return }
    if (triesLeft < prevTries.current) {
      setShatterIdx(triesLeft) // the pip at this index just broke
      if (sound && juice) playShatter()
      const t = setTimeout(() => setShatterIdx(null), 600)
      prevTries.current = triesLeft
      return () => clearTimeout(t)
    }
    prevTries.current = triesLeft
  }, [triesLeft, sound, juice])

  // Hint "purchase" flourish — a −15 XP chip flies off when a hint arrives.
  const prevHint = useRef(hint)
  const [purchased, setPurchased] = useState(false)
  useEffect(() => {
    if (!prevHint.current && hint) {
      setPurchased(true)
      const t = setTimeout(() => setPurchased(false), 900)
      prevHint.current = hint
      return () => clearTimeout(t)
    }
    prevHint.current = hint
  }, [hint])

  // Timer urgency tiers.
  const urgent = remaining !== null && remaining < 30_000 && remaining > 0
  const warn = remaining !== null && remaining < 120_000 && remaining >= 30_000

  // Streak flame.
  const streak = challenge.currentStreak ?? 0
  const nextMult = streakMultiplier(streak + 1)

  // ── Hold-to-submit charge ───────────────────────────────────────────────
  const [charge, setCharge] = useState(0) // 0..1
  const [tapHint, setTapHint] = useState(false)
  const holdStart = useRef<number | null>(null)
  const holdRaf = useRef<number | null>(null)
  const holding = useRef(false)
  const lastChargeBeep = useRef(0)
  const fired = useRef(false)
  const disabled = busy || timeUp

  const cancelHold = () => {
    if (holdRaf.current !== null) cancelAnimationFrame(holdRaf.current)
    holdRaf.current = null
    holdStart.current = null
    holding.current = false
    setCharge(0)
  }
  // Driven by rAF timestamps (no Date.now) so it stays render-pure.
  const stepHold = (ts: number) => {
    if (holding.current === false) return
    if (holdStart.current === null) holdStart.current = ts
    const frac = Math.min(1, (ts - holdStart.current) / HOLD_MS)
    setCharge(frac)
    if (sound && juice && frac - lastChargeBeep.current >= 0.25) { lastChargeBeep.current = frac; playCharge(frac) }
    if (frac >= 1) {
      fired.current = true
      cancelHold()
      onSubmit()
      return
    }
    holdRaf.current = requestAnimationFrame(stepHold)
  }
  const startHold = () => {
    if (disabled) return
    // Reduced-motion / calm: skip the charge ceremony, submit on a plain press.
    if (!juice) { onSubmit(); return }
    fired.current = false
    holding.current = true
    lastChargeBeep.current = 0
    holdStart.current = null
    setTapHint(false)
    holdRaf.current = requestAnimationFrame(stepHold)
  }
  const endHold = () => {
    if (holding.current === false || fired.current) return
    // Released before the ring filled — treat as a fat-finger, nudge to hold.
    cancelHold()
    setTapHint(true)
  }
  useEffect(() => () => { if (holdRaf.current !== null) cancelAnimationFrame(holdRaf.current) }, [])

  // ── Combo bar: segmented reveal of a miss's passed/total ─────────────────
  const missResult = lastResult && lastResult.status === 'active' ? lastResult : null
  const [litSegs, setLitSegs] = useState(0)
  const comboKey = missResult ? `${missResult.passed}/${missResult.total}/${challenge.attemptsUsed}` : ''
  useEffect(() => {
    /* eslint-disable react-hooks/set-state-in-effect */
    if (!missResult) { setLitSegs(0); return }
    if (!juice) { setLitSegs(missResult.passed); return }
    setLitSegs(0)
    let i = 0
    const id = setInterval(() => {
      i++
      setLitSegs(i)
      if (sound) playComboBlip(i - 1)
      if (i >= missResult.passed) clearInterval(id)
    }, 90)
    return () => clearInterval(id)
    /* eslint-enable react-hooks/set-state-in-effect */
    // Re-run whenever a new miss lands.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [comboKey, juice, sound])

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.97 }}
      animate={{ opacity: 1, scale: 1 }}
      className={cn(
        'relative flex h-full flex-col overflow-hidden rounded-xl border-2 border-rose-500/50 bg-linear-to-b from-rose-50 to-orange-50 dark:from-rose-950/50 dark:to-orange-950/30',
        urgent && juice && 'animate-arena-pulse',
      )}
    >
      <ArenaEmbers calm={calm} />
      {/* Slow crimson vignette — the arena breathes. */}
      {juice && (
        <div className="pointer-events-none absolute inset-0 z-0 animate-arena-vignette bg-[radial-gradient(ellipse_at_center,transparent_45%,rgba(190,18,60,0.28)_100%)]" />
      )}

      <div className="relative z-10 flex items-center gap-2 border-b border-rose-500/30 px-3 py-2">
        <Swords className="h-4 w-4 text-rose-500" />
        <span className="text-sm font-bold text-rose-700 dark:text-rose-300">In the Arena</span>
        <span className="ml-auto rounded-full bg-rose-500/15 px-2 py-0.5 font-mono text-[10px] font-bold text-rose-700 dark:text-rose-300">
          {challenge.difficulty} · {MODE[challenge.mode].label}
        </span>
      </div>

      {/* HUD */}
      <div className="relative z-10 flex items-center gap-3 border-b border-rose-500/20 bg-background/40 px-3 py-1.5 text-[11px] font-mono">
        <span className="flex items-center gap-1 text-rose-600 dark:text-rose-400"><Flame className="h-3 w-3" /> {challenge.stake} staked</span>

        {/* Streak flame meter */}
        {streak > 0 && (
          <span
            className="group relative flex items-center gap-0.5 text-amber-600 dark:text-amber-400"
            title={`${streak}-win streak · win again for ${nextMult}× XP`}
          >
            <motion.span
              animate={juice ? { scale: [1, 1.18, 1] } : undefined}
              transition={{ duration: 1.6, repeat: Infinity, ease: 'easeInOut' }}
              className="inline-flex"
              style={{ filter: streak >= 5 ? 'drop-shadow(0 0 6px rgba(251,146,60,0.8))' : streak >= 3 ? 'drop-shadow(0 0 4px rgba(251,146,60,0.6))' : undefined }}
            >
              <Flame className={cn('h-3.5 w-3.5 fill-current', streak >= 5 ? 'text-orange-500' : streak >= 3 ? 'text-amber-500' : 'text-amber-400')} />
            </motion.span>
            <span className="font-bold tabular-nums">{streak}</span>
            <span className="ml-0.5 rounded bg-amber-500/15 px-1 text-[9px] font-bold text-amber-700 dark:text-amber-300">next {nextMult}×</span>
          </span>
        )}

        {/* Tries as heart pips */}
        {capped && (
          <span className="flex items-center gap-0.5">
            {Array.from({ length: challenge.maxAttempts }).map((_, i) => {
              const alive = i < (triesLeft ?? 0)
              const breaking = shatterIdx === i
              return (
                <motion.span
                  key={i}
                  animate={breaking && juice ? { scale: [1, 1.5, 0.2], rotate: [0, -20, 25], opacity: [1, 1, 0.35] } : { scale: 1 }}
                  transition={{ duration: 0.5 }}
                >
                  {alive
                    ? <Heart className="h-3.5 w-3.5 fill-rose-500 text-rose-500" />
                    : <HeartCrack className="h-3.5 w-3.5 text-muted-foreground/50" />}
                </motion.span>
              )
            })}
          </span>
        )}

        {remaining !== null && (
          <span
            className={cn(
              'ml-auto flex items-center gap-1 rounded px-1.5 py-0.5 transition-colors',
              urgent ? 'bg-rose-500 text-white font-bold' : warn ? 'text-amber-600 dark:text-amber-400 font-bold' : 'text-foreground',
              urgent && juice && 'animate-arena-shake',
            )}
          >
            <Clock className="h-3 w-3" /> {fmt(remaining)}
          </span>
        )}
      </div>

      <div className="relative z-10 flex-1 space-y-3 overflow-y-auto p-3">
        <div>
          <div className="mb-1 text-[11px] font-semibold uppercase tracking-wide text-rose-600 dark:text-rose-400">Your task</div>
          <p className="text-[15px] leading-relaxed text-foreground" style={challenge.lang === 'bengali' ? { fontFamily: 'var(--font-bengali)' } : undefined}>{challenge.prompt}</p>
        </div>
        <div className="rounded-lg border border-border bg-background/60 p-2 font-mono text-[12px]">
          <div className="text-[10px] uppercase tracking-wide text-muted-foreground">Write</div>
          <div className="font-bold text-foreground">{challenge.signature ?? `${challenge.fnName}(…)`}</div>
          <div className="mt-1.5 text-[10px] uppercase tracking-wide text-muted-foreground">Example</div>
          <div className="text-foreground">{challenge.fnName}({JSON.stringify(challenge.sample.input).slice(1, -1)}) → <span className="text-emerald-600 dark:text-emerald-400">{challenge.sample.output}</span></div>
        </div>

        {/* Combo bar — a miss's passed/total lights up segment by segment. */}
        <AnimatePresence>
          {missResult && (
            <motion.div
              initial={{ opacity: 0, y: -6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
              className="rounded-lg border border-amber-400/50 bg-amber-50 dark:bg-amber-950/40 px-2.5 py-2"
            >
              <div className="mb-1.5 flex items-center justify-between text-xs text-amber-800 dark:text-amber-200">
                <span className="font-bold tabular-nums">{Math.min(litSegs, missResult.passed)}/{missResult.total} passed</span>
                <span className="text-[11px]">{missResult.remainingAttempts !== undefined ? `${missResult.remainingAttempts} tries left` : 'try again'}</span>
              </div>
              <div className="flex gap-1">
                {Array.from({ length: missResult.total }).map((_, i) => {
                  const passed = i < missResult.passed
                  const lit = i < litSegs
                  return (
                    <motion.span
                      key={i}
                      animate={lit && juice ? { scale: [1, 1.25, 1] } : { scale: 1 }}
                      transition={{ duration: 0.25 }}
                      className={cn(
                        'h-2 flex-1 rounded-full transition-colors duration-200',
                        !passed ? 'bg-rose-400/70' : lit ? 'bg-emerald-500' : 'bg-emerald-500/20',
                      )}
                    />
                  )
                })}
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Hint */}
        {hint ? (
          <div className="relative" style={{ perspective: 600 }}>
            {/* B5 purchase chip — flies up as the hint flips in. */}
            <AnimatePresence>
              {purchased && juice && (
                <motion.span
                  initial={{ opacity: 0, y: 6, scale: 0.8 }}
                  animate={{ opacity: [0, 1, 1, 0], y: -28, scale: 1 }}
                  exit={{ opacity: 0 }}
                  transition={{ duration: 0.85 }}
                  className="pointer-events-none absolute right-2 top-0 z-10 rounded-full bg-violet-600 px-1.5 py-0.5 text-[10px] font-black text-white shadow"
                >
                  −15 XP
                </motion.span>
              )}
            </AnimatePresence>
            <motion.div
              initial={{ opacity: 0, rotateX: juice ? -90 : -20 }} animate={{ opacity: 1, rotateX: 0 }}
              transition={{ type: 'spring', stiffness: 260, damping: 22 }}
              className="rounded-lg border border-violet-400/50 bg-violet-50 dark:bg-violet-950/40 px-2.5 py-2 text-[13px] leading-relaxed text-violet-900 dark:text-violet-200"
              style={challenge.lang === 'bengali' ? { fontFamily: 'var(--font-bengali)' } : undefined}
            >
              <span className="mr-1">💡</span>{hint}
            </motion.div>
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

      <div className="relative z-10 flex items-center gap-2 border-t border-rose-500/20 p-2.5">
        <button
          onClick={onGiveUp}
          disabled={busy}
          className="flex items-center gap-1 rounded-lg border border-border px-2.5 py-2 text-xs font-semibold text-muted-foreground hover:bg-muted disabled:opacity-50"
        >
          <Flag className="h-3.5 w-3.5" /> Give up
        </button>

        {/* Hold-to-submit: press and hold to fill the bar, then it fires. */}
        <motion.button
          onPointerDown={startHold}
          onPointerUp={endHold}
          onPointerLeave={endHold}
          onPointerCancel={endHold}
          disabled={disabled}
          animate={tapHint && juice ? { x: [0, -5, 5, -3, 3, 0] } : { x: 0 }}
          transition={{ duration: 0.35 }}
          className={cn(
            'relative flex flex-1 select-none items-center justify-center gap-2 overflow-hidden rounded-lg px-3 py-2 text-sm font-bold text-white transition-all touch-none',
            disabled ? 'bg-muted-foreground/40 cursor-not-allowed' : 'bg-linear-to-r from-rose-500 to-orange-600 shadow-lg shadow-rose-500/30',
          )}
        >
          {/* Charge fill */}
          {charge > 0 && (
            <span
              className="pointer-events-none absolute inset-y-0 left-0 bg-white/30"
              style={{ width: `${charge * 100}%` }}
            />
          )}
          <span className="relative flex items-center gap-2">
            {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
            {timeUp ? "Time's up" : busy ? 'Grading…' : charge > 0 ? 'Charging…' : tapHint ? 'Hold to submit' : juice ? 'Hold to submit' : 'Submit solution'}
          </span>
        </motion.button>
      </div>
    </motion.div>
  )
}
