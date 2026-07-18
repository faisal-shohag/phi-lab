'use client'

import { useState } from 'react'
import { CheckCircle2, XCircle, AlertTriangle, TimerOff, Loader2, SquareCheck } from 'lucide-react'
import { cn } from '@/lib/utils'
import { stableSerialize } from '@/lib/code-lab/serialize'
import type { CaseResult, ProblemType, SubmitResponse, VisibleCase } from '@/lib/code-lab/types'
import type { RunState } from '@/lib/code-lab/use-runner'

type Tab = 'testcase' | 'result'

export function TestResults({
  type,
  paramNames,
  sampleCases,
  run,
  submit,
  submitting,
  tab,
  onTabChange,
}: {
  type: ProblemType
  paramNames: string[]
  sampleCases: VisibleCase[]
  run: RunState
  submit: SubmitResponse | null
  submitting: boolean
  tab: Tab
  onTabChange: (t: Tab) => void
}) {
  const [activeCase, setActiveCase] = useState(0)

  return (
    <div className="flex h-full flex-col">
      <div className="flex items-center gap-4 border-b px-4 py-2 text-sm">
        <TabButton active={tab === 'testcase'} onClick={() => onTabChange('testcase')}>
          <SquareCheck className="h-4 w-4 text-emerald-500" /> Testcase
        </TabButton>
        <TabButton active={tab === 'result'} onClick={() => onTabChange('result')}>
          Test Result
        </TabButton>
      </div>

      {tab === 'testcase' ? (
        <div className="min-h-0 flex-1 overflow-auto p-4">
          {sampleCases.length === 0 ? (
            <p className="text-sm text-muted-foreground">No sample cases for this problem.</p>
          ) : (
            <>
              <div className="mb-3 flex flex-wrap gap-2">
                {sampleCases.map((_, i) => (
                  <button
                    key={i}
                    onClick={() => setActiveCase(i)}
                    className={cn(
                      'rounded-md px-2.5 py-1 text-xs font-medium transition-colors',
                      activeCase === i ? 'bg-muted text-foreground' : 'text-muted-foreground hover:bg-muted/50',
                    )}
                  >
                    Case {i + 1}
                  </button>
                ))}
              </div>
              <CaseInputs type={type} paramNames={paramNames} c={sampleCases[activeCase]} />
            </>
          )}
        </div>
      ) : (
        <div className="min-h-0 flex-1 overflow-auto p-4">
          <ResultBody type={type} run={run} submit={submit} submitting={submitting} sampleCases={sampleCases} />
        </div>
      )}
    </div>
  )
}

function CaseInputs({ type, paramNames, c }: { type: ProblemType; paramNames: string[]; c: VisibleCase }) {
  const args = c.args ?? []
  return (
    <div className="space-y-3">
      {args.map((a, i) => (
        <LabeledBox key={i} label={`${paramNames[i] ?? `arg${i}`} =`} value={stableSerialize(a)} />
      ))}
      {type === 'FUNCTION_RETURN' ? (
        <LabeledBox label="Expected =" value={stableSerialize(c.expected)} muted />
      ) : (
        <LabeledBox label="Expected stdout" value={c.expectedStdout ?? ''} muted />
      )}
    </div>
  )
}

function LabeledBox({ label, value, muted }: { label: string; value: string; muted?: boolean }) {
  return (
    <div className="space-y-1.5">
      <div className="text-xs font-medium text-muted-foreground">{label}</div>
      <pre
        className={cn(
          'overflow-auto rounded-lg border bg-muted/40 px-3 py-2 font-mono text-xs whitespace-pre-wrap break-all',
          muted && 'text-muted-foreground',
        )}
      >
        {value}
      </pre>
    </div>
  )
}

function ResultBody({
  type,
  run,
  submit,
  submitting,
  sampleCases,
}: {
  type: ProblemType
  run: RunState
  submit: SubmitResponse | null
  submitting: boolean
  sampleCases: VisibleCase[]
}) {
  if (submitting) return <Centered><Loader2 className="h-4 w-4 animate-spin" /> Grading on the server…</Centered>

  if (submit) {
    const ok = submit.verdict === 'ACCEPTED'
    return (
      <div className="space-y-3">
        <VerdictBanner verdict={submit.verdict} passed={submit.passedCount} total={submit.totalCount} />
        {submit.error && !ok && (
          <pre className="overflow-auto rounded-md border bg-muted/40 p-2 text-xs text-destructive">{submit.error}</pre>
        )}
        <p className="text-xs text-muted-foreground">
          {submit.visibleResults.length} sample · {submit.hidden.passed}/{submit.hidden.total} hidden tests passed
        </p>
        <CaseList type={type} results={submit.visibleResults} sampleCases={sampleCases} />
        {submit.xp?.awarded && (
          <p className="text-sm font-medium text-emerald-600 dark:text-emerald-400">+{submit.xp.xpGained} XP earned</p>
        )}
      </div>
    )
  }

  if (run.running) return <Centered><Loader2 className="h-4 w-4 animate-spin" /> Running…</Centered>
  if (run.compileError)
    return <pre className="overflow-auto rounded-md border bg-muted/40 p-2 text-xs text-destructive">{run.compileError}</pre>
  if (run.timedOut)
    return <Centered><TimerOff className="h-4 w-4 text-amber-500" /> Timed out — check for an infinite loop.</Centered>
  if (run.summary)
    return (
      <div className="space-y-3">
        <VerdictBanner
          verdict={run.summary.passed === run.summary.total ? 'ACCEPTED' : 'WRONG_ANSWER'}
          passed={run.summary.passed}
          total={run.summary.total}
          label="Sample run"
        />
        <CaseList type={type} results={run.results} sampleCases={sampleCases} />
      </div>
    )

  return <Centered>Run against the sample cases, or submit to grade against all tests.</Centered>
}

function CaseList({ type, results, sampleCases }: { type: ProblemType; results: CaseResult[]; sampleCases: VisibleCase[] }) {
  const byId = new Map(sampleCases.map((c) => [c.id, c]))
  return (
    <div className="space-y-2">
      {results.map((r, i) => {
        const c = byId.get(r.id)
        return (
          <div key={r.id} className="rounded-md border p-2.5 text-xs">
            <div className="mb-1 flex items-center gap-1.5 font-medium">
              <StatusIcon status={r.status} />
              <span>Case {i + 1}</span>
            </div>
            {r.status === 'error' && r.error && <Field label="error" value={r.error} tone="error" />}
            {type === 'FUNCTION_RETURN'
              ? r.actual !== undefined && (
                  <>
                    <Field label="got" value={r.actual} tone={r.status === 'pass' ? undefined : 'error'} />
                    {c && <Field label="expected" value={stableSerialize(c.expected)} />}
                  </>
                )
              : r.stdout !== undefined && (
                  <>
                    <Field label="stdout" value={r.stdout} tone={r.status === 'pass' ? undefined : 'error'} />
                    {c && <Field label="expected" value={c.expectedStdout ?? ''} />}
                  </>
                )}
          </div>
        )
      })}
    </div>
  )
}

function VerdictBanner({ verdict, passed, total, label }: { verdict: string; passed: number; total: number; label?: string }) {
  const ok = verdict === 'ACCEPTED'
  return (
    <div
      className={cn(
        'flex items-center gap-2 rounded-md border px-3 py-2 text-sm font-semibold',
        ok
          ? 'border-emerald-500/30 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400'
          : 'border-destructive/30 bg-destructive/10 text-destructive',
      )}
    >
      {ok ? <CheckCircle2 className="h-4 w-4" /> : <XCircle className="h-4 w-4" />}
      <span>{label ? `${label}: ` : ''}{VERDICT_LABEL[verdict] ?? verdict}</span>
      <span className="ml-auto text-xs font-normal tabular-nums">{passed}/{total} passed</span>
    </div>
  )
}

const VERDICT_LABEL: Record<string, string> = {
  ACCEPTED: 'Accepted',
  WRONG_ANSWER: 'Wrong Answer',
  RUNTIME_ERROR: 'Runtime Error',
  TIME_LIMIT: 'Time Limit Exceeded',
  COMPILE_ERROR: 'Compile Error',
}

function StatusIcon({ status }: { status: CaseResult['status'] }) {
  if (status === 'pass') return <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500" />
  if (status === 'timeout') return <TimerOff className="h-3.5 w-3.5 text-amber-500" />
  if (status === 'error') return <AlertTriangle className="h-3.5 w-3.5 text-destructive" />
  return <XCircle className="h-3.5 w-3.5 text-destructive" />
}

function Field({ label, value, tone }: { label: string; value: string; tone?: 'error' }) {
  return (
    <div className="flex gap-2 py-0.5">
      <span className="shrink-0 text-muted-foreground">{label}:</span>
      <pre className={cn('overflow-auto whitespace-pre-wrap break-all font-mono', tone === 'error' && 'text-destructive')}>
        {value}
      </pre>
    </div>
  )
}

function TabButton({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      onClick={onClick}
      className={cn(
        'flex items-center gap-1.5 border-b-2 pb-1.5 font-medium transition-colors -mb-2.5',
        active ? 'border-foreground text-foreground' : 'border-transparent text-muted-foreground hover:text-foreground',
      )}
    >
      {children}
    </button>
  )
}

function Centered({ children }: { children: React.ReactNode }) {
  return <div className="flex items-center gap-2 py-8 text-center text-sm text-muted-foreground">{children}</div>
}
