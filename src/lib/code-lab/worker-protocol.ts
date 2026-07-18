// Message contract between the Run hook (main thread) and run.worker.ts. Every
// message carries a `runId` so a result that arrives after the user hit Run
// again (or after a watchdog terminate) can be discarded as stale.

import type { CaseResult, CodeLanguage, ProblemType, VisibleCase } from './types'

export interface RunRequest {
  type: 'run'
  runId: number
  language: CodeLanguage
  code: string
  problemType: ProblemType
  fnName: string | null
  cases: VisibleCase[]
}

export type WorkerMessage =
  | { type: 'compile-error'; runId: number; message: string }
  | { type: 'case'; runId: number; result: CaseResult }
  | { type: 'done'; runId: number; passed: number; total: number }
