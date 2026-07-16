// Server-only. Runs a practice submission and returns just its console output,
// so the complete route can compare it to the expected lines.
//
// Why this and not the challenge grader (`grade.ts`)? That one calls a named
// function and reads its return value. Practice problems are whole programs
// judged on what they PRINT — including the async ones, where the order is the
// whole lesson. The trace producer already models the event loop (via
// `__runEventLoop`), so running the program through it gives correct ordering
// for free and grades exactly what the learner sees in the Console lane.
import 'server-only'

import { traceQjs } from './trace-qjs'

export interface RunOutput {
  /** The console.log lines, in order. null when the program never ran. */
  lines: string[] | null
  /** Why it produced nothing: a thrown error, or an infinite loop. */
  error?: string
}

const MAX_OUTPUT_LINES = 200

export async function runOutput(code: string): Promise<RunOutput> {
  let result
  try {
    result = await traceQjs(code)
  } catch (e) {
    return { lines: null, error: e instanceof Error ? e.message : String(e) }
  }
  if (result.error || !result.trace) return { lines: null, error: result.error ?? 'The program did not run.' }
  if (result.trace.truncated) {
    return { lines: null, error: 'The program ran too long — check for a loop that never ends.' }
  }
  return { lines: collect(result.trace.steps) }
}

function collect(steps: { kind: string; output?: string }[]): string[] {
  const out: string[] = []
  for (const s of steps) {
    if (s.kind === 'output' && typeof s.output === 'string') out.push(s.output)
    if (out.length >= MAX_OUTPUT_LINES) break
  }
  return out
}

/**
 * Compare a run against the expected lines. Whitespace at the ends of a line is
 * forgiven (a trailing space is a typo, not a misunderstanding); everything else
 * must match exactly, in order.
 */
export function matchesExpected(got: string[], expected: string[]): boolean {
  if (got.length !== expected.length) return false
  return got.every((line, i) => line.trim() === expected[i].trim())
}
