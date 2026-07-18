'use client'

// The jump-forward gate, played out. Opens on a locked node, mints a probe from
// /api/path/gate, and grades server-side. Pass → the node's prerequisites are
// credited and the map recomputes. Fail → a sized gap map, never a wall.

import { useCallback, useEffect, useState } from 'react'
import { X, Loader2, CheckCircle2, Circle, PartyPopper, Map as MapIcon, RotateCcw } from 'lucide-react'
import { cn } from '@/lib/utils'

interface Probe {
  nodeId: string
  nodeTitle: string
  token: string
  questions: { question: string; options: string[] }[]
}

interface SubmitResult {
  passed: boolean
  score: number
  bankedNodeIds?: string[]
  gap?: { nodeId: string; title: string; minutes: number }[]
  gapWeeks?: number
}

type Phase = 'loading' | 'error' | 'quiz' | 'result'

export function GateDialog({
  nodeId, nodeTitle, onClose, onPassed,
}: {
  nodeId: string
  nodeTitle: string
  onClose: () => void
  onPassed: () => void
}) {
  const [phase, setPhase] = useState<Phase>('loading')
  const [probe, setProbe] = useState<Probe | null>(null)
  const [answers, setAnswers] = useState<number[]>([])
  const [submitting, setSubmitting] = useState(false)
  const [result, setResult] = useState<SubmitResult | null>(null)
  const [errorMsg, setErrorMsg] = useState('')

  // No synchronous setState here — the first state write happens only after the
  // await, so mounting the effect doesn't trigger a cascading render. Resetting to
  // the 'loading' phase (on retry) is the caller's job.
  const load = useCallback(async () => {
    try {
      const res = await fetch('/api/path/gate', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ action: 'start', nodeId }),
      })
      if (!res.ok) {
        const body = await res.json().catch(() => ({}))
        setErrorMsg(body?.error === 'GENERATION_FAILED' ? 'Could not build a check right now — try again in a moment.' : 'Something went wrong starting the check.')
        setPhase('error')
        return
      }
      const p = (await res.json()) as Probe
      setProbe(p)
      setAnswers(new Array(p.questions.length).fill(-1))
      setPhase('quiz')
    } catch {
      setErrorMsg('Network error — check your connection.')
      setPhase('error')
    }
  }, [nodeId])

  const retry = useCallback(() => { setPhase('loading'); void load() }, [load])

  useEffect(() => {
    // Fetch-on-mount: the setStates land after the await, but the linter can't see
    // that through the callback — same accepted pattern as leaderboard-sheet.
    /* eslint-disable-next-line react-hooks/set-state-in-effect */
    void load()
  }, [load])

  async function submit() {
    if (!probe) return
    setSubmitting(true)
    try {
      const res = await fetch('/api/path/gate', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ action: 'submit', nodeId, token: probe.token, answers }),
      })
      if (!res.ok) {
        setErrorMsg('Could not grade that — try again.')
        setPhase('error')
        return
      }
      const r = (await res.json()) as SubmitResult
      setResult(r)
      setPhase('result')
      if (r.passed) onPassed()
    } catch {
      setErrorMsg('Network error while grading.')
      setPhase('error')
    } finally {
      setSubmitting(false)
    }
  }

  const allAnswered = answers.length > 0 && answers.every((a) => a >= 0)

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/50 p-0 sm:items-center sm:p-4" onClick={onClose}>
      <div
        className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-t-2xl border bg-background p-5 shadow-xl sm:rounded-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-4 flex items-start justify-between gap-3">
          <div>
            <p className="text-xs font-semibold uppercase tracking-widest text-amber-600 dark:text-amber-400">Prove it — skip ahead</p>
            <h3 className="mt-0.5 text-lg font-black">{nodeTitle}</h3>
          </div>
          <button onClick={onClose} className="rounded-lg p-1 text-muted-foreground transition hover:bg-muted"><X className="h-5 w-5" /></button>
        </div>

        {phase === 'loading' && (
          <div className="flex flex-col items-center gap-3 py-10 text-muted-foreground">
            <Loader2 className="h-6 w-6 animate-spin" />
            <p className="text-sm">Building a quick check on the prerequisites…</p>
          </div>
        )}

        {phase === 'error' && (
          <div className="py-8 text-center">
            <p className="text-sm text-muted-foreground">{errorMsg}</p>
            <button onClick={retry} className="mt-4 inline-flex items-center gap-1.5 rounded-lg border px-3 py-2 text-sm font-semibold transition hover:bg-muted">
              <RotateCcw className="h-4 w-4" /> Try again
            </button>
          </div>
        )}

        {phase === 'quiz' && probe && (
          <div className="space-y-5">
            <p className="text-sm text-muted-foreground">Answer these to prove you already know what comes before <span className="font-semibold text-foreground">{nodeTitle}</span>. Pass and it unlocks — no grinding back.</p>
            {probe.questions.map((q, qi) => (
              <div key={qi}>
                <p className="mb-2 text-sm font-semibold">{qi + 1}. {q.question}</p>
                <div className="space-y-1.5">
                  {q.options.map((opt, oi) => (
                    <button
                      key={oi}
                      onClick={() => setAnswers((a) => a.map((v, i) => (i === qi ? oi : v)))}
                      className={cn(
                        'flex w-full items-center gap-2 rounded-lg border px-3 py-2 text-left text-sm transition hover:border-amber-400',
                        answers[qi] === oi && 'border-amber-500 bg-amber-500/10',
                      )}
                    >
                      {answers[qi] === oi ? <CheckCircle2 className="h-4 w-4 shrink-0 text-amber-500" /> : <Circle className="h-4 w-4 shrink-0 text-muted-foreground" />}
                      <span>{opt}</span>
                    </button>
                  ))}
                </div>
              </div>
            ))}
            <button
              onClick={submit}
              disabled={!allAnswered || submitting}
              className="flex w-full items-center justify-center gap-2 rounded-xl bg-linear-to-r from-amber-500 to-orange-500 px-4 py-3 font-bold text-white transition hover:opacity-95 disabled:opacity-50"
            >
              {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Submit'}
            </button>
          </div>
        )}

        {phase === 'result' && result && (
          result.passed ? (
            <div className="py-6 text-center">
              <PartyPopper className="mx-auto h-10 w-10 text-emerald-500" />
              <h4 className="mt-3 text-lg font-black">Unlocked — you knew it.</h4>
              <p className="mt-1 text-sm text-muted-foreground">
                Scored {result.score}/100. Credited {result.bankedNodeIds?.length ?? 0} node{(result.bankedNodeIds?.length ?? 0) === 1 ? '' : 's'} behind this one — the route just got shorter.
              </p>
              <button onClick={onClose} className="mt-5 rounded-xl bg-linear-to-r from-amber-500 to-orange-500 px-5 py-2.5 font-bold text-white transition hover:opacity-95">
                See the new route
              </button>
            </div>
          ) : (
            <div className="py-2">
              <div className="text-center">
                <MapIcon className="mx-auto h-9 w-9 text-amber-500" />
                <h4 className="mt-2 text-lg font-black">Not yet — here&apos;s the gap.</h4>
                <p className="mt-1 text-sm text-muted-foreground">
                  Scored {result.score}/100. About {result.gapWeeks} week{result.gapWeeks === 1 ? '' : 's'} of ground between you and {nodeTitle}:
                </p>
              </div>
              <ul className="mt-4 space-y-1.5">
                {(result.gap ?? []).map((g) => (
                  <li key={g.nodeId} className="flex items-center justify-between rounded-lg border px-3 py-2 text-sm">
                    <span className="font-medium">{g.title}</span>
                    <span className="text-xs text-muted-foreground">~{g.minutes}m</span>
                  </li>
                ))}
              </ul>
              <button onClick={onClose} className="mt-5 flex w-full items-center justify-center gap-1.5 rounded-xl border px-4 py-2.5 font-semibold transition hover:bg-muted">
                Route me through them
              </button>
            </div>
          )
        )}
      </div>
    </div>
  )
}
