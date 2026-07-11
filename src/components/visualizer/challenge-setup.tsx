'use client'

import Link from 'next/link'
import { Swords, Flame, Zap, Repeat, Timer, Lock, X, Loader2, FileCode2, Tags, Sparkles, Skull } from 'lucide-react'
import { motion } from 'framer-motion'
import { cn } from '@/lib/utils'
import { playSelect } from '@/lib/visualizer/sound'
import { useArenaJuice } from './arena-fx'
import {
  DIFFICULTY, MODE, reward, CHALLENGE_TOPICS,
  type Difficulty, type Mode, type ChallengeSource, type ChallengeTopic,
} from '@/lib/visualizer/challenge'

// The client-safe shape of an active round (mirrors what the routes return —
// never includes the hidden tests / expected outputs).
export interface ActiveChallenge {
  attemptId: string
  difficulty: Difficulty
  mode: Mode
  lang: 'bengali' | 'english'
  stake: number
  fnName: string
  signature?: string
  prompt: string
  sample: { input: unknown; output: string }
  maxAttempts: number
  attemptsUsed: number
  hintsUsed?: number
  // Consecutive prior wins the learner carries into this round (drives the HUD
  // streak flame + the "next win ×N" preview).
  currentStreak?: number
  expiresAt: string | null
}

export interface SubmitResult {
  status: 'won' | 'lost' | 'active' | 'rescue'
  // Present when a Blitz round can be rescued: 'time' (clock out → resume +5min
  // & +1 life) or 'life' (tries out, clock running → buy +1 life).
  rescuable?: 'time' | 'life'
  passed: number
  total: number
  xpDelta: number
  balance: number
  remainingAttempts?: number
  reason?: string
  winStreak?: number
  multiplier?: number
  // A timed win with the clock nearly out — triggers the CLUTCH moment.
  clutch?: boolean
  referenceSolution?: string | null
  // The winning attempt id — used to build the public share link.
  attemptId?: string
}

// ── Tier art / theming ───────────────────────────────────────────────────────
const DIFF_META: Record<Difficulty, { icon: typeof Sparkles; chips: number; tag: string; ring: string; text: string; glow: string }> = {
  easy: { icon: Sparkles, chips: 1, tag: 'Spark', ring: 'border-emerald-500 bg-emerald-500/10', text: 'text-emerald-600 dark:text-emerald-400', glow: 'shadow-emerald-500/40' },
  medium: { icon: Flame, chips: 2, tag: 'Flame', ring: 'border-amber-500 bg-amber-500/10', text: 'text-amber-600 dark:text-amber-400', glow: 'shadow-amber-500/40' },
  hard: { icon: Skull, chips: 5, tag: 'Inferno', ring: 'border-rose-500 bg-rose-500/10', text: 'text-rose-600 dark:text-rose-400', glow: 'shadow-rose-500/40' },
}

const MODE_META: Record<Mode, { icon: typeof Zap; name: string; blurb: string }> = {
  oneshot: { icon: Zap, name: 'Sudden Death', blurb: 'One final submit. All or nothing.' },
  retries: { icon: Repeat, name: 'Endurance', blurb: 'Submit as often as you like. Bonus shrinks with each miss.' },
  timed: { icon: Timer, name: 'Blitz', blurb: '3 tries, 5-minute clock. Beat both.' },
}

// Riskiness 0..1 from the picks — feeds the risk gauge.
const DIFF_RISK: Record<Difficulty, number> = { easy: 0, medium: 0.5, hard: 1 }
const MODE_RISK: Record<Mode, number> = { retries: 0, timed: 0.5, oneshot: 1 }
function riskLabel(r: number): string {
  if (r >= 0.85) return 'EXTREME'
  if (r >= 0.6) return 'High'
  if (r >= 0.3) return 'Medium'
  return 'Low'
}

interface Props {
  xp: number
  locked?: boolean
  busy?: boolean
  hasCode?: boolean
  calm?: boolean
  sound?: boolean
  difficulty: Difficulty
  mode: Mode
  source: ChallengeSource
  topics: ChallengeTopic[]
  onChange: (next: { difficulty?: Difficulty; mode?: Mode; source?: ChallengeSource; topics?: ChallengeTopic[] }) => void
  onActivate: () => void
  onClose: () => void
}

export function ChallengeSetup({ xp, locked, busy, hasCode, calm, sound, difficulty, mode, source, topics, onChange, onActivate, onClose }: Props) {
  const juice = useArenaJuice(calm)
  const stake = DIFFICULTY[difficulty].stake
  const maxWin = reward(mode, stake, 1, mode === 'timed' ? 1 : 0)
  const needsTopic = source === 'topics' && topics.length === 0
  const canAfford = xp >= stake
  const canStart = canAfford && !needsTopic

  const risk = (DIFF_RISK[difficulty] + MODE_RISK[mode]) / 2

  const click = () => { if (sound && juice) playSelect() }
  const pickDifficulty = (d: Difficulty) => { if (d !== difficulty) click(); onChange({ difficulty: d }) }
  const pickMode = (m: Mode) => { if (m !== mode) click(); onChange({ mode: m }) }
  const toggleTopic = (id: ChallengeTopic) => {
    click()
    onChange({ topics: topics.includes(id) ? topics.filter((t) => t !== id) : [...topics, id] })
  }

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.97 }}
      animate={{ opacity: 1, scale: 1 }}
      className="flex h-full flex-col overflow-hidden rounded-xl border-2 border-rose-500/40 bg-linear-to-b from-rose-50 to-orange-50 dark:from-rose-950/40 dark:to-orange-950/30"
    >
      <div className="flex items-center gap-2 border-b border-rose-500/30 px-3 py-2">
        <Swords className="h-4 w-4 text-rose-500" />
        <span className="text-sm font-bold text-rose-700 dark:text-rose-300">Challenge Arena</span>
        <button onClick={onClose} className="ml-auto rounded p-0.5 text-muted-foreground hover:bg-rose-500/10"><X className="h-4 w-4" /></button>
      </div>

      {locked ? (
        <div className="flex flex-1 flex-col items-center justify-center gap-3 p-5 text-center">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-linear-to-br from-rose-500 to-orange-600"><Lock className="h-5 w-5 text-white" /></div>
          <p className="text-sm font-semibold">Sign in to enter the arena</p>
          <p className="text-xs text-muted-foreground">Stake XP, beat an AI challenge graded on hidden tests, win it back with a bonus.</p>
          <Link href="/sign-in?next=/labs/js-motion" className="rounded-lg bg-linear-to-r from-rose-500 to-orange-600 px-3 py-1.5 text-sm font-semibold text-white hover:opacity-90">Sign in free</Link>
        </div>
      ) : (
        <div className="flex-1 space-y-3 overflow-y-auto p-3">
          {/* Based on */}
          <div>
            <div className="mb-1.5 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Based on</div>
            <div className="grid grid-cols-2 gap-1.5">
              {([['code', FileCode2, 'My code'], ['topics', Tags, 'Topics']] as const).map(([s, Icon, label]) => (
                <button
                  key={s}
                  onClick={() => { click(); onChange({ source: s }) }}
                  className={cn(
                    'flex items-center justify-center gap-1.5 rounded-lg border-2 px-2 py-1.5 text-sm font-semibold transition-colors',
                    source === s ? 'border-rose-500 bg-rose-500/10' : 'border-border hover:border-rose-400/50',
                  )}
                >
                  <Icon className="h-4 w-4 text-rose-500" /> {label}
                </button>
              ))}
            </div>
            {source === 'code' && !hasCode && (
              <p className="mt-1 text-[10px] text-muted-foreground">Editor is empty — you&apos;ll get a fresh beginner exercise.</p>
            )}
            {source === 'topics' && (
              <div className="mt-2 flex flex-wrap gap-1.5">
                {CHALLENGE_TOPICS.map((t) => (
                  <button
                    key={t.id}
                    onClick={() => toggleTopic(t.id)}
                    className={cn(
                      'rounded-full border px-2 py-0.5 text-[11px] font-medium transition-colors',
                      topics.includes(t.id)
                        ? 'border-rose-500 bg-rose-500 text-white'
                        : 'border-border text-muted-foreground hover:border-rose-400/60 hover:text-foreground',
                    )}
                  >
                    {t.label}
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Difficulty — tier cards */}
          <div>
            <div className="mb-1.5 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Pick your tier</div>
            <div className="grid grid-cols-3 gap-1.5" style={{ perspective: 600 }}>
              {(Object.keys(DIFFICULTY) as Difficulty[]).map((d) => {
                const meta = DIFF_META[d]
                const Icon = meta.icon
                const active = difficulty === d
                return (
                  <motion.button
                    key={d}
                    onClick={() => pickDifficulty(d)}
                    whileHover={juice ? { y: -3, rotateX: 5 } : undefined}
                    whileTap={juice ? { scale: 0.97 } : undefined}
                    animate={active && juice ? { y: -3 } : { y: 0 }}
                    className={cn(
                      'flex flex-col items-center gap-1 rounded-xl border-2 px-1.5 py-2.5 text-center transition-colors',
                      active ? `${meta.ring} shadow-lg ${meta.glow}` : 'border-border hover:border-rose-400/40',
                    )}
                  >
                    <Icon className={cn('h-6 w-6', active ? meta.text : 'text-muted-foreground')} />
                    <div className="text-sm font-bold">{DIFFICULTY[d].label}</div>
                    <div className={cn('text-[9px] font-bold uppercase tracking-wide', active ? meta.text : 'text-muted-foreground/70')}>{meta.tag}</div>
                    {/* Poker-chip stack for the stake */}
                    <div className="flex items-center gap-0.5">
                      {Array.from({ length: meta.chips }).map((_, i) => (
                        <span key={i} className={cn('h-2 w-2 rounded-full border', active ? `${meta.text} border-current` : 'border-muted-foreground/40')} style={{ backgroundColor: 'currentColor', opacity: active ? 0.8 : 0.3 }} />
                      ))}
                    </div>
                    <div className={cn('font-mono text-[10px]', active ? meta.text : 'text-muted-foreground')}>{DIFFICULTY[d].stake} XP</div>
                  </motion.button>
                )
              })}
            </div>
          </div>

          {/* Mode — game modes */}
          <div>
            <div className="mb-1.5 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Game mode</div>
            <div className="space-y-1.5">
              {(Object.keys(MODE) as Mode[]).map((m) => {
                const meta = MODE_META[m]
                const Icon = meta.icon
                const active = mode === m
                return (
                  <motion.button
                    key={m}
                    onClick={() => pickMode(m)}
                    whileTap={juice ? { scale: 0.98 } : undefined}
                    animate={active && juice ? { rotateY: [0, 8, 0] } : undefined}
                    transition={{ duration: 0.4 }}
                    className={cn(
                      'flex w-full items-center gap-2.5 rounded-lg border-2 px-2.5 py-2 text-left transition-colors',
                      active ? 'border-rose-500 bg-rose-500/10' : 'border-border hover:border-rose-400/50',
                    )}
                  >
                    <div className={cn('flex h-8 w-8 shrink-0 items-center justify-center rounded-lg', active ? 'bg-linear-to-br from-rose-500 to-orange-600 text-white' : 'bg-muted text-muted-foreground')}>
                      <Icon className="h-4 w-4" />
                    </div>
                    <div className="min-w-0">
                      <div className="flex items-baseline gap-1.5">
                        <span className="text-sm font-bold">{meta.name}</span>
                        <span className="text-[10px] font-medium text-muted-foreground">{MODE[m].label}</span>
                      </div>
                      <div className="text-[11px] leading-snug text-muted-foreground">{meta.blurb}</div>
                    </div>
                  </motion.button>
                )
              })}
            </div>
          </div>

          {/* Risk gauge */}
          <div className="rounded-lg border border-rose-500/30 bg-background/60 p-2.5">
            <div className="mb-1 flex items-center justify-between text-[11px]">
              <span className="font-semibold uppercase tracking-wide text-muted-foreground">Risk</span>
              <span className={cn('font-mono font-bold', risk >= 0.6 ? 'text-rose-600 dark:text-rose-400' : risk >= 0.3 ? 'text-amber-600 dark:text-amber-400' : 'text-emerald-600 dark:text-emerald-400')}>{riskLabel(risk)}</span>
            </div>
            <div className="relative h-2 overflow-hidden rounded-full bg-linear-to-r from-emerald-500 via-amber-500 to-rose-600">
              <motion.span
                className="absolute top-1/2 h-3.5 w-3.5 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-white bg-foreground shadow"
                animate={{ left: `${risk * 100}%` }}
                transition={juice ? { type: 'spring', stiffness: 260, damping: 22 } : { duration: 0 }}
              />
            </div>
            <div className="mt-2 flex items-center justify-center gap-3 text-sm">
              <span className="font-mono font-bold text-rose-600 dark:text-rose-400">− {stake} XP</span>
              <span className="text-[11px] text-muted-foreground">stake</span>
              <span className="font-mono font-bold text-emerald-600 dark:text-emerald-400">up to +{maxWin} XP</span>
            </div>
          </div>

          {/* Enter CTA — breathes when ready, extinguished when not */}
          <motion.button
            onClick={onActivate}
            disabled={!canStart || busy}
            animate={canStart && !busy && juice ? { scale: [1, 1.02, 1] } : { scale: 1 }}
            transition={{ duration: 2, repeat: canStart && !busy && juice ? Infinity : 0, ease: 'easeInOut' }}
            whileHover={canStart && !busy ? { scale: 1.03 } : undefined}
            className={cn(
              'group flex w-full items-center justify-center gap-2 rounded-lg px-3 py-2.5 text-sm font-bold text-white transition-colors',
              canStart && !busy ? 'bg-linear-to-r from-rose-500 to-orange-600 shadow-lg shadow-rose-500/30' : 'bg-muted-foreground/40 cursor-not-allowed grayscale',
            )}
          >
            {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : (
              <motion.span animate={canStart && juice ? { opacity: [1, 0.6, 1], scale: [1, 1.15, 1] } : undefined} transition={{ duration: 1.1, repeat: Infinity }} className="inline-flex">
                <Flame className="h-4 w-4" />
              </motion.span>
            )}
            {!canAfford ? `Need ${stake} XP (you have ${xp})` : needsTopic ? 'Pick at least one topic' : `Enter Arena (−${stake} XP)`}
          </motion.button>
          <p className="text-center text-[10px] text-muted-foreground">You have <strong className="text-foreground">{xp}</strong> XP. Staked on entry — win it back with a bonus, or forfeit it.</p>
        </div>
      )}
    </motion.div>
  )
}
