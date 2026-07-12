'use client'

import { useState } from 'react'
import Link from 'next/link'
import {
  GitFork, Repeat, Brackets, FunctionSquare, Swords, GitBranch, ArrowDownWideNarrow,
  TrendingUp, Braces, Lasso, Link2, Boxes, Timer, Hourglass, FileCode2, Palette,
  Atom, PanelsTopLeft, Server, Database, KeyRound, Users, Crown,
  Lock, CheckCircle2, Circle, ChevronDown, Eye, Hammer, Mic, MessageSquare, Puzzle, AlertTriangle,
  type LucideIcon,
} from 'lucide-react'
import type { PathNode, PathStep } from '@/lib/path/curriculum'
import type { NodeProgress, StepProgress } from '@/lib/path/types'
import { cn } from '@/lib/utils'

const ICONS: Record<string, LucideIcon> = {
  GitFork, Repeat, Brackets, FunctionSquare, Swords, GitBranch, ArrowDownWideNarrow,
  TrendingUp, Braces, Lasso, Link2, Boxes, Timer, Hourglass, FileCode2, Palette,
  Atom, PanelsTopLeft, Server, Database, KeyRound, Users, Crown,
}

const STEP_ICON: Record<PathStep['kind'], LucideIcon> = {
  viz: Eye,
  challenge: Hammer,
  feynman: Mic,
  english: MessageSquare,
  interview: Mic,
  analogy: Puzzle,
}

export function NodeCard({ node, progress, active }: { node: PathNode; progress: NodeProgress; active: boolean }) {
  const [open, setOpen] = useState(active && progress.state !== 'mastered')
  const Icon = ICONS[node.icon] ?? Circle
  const locked = progress.state === 'locked'
  const mastered = progress.state === 'mastered'

  return (
    <div
      className={cn(
        'rounded-xl border bg-card transition',
        active && !mastered && 'ring-2 ring-amber-400/60',
        node.boss && 'border-rose-400/40',
      )}
    >
      <button
        onClick={() => !locked && setOpen((o) => !o)}
        disabled={locked}
        className="flex w-full items-center gap-3 p-3 text-left disabled:cursor-not-allowed"
      >
        <div
          className={cn(
            'grid h-9 w-9 shrink-0 place-items-center rounded-lg',
            mastered ? 'bg-emerald-500/15 text-emerald-500'
              : locked ? 'bg-muted text-muted-foreground'
                : node.boss ? 'bg-rose-500/15 text-rose-500'
                  : 'bg-amber-500/15 text-amber-500',
          )}
        >
          {locked ? <Lock className="h-4 w-4" /> : mastered ? <CheckCircle2 className="h-5 w-5" /> : <Icon className="h-5 w-5" />}
        </div>

        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <p className="truncate text-sm font-bold">{node.title}</p>
            {node.boss && <span className="rounded bg-rose-500/15 px-1.5 py-0.5 text-[10px] font-bold uppercase text-rose-500">Boss</span>}
            {progress.struggling && !mastered && (
              <span title="You're close — a couple of attempts fell just short">
                <AlertTriangle className="h-3.5 w-3.5 text-amber-500" />
              </span>
            )}
          </div>
          <p className="truncate text-xs text-muted-foreground">{node.blurb}</p>
        </div>

        <div className="flex shrink-0 items-center gap-2">
          {!locked && !mastered && (
            <span className="text-xs font-mono text-muted-foreground">
              {progress.doneCount}/{progress.requiredCount}
            </span>
          )}
          {mastered
            ? <span className="text-xs font-bold text-emerald-500">+{node.xp} XP</span>
            : !locked && <ChevronDown className={cn('h-4 w-4 text-muted-foreground transition', open && 'rotate-180')} />}
        </div>
      </button>

      {open && !locked && (
        <div className="space-y-1 border-t px-3 py-2">
          {node.steps.map((step) => {
            const sp = progress.steps.find((s) => s.id === step.id)
            return <StepRow key={step.id} step={step} progress={sp} disabled={mastered} />
          })}
        </div>
      )}
    </div>
  )
}

function StepRow({ step, progress, disabled }: { step: PathStep; progress?: StepProgress; disabled: boolean }) {
  const SIcon = STEP_ICON[step.kind]
  const done = progress?.done ?? false
  const nearMiss = !done && (progress?.attempts ?? 0) > 0

  const body = (
    <div className={cn('flex items-center gap-2 rounded-lg px-2 py-1.5 text-sm', !disabled && 'transition hover:bg-muted')}>
      {done
        ? <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-500" />
        : <SIcon className={cn('h-4 w-4 shrink-0', nearMiss ? 'text-amber-500' : 'text-muted-foreground')} />}
      <div className="min-w-0 flex-1">
        <span className={cn(done && 'text-muted-foreground line-through')}>{step.label}</span>
        {step.optional && <span className="ml-1 text-[10px] uppercase text-muted-foreground">optional</span>}
        {progress?.evidence && <p className="text-[11px] text-emerald-600 dark:text-emerald-400">{progress.evidence}</p>}
        {nearMiss && progress?.bestScore != null && (
          <p className="text-[11px] text-amber-600 dark:text-amber-400">
            Best {progress.bestScore}/100 · needs {step.minScore} — so close
          </p>
        )}
      </div>
      {!done && !disabled && <span className="text-xs text-muted-foreground">{step.minutes}m</span>}
    </div>
  )

  if (done || disabled) return body
  return <Link href={step.href}>{body}</Link>
}
