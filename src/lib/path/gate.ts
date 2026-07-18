// Server-only. The jump-forward gate: prove you already know a locked node's
// prerequisites and teleport to it, crediting everything upstream. Fail and you
// get a *sized gap map* instead of a wall — the missing nodes and how long they'd
// take — never a flat "no".
//
// Design choices that matter:
//   • The probe is STATELESS. Generating it returns the questions to the client
//     WITHOUT the answers, plus a short-lived HMAC token that carries the correct
//     indices (and the userId + nodeId it was minted for). Grading verifies the
//     signature and reads the answers from the token. Nothing is persisted.
//   • It is deliberately NOT a QuizSession. A completed QuizSession is now Path
//     evidence (it satisfies quiz steps) and counts against the daily quiz limit —
//     a gate probe must do neither, or a skip would double as coursework.
//   • Passing banks the target's ANCESTORS (its transitive prerequisites), not the
//     target itself. You still earn the node you jumped to; you just no longer have
//     to grind back through everything behind it.

import { createHmac, timingSafeEqual } from 'node:crypto'
import { prisma } from '@/lib/prisma'
import { generateStructured } from '@/lib/hive/providers'
import { QUIZ_SCHEMA } from '@/lib/quiz/schema'
import type { QuizQuestion } from '@/lib/quiz/topics'
import { ancestorsOf, nodeById, nodeMinutes } from './curriculum'
import { loadEvidence } from './progress'
import { getProfile } from './profile'

// Skipping is a stronger claim than a daily check, so the bar sits high.
const PASS_RATIO = 0.8
const TOKEN_TTL_MS = 30 * 60 * 1000
const QUESTIONS_PER_PREREQ = 2
const MIN_QUESTIONS = 3
const MAX_QUESTIONS = 6

function secret(): string {
  const s = process.env.BETTER_AUTH_SECRET || process.env.VERSUS_SOCKET_SECRET
  if (!s) throw new Error('NO_SECRET')
  return s
}

interface TokenPayload {
  userId: string
  nodeId: string
  correct: number[]
  exp: number
}

function sign(payload: TokenPayload): string {
  const body = Buffer.from(JSON.stringify(payload)).toString('base64url')
  const sig = createHmac('sha256', secret()).update(body).digest('base64url')
  return `${body}.${sig}`
}

function verify(token: string): TokenPayload | null {
  const [body, sig] = token.split('.')
  if (!body || !sig) return null
  const expected = createHmac('sha256', secret()).update(body).digest('base64url')
  const a = Buffer.from(sig)
  const b = Buffer.from(expected)
  if (a.length !== b.length || !timingSafeEqual(a, b)) return null
  try {
    const payload = JSON.parse(Buffer.from(body, 'base64url').toString()) as TokenPayload
    if (Date.now() > payload.exp) return null
    return payload
  } catch {
    return null
  }
}

export interface GateProbe {
  nodeId: string
  nodeTitle: string
  token: string
  /** Questions WITHOUT the correct index — safe to send to the client. */
  questions: { question: string; options: string[] }[]
}

export interface GateStartResult {
  ok: boolean
  error?: string
  probe?: GateProbe
}

/**
 * Mint a probe for a locked node. Tests the node's DIRECT prerequisites — the
 * knowledge you need to stand here. Returns an error result (not a throw) for the
 * expected cases so the route can map them to a clean response.
 */
export async function startGate(userId: string, nodeId: string): Promise<GateStartResult> {
  const node = nodeById(nodeId)
  if (!node) return { ok: false, error: 'NOT_FOUND' }
  if (node.requires.length === 0) return { ok: false, error: 'NO_GATE' } // roots are never locked

  const prereqs = node.requires.map(nodeById).filter((n): n is NonNullable<typeof n> => !!n)
  const count = Math.min(MAX_QUESTIONS, Math.max(MIN_QUESTIONS, prereqs.length * QUESTIONS_PER_PREREQ))

  const topics = prereqs.map((p) => `${p.title} — ${p.blurb}`).join('\n')
  const prompt = [
    `Generate a short ${count}-question multiple-choice check that verifies a learner`,
    `genuinely understands these prerequisite concepts before they skip ahead to "${node.title}":`,
    '',
    topics,
    '',
    'Requirements:',
    `- Exactly ${count} questions, each with exactly 4 options and one correct answer`,
    '- Test real understanding and application, not trivia or memorised definitions',
    '- Spread the questions across the listed concepts',
    '- Explanations should teach, not just name the answer',
    '- No "all of the above" / "none of the above"; each question self-contained',
    `- The "topic" field must be one of the concept names above`,
  ].join('\n')

  let raw: { questions: unknown[] }
  try {
    raw = await generateStructured<{ questions: unknown[] }>(prompt, QUIZ_SCHEMA, {
      feature: 'QUIZ',
      task: 'GENERATE_QUIZ',
      userId,
    })
  } catch {
    return { ok: false, error: 'GENERATION_FAILED' }
  }

  const valid: QuizQuestion[] = []
  for (const q of raw.questions) {
    if (
      typeof q === 'object' && q !== null &&
      'question' in q && typeof (q as { question: unknown }).question === 'string' &&
      'options' in q && Array.isArray((q as { options: unknown }).options) && (q as { options: unknown[] }).options.length === 4 &&
      'correctIndex' in q && typeof (q as { correctIndex: unknown }).correctIndex === 'number' &&
      (q as { correctIndex: number }).correctIndex >= 0 && (q as { correctIndex: number }).correctIndex <= 3
    ) {
      const qq = q as { question: string; options: string[]; correctIndex: number }
      valid.push({ question: qq.question, options: qq.options as QuizQuestion['options'], correctIndex: qq.correctIndex, explanation: '', topic: '' })
    }
  }
  if (valid.length === 0) return { ok: false, error: 'GENERATION_FAILED' }

  const token = sign({ userId, nodeId, correct: valid.map((q) => q.correctIndex), exp: Date.now() + TOKEN_TTL_MS })
  return {
    ok: true,
    probe: {
      nodeId,
      nodeTitle: node.title,
      token,
      questions: valid.map((q) => ({ question: q.question, options: q.options })),
    },
  }
}

export interface GapItem {
  nodeId: string
  title: string
  minutes: number
}

export interface GateSubmitResult {
  ok: boolean
  error?: string
  passed?: boolean
  score?: number
  /** On pass: the upstream nodes credited. */
  bankedNodeIds?: string[]
  /** On fail: the prerequisites still missing, and how long they'd take. */
  gap?: GapItem[]
  gapWeeks?: number
}

/**
 * Grade a probe from its signed token + the learner's answers. On pass, bank the
 * target's unmastered ancestors so it unlocks. The token is bound to (userId,
 * nodeId), so a token minted for one learner or node cannot grade another.
 */
export async function submitGate(userId: string, nodeId: string, token: string, answers: number[]): Promise<GateSubmitResult> {
  const payload = verify(token)
  if (!payload) return { ok: false, error: 'BAD_TOKEN' }
  if (payload.userId !== userId || payload.nodeId !== nodeId) return { ok: false, error: 'BAD_TOKEN' }

  const total = payload.correct.length
  const correct = payload.correct.reduce((sum, want, i) => sum + (answers[i] === want ? 1 : 0), 0)
  const score = total > 0 ? Math.round((correct / total) * 100) : 0
  const passed = correct / total >= PASS_RATIO

  // The upstream this node stands on. Bank the ones not already mastered.
  const ancestors = ancestorsOf(nodeId)

  if (!passed) {
    const ev = await loadEvidence(userId)
    const missing = ancestors.filter((id) => !ev.mastered.has(id))
    const gap: GapItem[] = missing
      .map((id) => nodeById(id))
      .filter((n): n is NonNullable<typeof n> => !!n)
      .map((n) => ({ nodeId: n.id, title: n.title, minutes: nodeMinutes(n) }))

    // Weeks for the gap alone, at the learner's pace (default 6 if no profile yet).
    const profile = await getProfile(userId)
    const perWeek = Math.max(1, profile?.weeklyHours ?? 6) * 60
    const gapWeeks = gap.length === 0 ? 0 : Math.ceil((gap.reduce((m, g) => m + g.minutes, 0) * 1.6) / perWeek)

    return { ok: true, passed: false, score, gap, gapWeeks }
  }

  // Pass: credit every unmastered ancestor. Curriculum order keeps prerequisites
  // banked before dependents. Idempotent — the row is unique per (user, node).
  const existing = await prisma.pathProgress.findMany({ where: { userId, nodeId: { in: ancestors } }, select: { nodeId: true } })
  const already = new Set(existing.map((r) => r.nodeId))
  const toBank = ancestors.filter((id) => !already.has(id))

  for (const id of toBank) {
    await prisma.pathProgress.upsert({
      where: { userId_nodeId: { userId, nodeId: id } },
      create: { userId, nodeId: id, evidence: { via: 'gate', target: nodeId, score } as object },
      update: {},
    })
  }

  return { ok: true, passed: true, score, bankedNodeIds: toBank }
}

export { PASS_RATIO }
