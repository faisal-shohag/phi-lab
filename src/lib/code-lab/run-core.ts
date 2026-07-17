// Pure, in-process grading used by the browser Run worker. No DOM, no worker
// APIs, no quickjs — so it runs unchanged in Vitest. It executes user JS in the
// worker's own JS engine (a `new Function` closure with a captured console),
// which is fine for the visible-case preview; the authoritative re-grade happens
// server-side in a real sandbox (grade-qjs.ts).
//
// The comparison logic (stableSerialize / normalizeStdout) is shared with the
// server grader so "Run" and "Submit" agree on what "correct" means.

import { stableSerialize, normalizeStdout } from './serialize'
import type { CaseResult, ProblemType, VisibleCase } from './types'

export interface RunCaseInput {
  type: ProblemType
  fnName: string | null
  /** Already-transpiled JS. */
  codeJs: string
}

/** Grade one visible case in-process. Never throws — errors become a result. */
export function gradeCase(input: RunCaseInput, c: VisibleCase): CaseResult {
  const lines: string[] = []
  const console = makeConsole(lines)
  try {
    if (input.type === 'FUNCTION_RETURN') {
      const fn = extractFn(input.codeJs, input.fnName, console)
      const actual = fn(...(c.args ?? []))
      const actualStr = stableSerialize(actual)
      const pass = actualStr === stableSerialize(c.expected)
      return { id: c.id, hidden: false, status: pass ? 'pass' : 'fail', actual: actualStr }
    }
    // CONSOLE_OUTPUT
    if (input.fnName) {
      const fn = extractFn(input.codeJs, input.fnName, console)
      fn(...(c.args ?? []))
    } else {
      // Program-style: run the whole script with the captured console in scope.
      new Function('console', input.codeJs)(console)
    }
    const stdout = lines.join('\n')
    const pass = normalizeStdout(stdout) === normalizeStdout(c.expectedStdout ?? '')
    return { id: c.id, hidden: false, status: pass ? 'pass' : 'fail', stdout }
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    return { id: c.id, hidden: false, status: 'error', error: message, stdout: lines.join('\n') }
  }
}

// Build the user's function by running their code with a captured console in
// scope, then returning the named function from that scope.
function extractFn(codeJs: string, fnName: string | null, console: Console): (...args: unknown[]) => unknown {
  if (!fnName) throw new Error('This problem has no entry function.')
  const factory = new Function('console', `${codeJs}\n;return typeof ${fnName} === 'function' ? ${fnName} : undefined;`)
  const fn = factory(console) as ((...args: unknown[]) => unknown) | undefined
  if (typeof fn !== 'function') throw new Error(`Define a function named "${fnName}".`)
  return fn
}

function makeConsole(sink: string[]): Console {
  const push = (...args: unknown[]) => {
    sink.push(args.map((a) => (typeof a === 'string' ? a : stableSerialize(a))).join(' '))
  }
  // Only the members user code is likely to call; cast covers the Console type.
  return { log: push, info: push, warn: push, error: push, debug: push } as unknown as Console
}
