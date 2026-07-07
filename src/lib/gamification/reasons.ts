// XP amounts are decided on the server from the *reason*, never from a value the
// client sends. This module maps the reasons a browser is allowed to trigger to
// their XP value. Server-internal reasons (e.g. interview_completed) are awarded
// directly in their route handlers and are intentionally NOT listed here.

export interface ClientAwardRequest {
  reason: string
  sourceId: string
  /** Optional context the server uses to size/record the award. */
  streak?: number
}

interface Resolved {
  amount: number
  meta?: Record<string, unknown>
}

const QUIZ_BASE = 10

/**
 * Resolve a client-triggered award to a concrete XP amount, or null if the
 * reason is not something the client is permitted to grant.
 */
export function resolveClientAward(req: ClientAwardRequest): Resolved | null {
  switch (req.reason) {
    case 'quiz_correct': {
      const streak = Number.isFinite(req.streak) ? Math.max(0, Math.min(50, Math.floor(req.streak!))) : 0
      let amount = QUIZ_BASE
      if (streak >= 10) amount += 10
      else if (streak >= 5) amount += 5
      return { amount, meta: { streak } }
    }
    default:
      return null
  }
}

// Reason/amount for server-internal awards, kept here so the values live in one
// place. Interview: 40 XP floor + up to 60 scaled by score (0–100 → 40–100 XP),
// plus a flat bonus for braving higher interview pressure.
const PRESSURE_BONUS: Record<string, number> = {
  supportive: 0,
  neutral: 0,
  stern: 15,
  panel: 30,
}

export function interviewXp(score: number, pressure = 'neutral'): number {
  const s = Math.max(0, Math.min(100, Math.floor(score)))
  return 40 + Math.round(s * 0.6) + (PRESSURE_BONUS[pressure] ?? 0)
}

// Feynman teach-back: 40 XP floor + up to 60 scaled by clarity (0–100 → 40–100).
export function feynmanXp(clarity: number): number {
  const c = Math.max(0, Math.min(100, Math.floor(clarity)))
  return 40 + Math.round(c * 0.6)
}

// English practice: 40 XP floor + up to 60 scaled by the spoken-English score.
export function englishXp(score: number): number {
  const s = Math.max(0, Math.min(100, Math.floor(score)))
  return 40 + Math.round(s * 0.6)
}
