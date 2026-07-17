'use client'

// Owns the Run worker and the main-thread watchdog. A worker cannot interrupt
// its own synchronous infinite loop, so the only way to stop runaway user code
// is to terminate the worker from here and lazily recreate it on the next run.

import { useCallback, useEffect, useRef, useState } from 'react'
import type { CaseResult, CodeLanguage, ProblemType, VisibleCase } from './types'
import type { RunRequest, WorkerMessage } from './worker-protocol'

const WATCHDOG_MS = 3000

export interface RunState {
  running: boolean
  /** Results so far, keyed by case order. */
  results: CaseResult[]
  compileError: string | null
  timedOut: boolean
  /** Summary once finished; null while running or before first run. */
  summary: { passed: number; total: number } | null
}

const IDLE: RunState = { running: false, results: [], compileError: null, timedOut: false, summary: null }

export interface RunParams {
  language: CodeLanguage
  code: string
  problemType: ProblemType
  fnName: string | null
  cases: VisibleCase[]
}

export function useRunner() {
  const [state, setState] = useState<RunState>(IDLE)
  const workerRef = useRef<Worker | null>(null)
  const runIdRef = useRef(0)
  const watchdogRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const clearWatchdog = () => {
    if (watchdogRef.current) {
      clearTimeout(watchdogRef.current)
      watchdogRef.current = null
    }
  }

  const killWorker = useCallback(() => {
    workerRef.current?.terminate()
    workerRef.current = null
  }, [])

  const ensureWorker = useCallback(() => {
    if (workerRef.current) return workerRef.current
    const worker = new Worker(new URL('./run.worker.ts', import.meta.url), { type: 'module' })
    worker.onmessage = (e: MessageEvent<WorkerMessage>) => {
      const msg = e.data
      if (msg.runId !== runIdRef.current) return // stale run
      if (msg.type === 'compile-error') {
        clearWatchdog()
        setState({ running: false, results: [], compileError: msg.message, timedOut: false, summary: null })
      } else if (msg.type === 'case') {
        setState((s) => ({ ...s, results: [...s.results, msg.result] }))
      } else if (msg.type === 'done') {
        clearWatchdog()
        setState((s) => ({ ...s, running: false, summary: { passed: msg.passed, total: msg.total } }))
      }
    }
    workerRef.current = worker
    return worker
  }, [])

  const run = useCallback(
    (params: RunParams) => {
      clearWatchdog()
      const runId = ++runIdRef.current
      setState({ running: true, results: [], compileError: null, timedOut: false, summary: null })

      const worker = ensureWorker()
      watchdogRef.current = setTimeout(() => {
        // Runaway code: kill the worker, report a timeout, drop the run.
        killWorker()
        if (runId === runIdRef.current) {
          setState((s) => ({ ...s, running: false, timedOut: true }))
        }
      }, WATCHDOG_MS)

      const req: RunRequest = {
        type: 'run',
        runId,
        language: params.language,
        code: params.code,
        problemType: params.problemType,
        fnName: params.fnName,
        cases: params.cases,
      }
      worker.postMessage(req)
    },
    [ensureWorker, killWorker],
  )

  const reset = useCallback(() => {
    clearWatchdog()
    runIdRef.current++
    setState(IDLE)
  }, [])

  useEffect(() => {
    return () => {
      clearWatchdog()
      killWorker()
    }
  }, [killWorker])

  return { ...state, run, reset }
}
