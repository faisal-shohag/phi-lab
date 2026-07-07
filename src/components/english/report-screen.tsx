'use client'

import { motion } from 'framer-motion'
import { Sparkles, ThumbsUp, TrendingUp, SpellCheck, BookOpen, MessageSquare, RotateCcw, Repeat } from 'lucide-react'
import type { EnglishReport } from '@/lib/english/report-types'
import { scenarioById } from '@/lib/english/scenarios'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'

interface ReportScreenProps {
  report: EnglishReport
  scenario: string | null
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
        <span className="text-[11px] text-muted-foreground">/ 100</span>
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

export function ReportScreen({ report, scenario, onNew, onRetry }: ReportScreenProps) {
  const scenarioLabel = scenarioById(scenario ?? '')?.label ?? scenario ?? ''

  return (
    <div className="font-bn mx-auto w-full max-w-3xl px-4 py-8">
      <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="text-center">
        <div className="mb-3 inline-flex items-center gap-1.5 rounded-full bg-muted px-3 py-1 text-xs font-medium text-muted-foreground">
          <Sparkles className="h-3.5 w-3.5" /> English practice · {scenarioLabel}
        </div>
        <h1 className="text-2xl font-bold sm:text-3xl">Your English report</h1>
      </motion.div>

      {/* Overall */}
      <div className="mt-6 flex flex-col items-center gap-4 rounded-2xl border-2 border-border bg-card p-6 shadow-sm sm:flex-row sm:gap-8">
        <OverallRing score={report.overallScore} />
        <div className="flex-1 text-center sm:text-left">
          <div className="text-xs uppercase tracking-wide text-muted-foreground">Verdict</div>
          <div className="text-xl font-bold">{report.verdict}</div>
          <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{report.summary}</p>
        </div>
      </div>

      {/* Sub-scores */}
      <div className="mt-4 grid grid-cols-1 gap-4 rounded-2xl border-2 border-border bg-card p-5 shadow-sm sm:grid-cols-3">
        <SubScore label="Fluency" value={report.scores.fluency} />
        <SubScore label="Clarity" value={report.scores.clarity} />
        <SubScore label="Confidence" value={report.scores.confidence} />
      </div>

      {/* Strengths / improvements */}
      {(report.strengths.length > 0 || report.improvements.length > 0) && (
        <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div className="rounded-2xl border-2 border-emerald-200 bg-emerald-50/60 p-4 dark:border-emerald-900 dark:bg-emerald-950/30">
            <h3 className="mb-2 flex items-center gap-1.5 text-sm font-semibold text-emerald-700 dark:text-emerald-300">
              <ThumbsUp className="h-4 w-4" /> Strengths
            </h3>
            <ul className="space-y-1.5 text-sm">
              {report.strengths.map((s, i) => (
                <li key={i} className="flex gap-2"><span className="text-emerald-500">✓</span><span>{s}</span></li>
              ))}
              {report.strengths.length === 0 && <li className="text-muted-foreground">—</li>}
            </ul>
          </div>
          <div className="rounded-2xl border-2 border-amber-200 bg-amber-50/60 p-4 dark:border-amber-900 dark:bg-amber-950/30">
            <h3 className="mb-2 flex items-center gap-1.5 text-sm font-semibold text-amber-700 dark:text-amber-300">
              <TrendingUp className="h-4 w-4" /> To improve
            </h3>
            <ul className="space-y-1.5 text-sm">
              {report.improvements.map((s, i) => (
                <li key={i} className="flex gap-2"><span className="text-amber-500">→</span><span>{s}</span></li>
              ))}
              {report.improvements.length === 0 && <li className="text-muted-foreground">—</li>}
            </ul>
          </div>
        </div>
      )}

      {/* Grammar fixes — said → better */}
      {report.grammarFixes.length > 0 && (
        <div className="mt-4 rounded-2xl border-2 border-border bg-card p-5 shadow-sm">
          <h3 className="mb-3 flex items-center gap-1.5 text-sm font-semibold">
            <SpellCheck className="h-4 w-4 text-sky-500" /> Say it better
          </h3>
          <div className="space-y-2.5">
            {report.grammarFixes.map((f, i) => (
              <div key={i} className="rounded-xl border border-border bg-muted/30 p-3">
                <p className="text-sm text-rose-600 line-through decoration-rose-300 dark:text-rose-300">{f.said}</p>
                <p className="mt-1 text-sm font-medium text-emerald-700 dark:text-emerald-300">{f.better}</p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Vocab boost */}
      {report.vocabBoost.length > 0 && (
        <div className="mt-4 rounded-2xl border-2 border-violet-200 bg-violet-50/60 p-4 dark:border-violet-900 dark:bg-violet-950/30">
          <h3 className="mb-2 flex items-center gap-1.5 text-sm font-semibold text-violet-700 dark:text-violet-300">
            <BookOpen className="h-4 w-4" /> Vocabulary to level up
          </h3>
          <div className="flex flex-wrap gap-1.5">
            {report.vocabBoost.map((v, i) => (
              <span key={i} className="rounded-full border border-violet-200 bg-white/60 px-2.5 py-1 text-xs font-medium text-violet-800 dark:border-violet-800 dark:bg-violet-950/40 dark:text-violet-200">{v}</span>
            ))}
          </div>
        </div>
      )}

      {/* Filler note */}
      {report.fillerNote && report.fillerNote !== '—' && (
        <div className="mt-4 rounded-2xl border-2 border-border bg-card p-4 shadow-sm">
          <h3 className="mb-1 flex items-center gap-1.5 text-sm font-semibold">
            <MessageSquare className="h-4 w-4 text-muted-foreground" /> On filler words
          </h3>
          <p className="text-sm text-muted-foreground">{report.fillerNote}</p>
        </div>
      )}

      {/* Actions */}
      {(onNew || onRetry) && (
        <div className="mt-8 flex flex-col justify-center gap-3 sm:flex-row">
          {onNew && (
            <Button size="lg" variant="outline" onClick={onNew}>
              <RotateCcw className="mr-1.5" /> New scenario
            </Button>
          )}
          {onRetry && (
            <Button size="lg" onClick={onRetry}>
              <Repeat className="mr-1.5" /> Practise this again
            </Button>
          )}
        </div>
      )}
    </div>
  )
}
