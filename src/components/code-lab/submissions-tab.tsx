'use client'

import { useEffect, useState } from 'react'
import { CheckCircle2, XCircle, Loader2, ArrowLeft, ChevronRight, AlertTriangle, TimerOff } from 'lucide-react'
import { cn } from '@/lib/utils'
import { stableSerialize } from '@/lib/code-lab/serialize'
import type { SubmissionDetail, SubmissionListItem } from '@/lib/code-lab/queries'
import type { CaseResult, ProblemType, VisibleCase } from '@/lib/code-lab/types'

const VERDICT_LABEL: Record<string, string> = {
  ACCEPTED: 'Accepted',
  WRONG_ANSWER: 'Wrong Answer',
  RUNTIME_ERROR: 'Runtime Error',
  TIME_LIMIT: 'Time Limit Exceeded',
  COMPILE_ERROR: 'Compile Error',
}

// `reloadKey` bumps after a submit so the list refetches without a full remount.
export function SubmissionsTab({
  problemId,
  reloadKey,
  type,
  paramNames,
  sampleCases,
}: {
  problemId: string
  reloadKey: number
  type: ProblemType
  paramNames: string[]
  sampleCases: VisibleCase[]
}) {
  const key = `${problemId}:${reloadKey}`
  const [loaded, setLoaded] = useState<{ key: string; items: SubmissionListItem[] } | null>(null)
  const [openId, setOpenId] = useState<string | null>(null)
  // A new submit (reloadKey bump) invalidates any open detail — adjust during
  // render rather than in an effect.
  const [prevReload, setPrevReload] = useState(reloadKey)
  if (prevReload !== reloadKey) {
    setPrevReload(reloadKey)
    setOpenId(null)
  }

  useEffect(() => {
    let alive = true
    fetch(`/api/code-lab/submissions?problemId=${problemId}`)
      .then((r) => (r.ok ? r.json() : []))
      .then((data) => alive && setLoaded({ key, items: data as SubmissionListItem[] }))
      .catch(() => alive && setLoaded({ key, items: [] }))
    return () => {
      alive = false
    }
  }, [key, problemId])

  const items = loaded?.key === key ? loaded.items : null

  if (openId) {
    return (
      <SubmissionDetailView
        id={openId}
        type={type}
        paramNames={paramNames}
        sampleCases={sampleCases}
        onBack={() => setOpenId(null)}
      />
    )
  }

  if (items === null)
    return (
      <div className="flex items-center gap-2 p-6 text-sm text-muted-foreground">
        <Loader2 className="h-4 w-4 animate-spin" /> Loading submissions…
      </div>
    )
  if (items.length === 0)
    return <p className="p-6 text-sm text-muted-foreground">No submissions yet. Solve it to see your history here.</p>

  return (
    <ul className="divide-y">
      {items.map((s) => {
        const ok = s.verdict === 'ACCEPTED'
        return (
          <li key={s.id}>
            <button onClick={() => setOpenId(s.id)} className="flex w-full items-center gap-3 px-4 py-3 text-left text-sm hover:bg-muted/50">
              {ok ? <CheckCircle2 className="h-4 w-4 text-emerald-500" /> : <XCircle className="h-4 w-4 text-destructive" />}
              <span className={cn('font-medium', ok ? 'text-emerald-600 dark:text-emerald-400' : 'text-destructive')}>
                {VERDICT_LABEL[s.verdict] ?? s.verdict}
              </span>
              <span className="text-xs text-muted-foreground">{s.language === 'TYPESCRIPT' ? 'TypeScript' : 'JavaScript'}</span>
              <span className="ml-auto text-xs tabular-nums text-muted-foreground">
                {s.passedCount}/{s.totalCount} · {timeAgo(s.createdAt)}
              </span>
              <ChevronRight className="h-4 w-4 text-muted-foreground" />
            </button>
          </li>
        )
      })}
    </ul>
  )
}

function SubmissionDetailView({
  id,
  type,
  paramNames,
  sampleCases,
  onBack,
}: {
  id: string
  type: ProblemType
  paramNames: string[]
  sampleCases: VisibleCase[]
  onBack: () => void
}) {
  const [detail, setDetail] = useState<SubmissionDetail | null>(null)
  const [notFound, setNotFound] = useState(false)

  useEffect(() => {
    let alive = true
    fetch(`/api/code-lab/submissions/${id}`)
      .then((r) => (r.ok ? r.json() : Promise.reject()))
      .then((d) => alive && setDetail(d as SubmissionDetail))
      .catch(() => alive && setNotFound(true))
    return () => {
      alive = false
    }
  }, [id])

  if (notFound) return <div className="p-6 text-sm text-muted-foreground">Submission not found.</div>
  if (!detail)
    return (
      <div className="flex items-center gap-2 p-6 text-sm text-muted-foreground">
        <Loader2 className="h-4 w-4 animate-spin" /> Loading…
      </div>
    )

  const ok = detail.verdict === 'ACCEPTED'

  return (
    <div className="space-y-4 p-4">
      <div className="flex items-center gap-2">
        <button onClick={onBack} className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground">
          <ArrowLeft className="h-3.5 w-3.5" /> All submissions
        </button>
      </div>

      <div className={cn('flex items-center gap-2 rounded-md border px-3 py-2 text-sm font-semibold', ok ? 'border-emerald-500/30 text-emerald-600 dark:text-emerald-400' : 'border-destructive/30 text-destructive')}>
        {ok ? <CheckCircle2 className="h-4 w-4" /> : <XCircle className="h-4 w-4" />}
        {VERDICT_LABEL[detail.verdict] ?? detail.verdict}
        <span className="ml-auto text-xs font-normal tabular-nums text-muted-foreground">
          {detail.passedCount}/{detail.totalCount} · {detail.language === 'TYPESCRIPT' ? 'TS' : 'JS'} · {timeAgo(detail.createdAt)}
        </span>
      </div>

      {detail.error && (
        <pre className="overflow-auto rounded-md border bg-muted/40 p-2 text-xs text-destructive whitespace-pre-wrap break-all">{detail.error}</pre>
      )}

      <div>
        <h3 className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Submitted code</h3>
        <pre className="overflow-auto rounded-md border bg-muted/40 p-3 font-mono text-xs">{detail.code}</pre>
      </div>

      {sampleCases.length > 0 && (
        <div>
          <h3 className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Your test results</h3>
          <div className="space-y-2">
            {sampleCases.map((c, i) => {
              const r = detail.results?.find((x) => x.id === c.id) ?? null
              const yourOutput = r ? (type === 'FUNCTION_RETURN' ? r.actual : r.stdout) : undefined
              return (
                <div key={c.id} className="rounded-md border p-2.5 text-xs">
                  <div className="mb-1 flex items-center gap-1.5 font-medium">
                    {r ? <StatusIcon status={r.status} /> : null}
                    <span>Case {i + 1}</span>
                  </div>
                  {(c.args ?? []).map((a, j) => (
                    <Row key={j} label={paramNames[j] ?? `arg${j}`} value={stableSerialize(a)} />
                  ))}
                  {r?.status === 'error' && r.error && <Row label="error" value={r.error} tone="error" />}
                  {yourOutput !== undefined && (
                    <Row label="your output" value={yourOutput} tone={r?.status === 'pass' ? undefined : 'error'} />
                  )}
                  <Row
                    label="expected"
                    value={type === 'FUNCTION_RETURN' ? stableSerialize(c.expected) : c.expectedStdout ?? ''}
                  />
                </div>
              )
            })}
          </div>
          {detail.results === null && (
            <p className="mt-2 text-[11px] text-muted-foreground">This submission predates per-case capture; only inputs and expected outputs are shown.</p>
          )}
        </div>
      )}
    </div>
  )
}

function StatusIcon({ status }: { status: CaseResult['status'] }) {
  if (status === 'pass') return <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500" />
  if (status === 'timeout') return <TimerOff className="h-3.5 w-3.5 text-amber-500" />
  if (status === 'error') return <AlertTriangle className="h-3.5 w-3.5 text-destructive" />
  return <XCircle className="h-3.5 w-3.5 text-destructive" />
}

function Row({ label, value, tone }: { label: string; value: string; tone?: 'error' }) {
  return (
    <div className="flex gap-2 py-0.5">
      <span className="shrink-0 text-muted-foreground">{label}:</span>
      <pre className={cn('overflow-auto whitespace-pre-wrap break-all font-mono', tone === 'error' && 'text-destructive')}>
        {value}
      </pre>
    </div>
  )
}

function timeAgo(at: Date | string): string {
  const d = typeof at === 'string' ? new Date(at) : at
  const s = Math.floor((Date.now() - d.getTime()) / 1000)
  if (s < 60) return 'just now'
  if (s < 3600) return `${Math.floor(s / 60)}m ago`
  if (s < 86400) return `${Math.floor(s / 3600)}h ago`
  return `${Math.floor(s / 86400)}d ago`
}
