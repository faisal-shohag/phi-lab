'use client'

import { useState } from 'react'
import { Sparkles, RefreshCw, Languages } from 'lucide-react'
import { nodeById } from '@/lib/path/curriculum'
import type { WeeklyReport } from '@/lib/path/types'
import { cn } from '@/lib/utils'

export function WeeklyCard({ report, onRefresh }: { report: WeeklyReport | null; onRefresh: () => void }) {
  const [bn, setBn] = useState(false)
  const [loading, setLoading] = useState(false)

  const regenerate = async () => {
    setLoading(true)
    try {
      await fetch('/api/path/weekly', { method: 'POST' })
      await onRefresh()
    } finally {
      setLoading(false)
    }
  }

  if (!report) {
    return (
      <div className="rounded-2xl border bg-card p-5">
        <div className="flex items-center gap-2 text-sm font-bold">
          <Sparkles className="h-4 w-4 text-violet-500" /> Your Week
        </div>
        <p className="mt-3 text-sm text-muted-foreground">
          Your AI coach writes a weekly report once you&apos;ve done some work. Come back after a session or two.
        </p>
        <button
          onClick={regenerate}
          disabled={loading}
          className="mt-3 rounded-lg border px-2.5 py-1.5 text-xs font-semibold transition hover:bg-muted disabled:opacity-50"
        >
          {loading ? 'Writing…' : 'Generate now'}
        </button>
      </div>
    )
  }

  return (
    <div className="rounded-2xl border bg-linear-to-br from-violet-500/10 via-card to-fuchsia-500/5 p-5">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2 text-sm font-bold">
          <Sparkles className="h-4 w-4 text-violet-500" /> Your Week
        </div>
        <div className="flex items-center gap-1">
          <button
            onClick={() => setBn((b) => !b)}
            className={cn('rounded-lg border px-2 py-1 text-xs font-semibold transition hover:bg-muted', bn && 'bg-muted')}
            title="Toggle Bangla / English"
          >
            <Languages className="h-3.5 w-3.5" />
          </button>
          <button
            onClick={regenerate}
            disabled={loading}
            className="rounded-lg border px-2 py-1 text-xs font-semibold transition hover:bg-muted disabled:opacity-50"
            title="Refresh report"
          >
            <RefreshCw className={cn('h-3.5 w-3.5', loading && 'animate-spin')} />
          </button>
        </div>
      </div>

      <p className="mt-2 text-base font-bold leading-snug">{report.headline}</p>
      <p
        className="mt-1 text-sm text-muted-foreground"
        style={bn ? { fontFamily: 'var(--font-bengali)' } : undefined}
      >
        {bn ? report.summaryBn : report.summaryEn}
      </p>

      {report.focus.length > 0 && (
        <div className="mt-3">
          <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">This week, focus on</p>
          <ul className="mt-1 space-y-0.5 text-sm">
            {report.focus.map((f) => (
              <li key={f.nodeId} className="flex gap-1.5">
                <span className="font-semibold">{nodeById(f.nodeId)?.title ?? f.nodeId}:</span>
                <span className="text-muted-foreground">{f.why}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      <p
        className="mt-3 border-t pt-2 text-sm font-medium italic text-violet-700 dark:text-violet-300"
        style={bn ? { fontFamily: 'var(--font-bengali)' } : undefined}
      >
        {bn ? report.encouragementBn : report.encouragementEn}
      </p>
    </div>
  )
}
