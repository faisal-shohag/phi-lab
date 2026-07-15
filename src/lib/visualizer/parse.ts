// Parsing and error types, split out from the interpreter.
//
// The editor's squiggle only ever needed "does this parse?", but that lived
// inside the 2000-line interpreter, so importing it dragged the whole engine
// along. These are the pieces that outlive the teaching interpreter: once the
// real engine runs everything, the squiggle is still an acorn parse.

import { parse } from 'acorn'
import type { ParseErrorInfo } from './types'

export class ParseError extends Error {
  line: number
  column: number
  pos: number
  constructor(message: string, line: number, column: number, pos: number) {
    super(message)
    this.name = 'ParseError'
    this.line = line
    this.column = column
    this.pos = pos
  }
}

// A runtime error (e.g. "x is not a function") tagged with the source line it
// happened on, so the editor can point right at it — not just show a message.
export class RuntimeError extends Error {
  line: number
  constructor(message: string, line: number) {
    super(message)
    this.name = 'RuntimeError'
    this.line = line
  }
}

// Parse-only check used by the editor to render error squiggles.
export function getParseError(source: string): ParseErrorInfo | null {
  try {
    parse(source, { ecmaVersion: 'latest', sourceType: 'script', locations: true })
    return null
  } catch (e) {
    const err = e as Error & { loc?: { line: number; column: number }; pos?: number }
    return {
      message: err.message.replace(/\s*\(\d+:\d+\)\s*$/, ''),
      line: err.loc?.line ?? 1,
      column: err.loc?.column ?? 0,
      pos: err.pos ?? 0,
    }
  }
}
