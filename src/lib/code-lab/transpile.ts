// TypeScript → JavaScript, the same way on the client worker and the server
// grader. sucrase only strips types (no downlevelling, no type checking — Monaco
// already surfaces type errors in the editor), which is all a run-time needs and
// keeps this ~200KB and synchronous. User code is a plain script, so only the
// 'typescript' transform runs — no imports/JSX handling.

import { transform } from 'sucrase'
import type { CodeLanguage } from './types'

export class CompileError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'CompileError'
  }
}

/** Returns runnable JS. For JAVASCRIPT input this is a no-op passthrough. */
export function toRunnableJs(code: string, language: CodeLanguage): string {
  if (language === 'JAVASCRIPT') return code
  try {
    return transform(code, { transforms: ['typescript'] }).code
  } catch (err) {
    const message = err instanceof Error ? err.message : 'TypeScript transpile failed'
    throw new CompileError(message)
  }
}
