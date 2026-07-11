// Buy one hint for the current challenge. Costs a flat 15 XP, one per round, and
// never reveals the solution. The hint is generated from the stored task (the
// learner's own code is NOT sent — the hint is about the problem, not their
// attempt).

import { Type } from '@google/genai'
import { requireUser } from '@/lib/auth-server'
import { spendXp } from '@/lib/gamification/award'
import { generateStructured } from '@/lib/hive/providers'
import { prisma } from '@/lib/prisma'
import { errorResponse } from '@/lib/interview/errors'

export const runtime = 'nodejs'

const HINT_COST = 15

function fail(code: string, message: string, status: number) {
  return Response.json({ error: code, message }, { status })
}

const SCHEMA = {
  type: Type.OBJECT,
  properties: {
    hint: { type: Type.STRING, description: 'ONE short nudge in Bengali (Bangla script) — a way to think about the problem. NEVER the solution, code, or the answer.' },
  },
  required: ['hint'],
}

export async function POST() {
  const user = await requireUser()
  if (!user) return errorResponse('AUTH_REQUIRED')

  const attempt = await prisma.challengeAttempt.findFirst({ where: { userId: user.id, status: 'active' } })
  if (!attempt) return fail('NOT_FOUND', 'No active challenge.', 404)
  if (attempt.hintsUsed >= 1) return fail('HINT_USED', 'You already used your hint for this challenge.', 409)

  // Charge first (idempotent per attempt → only one paid hint ever).
  const paid = await spendXp({ userId: user.id, reason: 'viz_challenge_hint', sourceId: attempt.id, amount: HINT_COST })
  if (!paid.spent) return fail('INSUFFICIENT_XP', `You need ${HINT_COST} XP for a hint.`, 400)

  const langLine = attempt.lang === 'english'
    ? 'Give the hint in clear, simple English.'
    : 'Give the hint in Bengali (Bangla script, বাংলা) — proper Bengali, not Banglish.'
  const prompt = [
    'You are a coding tutor. A beginner is stuck on this challenge:',
    attempt.prompt,
    `They must implement the function ${attempt.fnName}. Example: ${attempt.fnName}(${JSON.stringify(attempt.sampleInput).slice(1, -1)}) → ${attempt.sampleOutput}.`,
    'Give ONE short hint that nudges their thinking — a strategy, an edge case to consider, or which construct to reach for. Do NOT write code, do NOT give the full approach, do NOT state the answer.',
    langLine,
  ].join('\n')

  try {
    const { hint } = await generateStructured<{ hint: string }>(prompt, SCHEMA, { feature: 'JS_MOTION', task: 'EXPLAIN', userId: user.id })
    await prisma.challengeAttempt.update({ where: { id: attempt.id }, data: { hintsUsed: attempt.hintsUsed + 1 } })
    return Response.json({ hint: String(hint ?? '').trim(), balance: paid.balance })
  } catch {
    // Generation failed after the charge — refund so the learner isn't robbed.
    await prisma.xpEvent.deleteMany({ where: { userId: user.id, reason: 'viz_challenge_hint', sourceId: attempt.id } })
    await prisma.user.update({ where: { id: user.id }, data: { xp: { increment: HINT_COST } } })
    return fail('GEN_FAILED', 'Could not get a hint right now. Your XP was refunded.', 503)
  }
}
