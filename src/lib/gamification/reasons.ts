// XP amounts are decided on the server from the *reason*, never from a value the
// client sends. This module maps the reasons a browser is allowed to trigger to
// their XP value. Server-internal reasons (e.g. interview_completed) are awarded
// directly in their route handlers and are intentionally NOT listed here.

export interface ClientAwardRequest {
  reason: string
  sourceId: string
  /** Optional context the server uses to size/record the award. */
  streak?: number
  /** For viz_concept: which concept the learner just completed. */
  concept?: string
  /** For viz_problem: which catalog problem was just finished. */
  problemId?: string
}

import { problemById } from '@/lib/visualizer/problems'

/** True for catalog problems the client is trusted to self-report (demos only). */
function isDemoProblemId(id: string): boolean {
  return problemById(id)?.kind === 'demo'
}

// Concepts the JS Motion visualizer can credit as "mastered" (stepping a demo to
// its final frame). Kept here so the award route can reject anything a client
// makes up.
//
// The first five are load-bearing for badges (see badges.ts) — do not rename
// them. The rest were added for The Path, which needs every demo it references
// to leave a verifiable trace; before, only five of the nineteen demos did, so a
// path node built on "step the Arrays demo" had no evidence to check against.
export const VIZ_CONCEPTS = [
  'recursion',
  'closures',
  'event-loop',
  'oop',
  'sorting',
  'conditionals',
  'loops',
  'arrays',
  'functions',
  'references',
  'hoisting',
  'two-pointers',
  'destructuring',
  'array-methods',
] as const

interface Resolved {
  amount: number
  meta?: Record<string, unknown>
}

// Earning rates are deliberately lean. XP buys real things in JS Motion — a
// challenge stake (20/50/100), an AI explanation (30), a hint (15) — and those
// prices only mean something if the XP behind them was work. Watching a demo is
// worth less than solving a problem, and neither is worth much on its own.
const QUIZ_BASE = 5
const DAILY_XP = 3
const CONCEPT_XP = 3

/** Stepping a catalog demo to its final frame. */
export const DEMO_PROBLEM_XP = 5
/** Solving a practice problem — server-checked, so it pays more. */
export const PRACTICE_PROBLEM_XP = 12

/**
 * Fixing a Bug Hunt level, by difficulty. Between a demo and a practice problem:
 * the program is handed to you, but finding someone else's mistake is its own
 * skill. Never client-triggerable — the check route awards it after running the
 * fix (see bugs/check/route.ts).
 */
const BUG_FIX_XP: Record<number, number> = { 1: 6, 2: 10, 3: 15 }

export function bugFixXp(difficulty: number): number {
  return BUG_FIX_XP[difficulty] ?? BUG_FIX_XP[1]
}

/**
 * Resolve a client-triggered award to a concrete XP amount, or null if the
 * reason is not something the client is permitted to grant.
 */
export function resolveClientAward(req: ClientAwardRequest): Resolved | null {
  switch (req.reason) {
    case 'quiz_correct': {
      const streak = Number.isFinite(req.streak) ? Math.max(0, Math.min(50, Math.floor(req.streak!))) : 0
      let amount = QUIZ_BASE
      if (streak >= 10) amount += 5
      else if (streak >= 5) amount += 2
      return { amount, meta: { streak } }
    }
    // A small daily grant for opening the visualizer and running code. sourceId
    // is the calendar day, so it's idempotent — once per day, not per run.
    case 'viz_daily':
      return { amount: DAILY_XP }
    // Completing a concept demo (stepping it to the end). Idempotent per concept
    // via sourceId; the concept is validated against the known list.
    //
    // Superseded by viz_problem for XP purposes (hence the small amount), but it
    // still fires and must keep firing: it is the evidence The Path checks for
    // its "see it" steps (lib/path/progress.ts) and the trigger for the five
    // concept badges. Retiring it would silently break both.
    case 'viz_concept': {
      if (!req.concept || !(VIZ_CONCEPTS as readonly string[]).includes(req.concept)) return null
      return { amount: CONCEPT_XP, meta: { concept: req.concept } }
    }
    // Finishing a catalog problem. The client may only claim DEMO problems —
    // those are self-evident (it stepped the trace to the end). Practice
    // problems are awarded by the complete route after the server has actually
    // run the code, because that receipt gates Challenge mode.
    case 'viz_problem': {
      if (!req.problemId || !isDemoProblemId(req.problemId)) return null
      if (req.sourceId !== `problem:${req.problemId}`) return null
      return { amount: DEMO_PROBLEM_XP, meta: { problemId: req.problemId, kind: 'demo' } }
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

// Support session: a flat grant for showing up and talking something through.
// There is no score, so it's not performance-scaled.
export function supportXp(): number {
  return 20
}

// ── Hive helpdesk ─────────────────────────────────────────────────────────
// Asking is cheap; helping is what we want to reward. Nectar reactions grant no
// XP at all — otherwise they become a farmable currency. They only rank the
// weekly leaderboard.

/** Posting a question. Small, and the route caps posts per day anyway. */
export function hivePostXp(): number {
  return 5
}

/** Replying to someone. The route caps how many replies earn XP per day. */
export function hiveReplyXp(): number {
  return 5
}

/** A peer answer the AI verified as correct ("Bee-Approved"). */
export function hiveApprovedXp(): number {
  return 25
}

/** The asker accepted your answer — the strongest signal we have. */
export function hiveAcceptedXp(): number {
  return 40
}

/** The asker gets a little back for closing the loop. */
export function hiveResolvedAskerXp(): number {
  return 10
}

/** Top of the weekly helper leaderboard. */
export function hiveQueenXp(): number {
  return 100
}
