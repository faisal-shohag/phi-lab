'use client'

import Link from 'next/link'
import { Swords, Flame, Zap, Repeat, Timer, Lock, X, Loader2, FileCode2, Tags } from 'lucide-react'
import { motion } from 'framer-motion'
import { cn } from '@/lib/utils'
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
  stake: number
  fnName: string
  signature?: string
  prompt: string
  sample: { input: unknown; output: string }
  maxAttempts: number
  attemptsUsed: number
  hintsUsed?: number
  expiresAt: string | null
}

export interface SubmitResult {
  status: 'won' | 'lost' | 'active'
  passed: number
  total: number
  xpDelta: number
  balance: number
  remainingAttempts?: number
  reason?: string
  winStreak?: number
  multiplier?: number
  referenceSolution?: string | null
  // The winning attempt id — used to build the public share link.
  attemptId?: string
}

const MODE_ICON: Record<Mode, typeof Zap> = { oneshot: Zap, retries: Repeat, timed: Timer }
const MODE_BLURB: Record<Mode, string> = {
  oneshot: 'One final submit. All or nothing.',
  retries: 'Submit as often as you like. Bonus shrinks with each miss.',
  timed: '3 tries, 5-minute clock. Beat both.',
}

interface Props {
  xp: number
  locked?: boolean
  busy?: boolean
  hasCode?: boolean
  difficulty: Difficulty
  mode: Mode
  source: ChallengeSource
  topics: ChallengeTopic[]
  onChange: (next: { difficulty?: Difficulty; mode?: Mode; source?: ChallengeSource; topics?: ChallengeTopic[] }) => void
  onActivate: () => void
  onClose: () => void
}

export function ChallengeSetup({ xp, locked, busy, hasCode, difficulty, mode, source, topics, onChange, onActivate, onClose }: Props) {
  const stake = DIFFICULTY[difficulty].stake
  const maxWin = reward(mode, stake, 1, mode === 'timed' ? 1 : 0)
  const needsTopic = source === 'topics' && topics.length === 0
  const canAfford = xp >= stake
  const canStart = canAfford && !needsTopic

  const toggleTopic = (id: ChallengeTopic) => {
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
          <div>
            <div className="mb-1.5 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Based on</div>
            <div className="grid grid-cols-2 gap-1.5">
              {([['code', FileCode2, 'My code'], ['topics', Tags, 'Topics']] as const).map(([s, Icon, label]) => (
                <button
                  key={s}
                  onClick={() => onChange({ source: s })}
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

          <div>
            <div className="mb-1.5 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Difficulty</div>
            <div className="grid grid-cols-3 gap-1.5">
              {(Object.keys(DIFFICULTY) as Difficulty[]).map((d) => (
                <button
                  key={d}
                  onClick={() => onChange({ difficulty: d })}
                  className={cn(
                    'rounded-lg border-2 px-2 py-1.5 text-center transition-colors',
                    difficulty === d ? 'border-rose-500 bg-rose-500/10' : 'border-border hover:border-rose-400/50',
                  )}
                >
                  <div className="text-sm font-bold">{DIFFICULTY[d].label}</div>
                  <div className="font-mono text-[11px] text-rose-600 dark:text-rose-400">stake {DIFFICULTY[d].stake}</div>
                </button>
              ))}
            </div>
          </div>

          <div>
            <div className="mb-1.5 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Mode</div>
            <div className="space-y-1.5">
              {(Object.keys(MODE) as Mode[]).map((m) => {
                const Icon = MODE_ICON[m]
                return (
                  <button
                    key={m}
                    onClick={() => onChange({ mode: m })}
                    className={cn(
                      'flex w-full items-start gap-2 rounded-lg border-2 px-2.5 py-2 text-left transition-colors',
                      mode === m ? 'border-rose-500 bg-rose-500/10' : 'border-border hover:border-rose-400/50',
                    )}
                  >
                    <Icon className="mt-0.5 h-4 w-4 shrink-0 text-rose-500" />
                    <div className="min-w-0">
                      <div className="text-sm font-semibold">{MODE[m].label}</div>
                      <div className="text-[11px] leading-snug text-muted-foreground">{MODE_BLURB[m]}</div>
                    </div>
                  </button>
                )
              })}
            </div>
          </div>

          <div className="rounded-lg border border-rose-500/30 bg-background/60 p-2.5 text-center">
            <div className="flex items-center justify-center gap-4 text-sm">
              <span className="text-rose-600 dark:text-rose-400 font-mono font-bold">− {stake} XP</span>
              <span className="text-muted-foreground">stake</span>
              <span className="text-emerald-600 dark:text-emerald-400 font-mono font-bold">up to +{maxWin} XP</span>
            </div>
          </div>

          <button
            onClick={onActivate}
            disabled={!canStart || busy}
            className={cn(
              'flex w-full items-center justify-center gap-2 rounded-lg px-3 py-2.5 text-sm font-bold text-white transition-opacity',
              canStart && !busy ? 'bg-linear-to-r from-rose-500 to-orange-600 hover:opacity-90 shadow-lg shadow-rose-500/30' : 'bg-muted-foreground/40 cursor-not-allowed',
            )}
          >
            {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Flame className="h-4 w-4" />}
            {!canAfford ? `Need ${stake} XP (you have ${xp})` : needsTopic ? 'Pick at least one topic' : `Enter Arena (−${stake} XP)`}
          </button>
          <p className="text-center text-[10px] text-muted-foreground">You have <strong className="text-foreground">{xp}</strong> XP. Staked on entry — win it back with a bonus, or forfeit it.</p>
        </div>
      )}
    </motion.div>
  )
}
