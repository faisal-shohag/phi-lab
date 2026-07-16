// Server-only grading boundary. Grading runs on the QuickJS sandbox: real JS,
// so a solution using regex, generators or a real throw/catch grades the same
// way it would in Node.
//
// This used to dispatch between QuickJS and the legacy teaching interpreter on
// a VIZ_GRADE_ENGINE env var. That flag is gone, and its removal is a fix, not
// just cleanup: it defaulted to LEGACY when unset, so any deploy that lost the
// env var silently started failing every valid full-JS solution.
//
// The indirection stays as the one named seam the routes import, so an engine
// or worker change lands here instead of in every route.
//
// NEVER import from client code — this pulls in the QuickJS wasm.
import 'server-only'

import type { HiddenTest, GradeResult } from './challenge'
import { gradeQjs, runFnQjs, computeExpectedQjs } from './grade-qjs'

export async function runFn(code: string, fnName: string, args: unknown[]): Promise<string | null> {
  return runFnQjs(code, fnName, args)
}

export async function grade(code: string, fnName: string, tests: HiddenTest[]): Promise<GradeResult> {
  return gradeQjs(code, fnName, tests)
}

export async function computeExpected(
  referenceCode: string,
  fnName: string,
  testArgs: unknown[][],
): Promise<HiddenTest[] | null> {
  return computeExpectedQjs(referenceCode, fnName, testArgs)
}
