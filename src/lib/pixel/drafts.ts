// Unsaved work, per challenge, in the browser.
//
// The arena keeps code in React state, so picking another challenge or hitting
// reload threw away everything the learner had typed and dropped them back to
// the starter. Nothing about that is recoverable — the submission log only has
// what they *scored*, and the thing you lose is the half-finished attempt you
// were in the middle of.
//
// localStorage rather than the server on purpose. This is a scratchpad, saved on
// every keystroke; posting that would be a write per character on a plan metered
// by CPU, to record something nobody else will ever read. The server keeps what
// was submitted (lib/pixel/submissions.ts); this keeps what is being written.

const PREFIX = 'pixel-lab:draft:'

/** Matches the editor's own cap, so a draft can never be bigger than a submission. */
const MAX = 20_000

export interface Draft {
  html: string
  css: string
}

function key(challengeId: string): string {
  return `${PREFIX}${challengeId}`
}

export function loadDraft(challengeId: string): Draft | null {
  if (typeof window === 'undefined') return null
  try {
    const raw = window.localStorage.getItem(key(challengeId))
    if (!raw) return null
    const parsed = JSON.parse(raw) as unknown
    if (!parsed || typeof parsed !== 'object') return null
    const { html, css } = parsed as Partial<Draft>
    if (typeof html !== 'string' || typeof css !== 'string') return null
    return { html, css }
  } catch {
    // Corrupt entry, or storage disabled. The starter is a fine fallback and far
    // better than an arena that will not load.
    return null
  }
}

export function saveDraft(challengeId: string, draft: Draft): void {
  if (typeof window === 'undefined') return
  try {
    window.localStorage.setItem(
      key(challengeId),
      JSON.stringify({ html: draft.html.slice(0, MAX), css: draft.css.slice(0, MAX) }),
    )
  } catch {
    // Quota, or private mode. Losing a draft is survivable; throwing inside an
    // onChange handler is not.
  }
}

export function clearDraft(challengeId: string): void {
  if (typeof window === 'undefined') return
  try {
    window.localStorage.removeItem(key(challengeId))
  } catch {
    /* nothing to do */
  }
}

/** Which challenges have work in progress. Lets the map mark them. */
export function draftedChallengeIds(): string[] {
  if (typeof window === 'undefined') return []
  try {
    const out: string[] = []
    for (let i = 0; i < window.localStorage.length; i++) {
      const k = window.localStorage.key(i)
      if (k?.startsWith(PREFIX)) out.push(k.slice(PREFIX.length))
    }
    return out
  } catch {
    return []
  }
}
