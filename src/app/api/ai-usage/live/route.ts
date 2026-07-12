// The one AI usage row the server cannot observe for itself.
//
// A live voice round runs browser <-> Google directly: we mint an ephemeral
// token and then never see the socket, so no token count ever reaches us. The
// browser reads `usageMetadata` off the Live server messages and reports the
// totals here when the round ends.
//
// This is client-reported data. It is therefore:
//   - bound to a session row the caller provably owns (no free-floating rows),
//   - clamped server-side (a client must not inject 10^9 tokens and wreck the
//     cost chart),
//   - flagged `tokensClientReported` so the dashboard can say so out loud.
//
// Idempotent via the `ai_usage_live_once` partial unique index: the hook flushes
// on normal end AND on tab close, and exactly one row must survive.
//
// The browser is never told which API key its round ran on — it could then lie
// about it and poison another key's stats. The token route recorded that when it
// minted (LiveTokenIssue), so the key is looked up here, server-side.
import { requireUser } from '@/lib/auth-server'
import { prisma } from '@/lib/prisma'
import { recordAiUsageStrict } from '@/lib/ai-usage/record'
import { LIVE_MODEL } from '@/lib/ai-keys/live-token'
import type { AiFeature } from '@/generated/prisma/client'

/** Generous ceilings. A real round cannot plausibly exceed these. */
const MAX_TOKENS = 2_000_000
const MAX_DURATION_MS = 2 * 60 * 60 * 1000

const LIVE_FEATURES = ['INTERVIEW', 'FEYNMAN', 'ENGLISH', 'SUPPORT'] as const
type LiveFeature = (typeof LIVE_FEATURES)[number]

function isLiveFeature(v: unknown): v is LiveFeature {
  return typeof v === 'string' && (LIVE_FEATURES as readonly string[]).includes(v)
}

function clamp(value: unknown, max: number): number | undefined {
  const n = typeof value === 'number' ? value : Number(value)
  if (!Number.isFinite(n) || n < 0) return undefined
  return Math.min(max, Math.round(n))
}

/**
 * Does this session exist and belong to the caller? This is the anti-abuse
 * anchor: without it, any signed-in user could post arbitrary usage rows.
 */
async function ownsSession(feature: LiveFeature, sessionId: string, userId: string): Promise<boolean> {
  const where = { id: sessionId, userId }
  switch (feature) {
    case 'INTERVIEW':
      return (await prisma.interviewSession.count({ where })) > 0
    case 'FEYNMAN':
      return (await prisma.feynmanSession.count({ where })) > 0
    case 'ENGLISH':
      return (await prisma.englishSession.count({ where })) > 0
    case 'SUPPORT':
      return (await prisma.supportSession.count({ where })) > 0
  }
}

export async function POST(request: Request) {
  const user = await requireUser()
  // 204 rather than 401: this is fire-and-forget telemetry, often sent from a
  // page that is already unloading. There is nothing the client could do.
  if (!user) return new Response(null, { status: 204 })

  let body: Record<string, unknown>
  try {
    body = (await request.json()) as Record<string, unknown>
  } catch {
    return new Response(null, { status: 204 })
  }

  const feature = body.feature
  const sessionId = body.sessionId
  if (!isLiveFeature(feature) || typeof sessionId !== 'string' || !sessionId) {
    return new Response(null, { status: 204 })
  }

  if (!(await ownsSession(feature, sessionId, user.id))) {
    return new Response(null, { status: 204 })
  }

  const durationMs = clamp(body.durationMs, MAX_DURATION_MS)
  const promptTokens = clamp(body.promptTokens, MAX_TOKENS)
  const responseTokens = clamp(body.responseTokens, MAX_TOKENS)
  const totalTokens = clamp(body.totalTokens, MAX_TOKENS)

  // Which key minted this session's token. Null only if the attribution write
  // lost its race with the round ending — the usage still counts, it just lands
  // in the dashboard's unattributed bucket.
  const issued = await prisma.liveTokenIssue
    .findUnique({ where: { sessionId }, select: { keyId: true, model: true } })
    .catch(() => null)

  try {
    await recordAiUsageStrict({
      feature: feature as AiFeature,
      task: 'LIVE_SESSION',
      provider: 'GEMINI',
      keyId: issued?.keyId,
      model: issued?.model ?? LIVE_MODEL,
      success: true,
      // A live round is not one request, so per-call latency is meaningless here.
      // The wall clock lives in durationMs.
      latencyMs: 0,
      durationMs,
      tryIndex: 1,
      tokens: { promptTokens, responseTokens, totalTokens },
      tokensClientReported: true,
      sessionId,
      userId: user.id,
    })
  } catch (err) {
    // P2002 = the partial unique index caught a duplicate flush. That is the
    // index doing its job, not an error. Anything else is swallowed too: this
    // endpoint must never make a closing tab look broken.
    void err
  }

  return new Response(null, { status: 204 })
}
