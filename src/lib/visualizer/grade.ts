// Server-only grading dispatcher. Picks the grading engine behind a flag so we
// can roll out the QuickJS real-JS grader without ripping out the legacy
// interpreter grader until parity is proven.
//
//   VIZ_GRADE_ENGINE=quickjs  → full-JS QuickJS sandbox (regex, generators, …)
//   (anything else / unset)   → legacy teaching-interpreter grader
//
// Both expose the same async contract, so routes just `await` these regardless
// of the engine. NEVER import from client code — the quickjs path pulls in wasm.
import 'server-only'

import { grade as legacyGrade, runFn as legacyRunFn, computeExpected as legacyComputeExpected, type HiddenTest, type GradeResult } from './challenge'
import { gradeQjs, runFnQjs, computeExpectedQjs } from './grade-qjs'

export type GradeEngine = 'quickjs' | 'legacy'

export function gradeEngine(): GradeEngine {
  return process.env.VIZ_GRADE_ENGINE === 'quickjs' ? 'quickjs' : 'legacy'
}

export async function runFn(code: string, fnName: string, args: unknown[]): Promise<string | null> {
  return gradeEngine() === 'quickjs'
    ? runFnQjs(code, fnName, args)
    : legacyRunFn(code, fnName, args)
}

export async function grade(code: string, fnName: string, tests: HiddenTest[]): Promise<GradeResult> {
  return gradeEngine() === 'quickjs'
    ? gradeQjs(code, fnName, tests)
    : legacyGrade(code, fnName, tests)
}

export async function computeExpected(
  referenceCode: string,
  fnName: string,
  testArgs: unknown[][],
): Promise<HiddenTest[] | null> {
  return gradeEngine() === 'quickjs'
    ? computeExpectedQjs(referenceCode, fnName, testArgs)
    : legacyComputeExpected(referenceCode, fnName, testArgs)
}
