// Shared Code Lab types. Safe to import from both client and server — no engine
// or DB imports here.

import type {
  ProblemDifficulty,
  ProblemType,
  CodeLanguage,
  SubmissionVerdict,
} from '@/generated/prisma/client'

export type { ProblemDifficulty, ProblemType, CodeLanguage, SubmissionVerdict }

/**
 * One test case. SERVER-ONLY in full: `hidden` cases never leave the server, and
 * the client only ever receives cases with `hidden: false`.
 *
 * - FUNCTION_RETURN: `args` is spread into `fnName(...args)`; the returned value
 *   is deep-compared (via stableSerialize) to `expected`.
 * - CONSOLE_OUTPUT with a fnName: `fnName(...args)` is called and captured stdout
 *   is compared to `expectedStdout`.
 * - CONSOLE_OUTPUT without a fnName: the whole script runs once; `args` is
 *   ignored and captured stdout is compared to `expectedStdout`.
 */
export interface TestCase {
  id: string
  hidden: boolean
  args?: unknown[]
  expected?: unknown
  expectedStdout?: string
}

/** Shape stored in Problem.tests (Json). */
export interface ProblemTests {
  cases: TestCase[]
}

/** The visible subset of a case sent to the browser for "Run". */
export interface VisibleCase {
  id: string
  args?: unknown[]
  expected?: unknown
  expectedStdout?: string
}

/** Per-case grading outcome. `actual`/`stdout` are omitted for hidden cases. */
export interface CaseResult {
  id: string
  hidden: boolean
  status: 'pass' | 'fail' | 'error' | 'timeout'
  /** Serialized actual return value (FUNCTION_RETURN), visible cases only. */
  actual?: string
  /** Captured stdout, visible cases only. */
  stdout?: string
  /** Error message when status is 'error', visible cases only. */
  error?: string
}

export interface GradeSummary {
  verdict: SubmissionVerdict
  results: CaseResult[]
  passedCount: number
  totalCount: number
  runtimeMs: number
  /** First error message across cases (compile or runtime), truncated. */
  error?: string
}

/** POST /api/code-lab/submit response. Hidden cases surface only as counts. */
export interface SubmitResponse {
  verdict: SubmissionVerdict
  passedCount: number
  totalCount: number
  /** Results for visible cases only (with actual/stdout). */
  visibleResults: CaseResult[]
  /** Counts for hidden cases: how many passed of how many. */
  hidden: { passed: number; total: number }
  error?: string
  /** Present when this accept awarded XP (first solve). */
  xp?: {
    awarded: boolean
    xpGained: number
    totalXp: number
    level: number
    leveledUp: boolean
    newBadges: string[]
  }
}
