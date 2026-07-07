'use client'

import { motion } from 'framer-motion'
import { Sparkles, ThumbsUp, TrendingUp, MessageSquareQuote, AlertTriangle, RotateCcw, Repeat, Lightbulb } from 'lucide-react'
import type { FeynmanReport } from '@/lib/feynman/report-types'
import { conceptById } from '@/lib/feynman/concepts'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'

interface ReportScreenProps {
  report: FeynmanReport
  concept: string | null
  onNew?: () => void
  onRetry?: () => void
}

function scoreColor(v: number, max: number): string {
  const pct = v / max
  if (pct >= 0.75) return 'text-emerald-500'
  if (pct >= 0.5) return 'text-amber-500'
  return 'text-rose-500'
}

function barColor(v: number, max: number): string {
  const pct = v / max
  if (pct >= 0.75) return 'bg-emerald-500'
  if (pct >= 0.5) return 'bg-amber-500'
  return 'bg-rose-500'
}

function OverallRing({ score }: { score: number }) {
  const size = 148
  const stroke = 10
  const r = (size - stroke) / 2
  const c = 2 * Math.PI * r
  const offset = c * (1 - Math.max(0, Math.min(100, score)) / 100)
  return (
    <div className="relative" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90">
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" strokeWidth={stroke} className="stroke-muted" />
        <motion.circle
          cx={size / 2} cy={size / 2} r={r} fill="none" strokeWidth={stroke} strokeLinecap="round"
          strokeDasharray={c}
          initial={{ strokeDashoffset: c }}
          animate={{ strokeDashoffset: offset }}
          transition={{ duration: 1, ease: 'easeOut' }}
          className={cn(barColor(score, 100).replace('bg-', 'stroke-'))}
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className={cn('text-3xl font-bold tabular-nums', scoreColor(score, 100))}>{score}</span>
        <span className="text-[11px] text-muted-foreground">clarity</span>
      </div>
    </div>
  )
}

function SubScore({ label, value }: { label: string; value: number }) {
  return (
    <div>
      <div className="mb-1 flex items-center justify-between text-sm">
        <span className="font-medium">{label}</span>
        <span className={cn('font-mono font-semibold', scoreColor(value, 10))}>{value}/10</span>
      </div>
      <div className="h-2 overflow-hidden rounded-full bg-muted">
        <motion.div
          className={cn('h-full rounded-full', barColor(value, 10))}
          initial={{ width: 0 }}
          animate={{ width: `${(value / 10) * 100}%` }}
          transition={{ duration: 0.7, ease: 'easeOut' }}
        />
      </div>
    </div>
  )
}

function Chips({ title, items, tone }: { title: string; items: string[]; tone: 'amber' | 'rose' }) {
  if (items.length === 0) return null
  const toneCls = tone === 'amber'
    ? 'border-amber-200 bg-amber-50/60 text-amber-800 dark:border-amber-900 dark:bg-amber-950/30 dark:text-amber-200'
    : 'border-rose-200 bg-rose-50/60 text-rose-800 dark:border-rose-900 dark:bg-rose-950/30 dark:text-rose-200'
  return (
    <div className="rounded-2xl border-2 border-border bg-card p-4 shadow-sm">
      <h3 className="mb-2 text-sm font-semibold">{title}</h3>
      <div className="flex flex-wrap gap-1.5">
        {items.map((s, i) => (
          <span key={i} className={cn('rounded-full border px-2.5 py-1 text-xs font-medium', toneCls)}>{s}</span>
        ))}
      </div>
    </div>
  )
}

export function ReportScreen({ report, concept, onNew, onRetry }: ReportScreenProps) {
  const conceptLabel = conceptById(concept ?? '')?.label ?? concept ?? ''

  return (
    <div className="font-bn mx-auto w-full max-w-3xl px-4 py-8">
      <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="text-center">
        <div className="mb-3 inline-flex items-center gap-1.5 rounded-full bg-muted px-3 py-1 text-xs font-medium text-muted-foreground">
          <Sparkles className="h-3.5 w-3.5" /> Teach-back · {conceptLabel}
        </div>
        <h1 className="text-2xl font-bold sm:text-3xl">Teach-back report</h1>
      </motion.div>

      {/* Overall */}
      <div className="mt-6 flex flex-col items-center gap-4 rounded-2xl border-2 border-border bg-card p-6 shadow-sm sm:flex-row sm:gap-8">
        <OverallRing score={report.clarityScore} />
        <div className="flex-1 text-center sm:text-left">
          <div className="text-xs uppercase tracking-wide text-muted-foreground">Verdict</div>
          <div className="text-xl font-bold">{report.verdict}</div>
          <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{report.summary}</p>
        </div>
      </div>

      {/* Sub-scores */}
      <div className="mt-4 grid grid-cols-1 gap-4 rounded-2xl border-2 border-border bg-card p-5 shadow-sm sm:grid-cols-3">
        <SubScore label="Clarity" value={report.scores.clarity} />
        <SubScore label="Completeness" value={report.scores.completeness} />
        <SubScore label="Correctness" value={report.scores.correctness} />
      </div>

      {/* Mirror test — what the student learned */}
      <div className="mt-4 rounded-2xl border-2 border-indigo-200 bg-indigo-50/60 p-4 dark:border-indigo-900 dark:bg-indigo-950/30">
        <h3 className="mb-1 flex items-center gap-1.5 text-sm font-semibold text-indigo-700 dark:text-indigo-300">
          <MessageSquareQuote className="h-4 w-4" /> What your student took away
        </h3>
        <p className="text-sm italic leading-relaxed text-indigo-900/90 dark:text-indigo-100/90">
          &ldquo;{report.juniorLearned}&rdquo;
        </p>
      </div>

      {/* Nailed / revisit */}
      {(report.nailed.length > 0 || report.revisit.length > 0) && (
        <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div className="rounded-2xl border-2 border-emerald-200 bg-emerald-50/60 p-4 dark:border-emerald-900 dark:bg-emerald-950/30">
            <h3 className="mb-2 flex items-center gap-1.5 text-sm font-semibold text-emerald-700 dark:text-emerald-300">
              <ThumbsUp className="h-4 w-4" /> You explained well
            </h3>
            <ul className="space-y-1.5 text-sm">
              {report.nailed.map((s, i) => (
                <li key={i} className="flex gap-2"><span className="text-emerald-500">✓</span><span>{s}</span></li>
              ))}
              {report.nailed.length === 0 && <li className="text-muted-foreground">—</li>}
            </ul>
          </div>
          <div className="rounded-2xl border-2 border-amber-200 bg-amber-50/60 p-4 dark:border-amber-900 dark:bg-amber-950/30">
            <h3 className="mb-2 flex items-center gap-1.5 text-sm font-semibold text-amber-700 dark:text-amber-300">
              <TrendingUp className="h-4 w-4" /> To revisit
            </h3>
            <ul className="space-y-1.5 text-sm">
              {report.revisit.map((s, i) => (
                <li key={i} className="flex gap-2"><span className="text-amber-500">→</span><span>{s}</span></li>
              ))}
              {report.revisit.length === 0 && <li className="text-muted-foreground">—</li>}
            </ul>
          </div>
        </div>
      )}

      {/* Jargon / gaps / misconceptions */}
      <div className="mt-4 space-y-4">
        <Chips title="Jargon you didn't explain" items={report.jargon} tone="amber" />
        <Chips title="Parts you skipped" items={report.gaps} tone="amber" />
        {report.misconceptions.length > 0 && (
          <div className="rounded-2xl border-2 border-rose-200 bg-rose-50/60 p-4 dark:border-rose-900 dark:bg-rose-950/30">
            <h3 className="mb-2 flex items-center gap-1.5 text-sm font-semibold text-rose-700 dark:text-rose-300">
              <AlertTriangle className="h-4 w-4" /> Things to correct
            </h3>
            <ul className="space-y-1.5 text-sm">
              {report.misconceptions.map((s, i) => (
                <li key={i} className="flex gap-2"><span className="text-rose-500">!</span><span>{s}</span></li>
              ))}
            </ul>
          </div>
        )}
      </div>

      {/* Analogy note */}
      {report.analogyQuality && report.analogyQuality !== '—' && (
        <div className="mt-4 rounded-2xl border-2 border-violet-200 bg-violet-50/60 p-4 dark:border-violet-900 dark:bg-violet-950/30">
          <h3 className="mb-1 flex items-center gap-1.5 text-sm font-semibold text-violet-700 dark:text-violet-300">
            <Lightbulb className="h-4 w-4" /> On your analogies
          </h3>
          <p className="text-sm text-muted-foreground">{report.analogyQuality}</p>
        </div>
      )}

      {/* Actions */}
      {(onNew || onRetry) && (
        <div className="mt-8 flex flex-col justify-center gap-3 sm:flex-row">
          {onNew && (
            <Button size="lg" variant="outline" onClick={onNew}>
              <RotateCcw className="mr-1.5" /> Teach something else
            </Button>
          )}
          {onRetry && (
            <Button size="lg" onClick={onRetry}>
              <Repeat className="mr-1.5" /> Teach this again
            </Button>
          )}
        </div>
      )}
    </div>
  )
}
