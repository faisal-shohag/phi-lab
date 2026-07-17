'use client'

// Achievements page body: a big level card (live via the shared XP store) plus
// the full badge grid with earned/locked states.
import { useEffect } from 'react'
import {
  Sparkles, Rocket, GraduationCap, Mic, Trophy, Flame, Target, Zap, Crown, Snowflake,
  Presentation, Lightbulb, Languages, MessageCircle, Palette, LifeBuoy, Lock,
  CalendarCheck, GitBranch, Lasso, Timer, Boxes,
  ArrowDownWideNarrow, Swords, Shield, Bug, BugOff,
  Code2, Braces, Terminal, Cpu,
  type LucideIcon,
} from 'lucide-react'
import { BADGES, type BadgeStats } from '@/lib/gamification/badges'
import { useXp, refreshXp } from '@/lib/gamification/use-xp'
import { cn } from '@/lib/utils'

const ICONS: Record<string, LucideIcon> = {
  Sparkles, Rocket, GraduationCap, Mic, Trophy, Flame, Target, Zap, Crown, Snowflake, Presentation, Lightbulb, Languages, MessageCircle, Palette, LifeBuoy,
  CalendarCheck, GitBranch, Lasso, Timer, Boxes, ArrowDownWideNarrow, Swords, Shield, Bug, BugOff,
  Code2, Braces, Terminal, Cpu,
}

interface AchievementsProps {
  initialXp: number
  initialBadgeIds: string[]
  stats: BadgeStats
}

export function Achievements({ initialXp, initialBadgeIds, stats }: AchievementsProps) {
  const { xp, info, badgeIds, loaded } = useXp()

  // Seed the store with server data on first paint, then keep it fresh.
  useEffect(() => {
    void refreshXp()
  }, [])

  const effectiveXp = loaded ? xp : initialXp
  const effectiveBadges = loaded ? badgeIds : initialBadgeIds
  const earned = new Set(effectiveBadges)
  const earnedCount = BADGES.filter((b) => earned.has(b.id)).length

  return (
    <div className="space-y-6">
      {/* Level card */}
      <div className="flex flex-col items-center gap-5 rounded-2xl border-2 border-border bg-card p-6 shadow-sm sm:flex-row sm:gap-8">
        <LevelRing progress={info.progress} level={info.level} />
        <div className="flex-1 text-center sm:text-left">
          <div className="text-xs uppercase tracking-wide text-muted-foreground">Level {info.level}</div>
          <div className="text-2xl font-bold">{info.title}</div>
          <div className="mt-1 text-sm text-muted-foreground">
            {effectiveXp} XP total · {Math.max(0, info.nextLevelAt - effectiveXp)} XP to level {info.level + 1}
          </div>
          <div className="mt-3 h-2.5 overflow-hidden rounded-full bg-muted">
            <div
              className="h-full rounded-full bg-linear-to-r from-amber-400 to-fuchsia-500 transition-[width] duration-700"
              style={{ width: `${Math.round(info.progress * 100)}%` }}
            />
          </div>
        </div>
      </div>

       {/* Stat strip */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Stat label="Interviews done" value={stats.interviewsCompleted} />
        <Stat label="Best interview" value={stats.bestInterviewScore} />
        <Stat label="Quizzes correct" value={stats.quizCorrect} />
        <Stat label="Best streak" value={stats.bestQuizStreak} />
        <Stat label="Teach-backs" value={stats.feynmanCompleted} />
        <Stat label="Best clarity" value={stats.bestClarity} />
        <Stat label="English sessions" value={stats.englishCompleted} />
        <Stat label="Analogies made" value={stats.analogiesCreated} />
      </div>

      {/* Badge grid */}
      <div>
        <div className="mb-3 flex items-baseline justify-between">
          <h2 className="text-lg font-bold">Badges</h2>
          <span className="text-sm text-muted-foreground">
            {earnedCount} / {BADGES.length} unlocked
          </span>
        </div>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
          {BADGES.map((b) => {
            const Icon = ICONS[b.icon] ?? Sparkles
            const got = earned.has(b.id)
            return (
              <div
                key={b.id}
                className={cn(
                  'flex flex-col items-center gap-2 rounded-2xl border-2 p-4 text-center transition-colors',
                  got ? 'border-border bg-card shadow-sm' : 'border-dashed border-border/60 bg-muted/30',
                )}
              >
                <div
                  className={cn(
                    'flex h-14 w-14 items-center justify-center rounded-full',
                    got ? cn('bg-linear-to-br text-white shadow-md', b.tint) : 'bg-muted text-muted-foreground',
                  )}
                >
                  {got ? <Icon className="h-7 w-7" /> : <Lock className="h-6 w-6" />}
                </div>
                <div className={cn('text-sm font-semibold', !got && 'text-muted-foreground')}>{b.label}</div>
                <div className="text-[11px] leading-snug text-muted-foreground">{b.description}</div>
              </div>
            )
          })}
        </div>
      </div>

     
    </div>
  )
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-2xl border-2 border-border bg-card p-4 text-center shadow-sm">
      <div className="text-2xl font-bold tabular-nums">{value}</div>
      <div className="mt-0.5 text-[11px] text-muted-foreground">{label}</div>
    </div>
  )
}

function LevelRing({ progress, level }: { progress: number; level: number }) {
  const size = 120
  const stroke = 9
  const r = (size - stroke) / 2
  const c = 2 * Math.PI * r
  const offset = c * (1 - progress)
  return (
    <div className="relative" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90">
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" strokeWidth={stroke} className="stroke-muted" />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={c}
          strokeDashoffset={offset}
          className="stroke-amber-500 transition-[stroke-dashoffset] duration-700"
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="text-3xl font-bold tabular-nums">{level}</span>
        <span className="text-[10px] uppercase tracking-wide text-muted-foreground">Level</span>
      </div>
    </div>
  )
}
