'use client'

// Per-problem, per-language unsaved code, in the browser. Mirrors
// lib/pixel/drafts.ts: a scratchpad saved on every keystroke, localStorage not
// the server (a write per character to record something only this browser reads
// is not worth a round trip). The server keeps what was submitted; this keeps
// what is being typed.

import type { CodeLanguage } from './types'

const PREFIX = 'code-lab:draft:'
const MAX = 50_000

function key(problemId: string, language: CodeLanguage): string {
  return `${PREFIX}${problemId}:${language}`
}

export function loadDraft(problemId: string, language: CodeLanguage): string | null {
  if (typeof window === 'undefined') return null
  try {
    return window.localStorage.getItem(key(problemId, language))
  } catch {
    return null
  }
}

export function saveDraft(problemId: string, language: CodeLanguage, code: string): void {
  if (typeof window === 'undefined') return
  try {
    window.localStorage.setItem(key(problemId, language), code.slice(0, MAX))
  } catch {
    /* quota or private mode — losing a draft is survivable; throwing in onChange is not */
  }
}

export function clearDraft(problemId: string, language: CodeLanguage): void {
  if (typeof window === 'undefined') return
  try {
    window.localStorage.removeItem(key(problemId, language))
  } catch {
    /* nothing to do */
  }
}
