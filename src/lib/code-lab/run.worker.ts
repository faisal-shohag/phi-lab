// The Run worker. Transpiles (if TS) and grades visible cases off the main
// thread, streaming one result per case so the UI fills in progressively. A
// synchronous infinite loop in user code hangs THIS worker, not the page — the
// hook's watchdog terminates and recreates it (see use-runner.ts).

import { toRunnableJs, CompileError } from './transpile'
import { gradeCase } from './run-core'
import type { RunRequest, WorkerMessage } from './worker-protocol'

function post(msg: WorkerMessage) {
  ;(self as unknown as Worker).postMessage(msg)
}

self.onmessage = (e: MessageEvent<RunRequest>) => {
  const req = e.data
  if (req?.type !== 'run') return
  const { runId } = req

  let codeJs: string
  try {
    codeJs = toRunnableJs(req.code, req.language)
  } catch (err) {
    const message = err instanceof CompileError ? err.message : 'Failed to compile.'
    post({ type: 'compile-error', runId, message })
    return
  }

  let passed = 0
  for (const c of req.cases) {
    const result = gradeCase({ type: req.problemType, fnName: req.fnName, codeJs }, c)
    if (result.status === 'pass') passed++
    post({ type: 'case', runId, result })
  }
  post({ type: 'done', runId, passed, total: req.cases.length })
}
