// Recording every AI call, platform-wide. Best-effort by design: telemetry must
// never be the reason a student's question fails, so writes are fire-and-forget
// and swallow their own errors.
//
// One row per provider call, including the ones that failed and were failed
// over. A dashboard built on only the successful calls would show a fleet that
// never has a bad day.
//
// Lived under src/lib/hive/usage.ts while Hive was the only instrumented
// surface. It now covers all six features, hence `feature` being required —
// an un-attributed row is invisible on the per-feature dashboard.
import { prisma } from '@/lib/prisma'
import type { AiErrorKind, AiFeature, AiProvider, AiTask } from '@/generated/prisma/client'

/** Context the caller threads through so a usage row knows what it was for. */
export interface AiCallContext {
  feature: AiFeature
  task: AiTask
  postId?: string
  userId?: string
  /** The lab session this call belongs to. Null for Hive. */
  sessionId?: string
  /** 1..3 on ANSWER calls. */
  aiAttempt?: number
}

/** Token counts, normalized across three providers that all name them differently. */
export interface TokenUsage {
  promptTokens?: number
  responseTokens?: number
  totalTokens?: number
}

export interface UsageRow extends AiCallContext {
  provider: AiProvider
  model: string
  success: boolean
  latencyMs: number
  /** Position in the failover chain: 1 = the first provider we tried. */
  tryIndex: number
  /** Wall clock of a live voice round. Distinct from latencyMs (one call). */
  durationMs?: number
  tokens?: TokenUsage
  /** True when the browser reported the counts. Untrusted; clamp before calling. */
  tokensClientReported?: boolean
  confidence?: number
  errorKind?: AiErrorKind
  errorMessage?: string
}

/**
 * Write the row and let failures surface. Only for callers that need to know —
 * e.g. the live-usage endpoint, which relies on a unique-constraint violation to
 * detect a duplicate flush. Prefer `recordAiUsage`.
 */
export async function recordAiUsageStrict(row: UsageRow): Promise<void> {
  await prisma.aiUsageEvent.create({
    data: {
      feature: row.feature,
      provider: row.provider,
      model: row.model,
      task: row.task,
      success: row.success,
      aiAttempt: row.aiAttempt ?? null,
      tryIndex: row.tryIndex,
      latencyMs: Math.round(row.latencyMs),
      durationMs: row.durationMs === undefined ? null : Math.round(row.durationMs),
      promptTokens: row.tokens?.promptTokens ?? null,
      responseTokens: row.tokens?.responseTokens ?? null,
      totalTokens: row.tokens?.totalTokens ?? null,
      tokensClientReported: row.tokensClientReported ?? false,
      confidence: row.confidence ?? null,
      errorKind: row.errorKind ?? null,
      errorMessage: row.errorMessage?.slice(0, 500) ?? null,
      postId: row.postId ?? null,
      userId: row.userId ?? null,
      sessionId: row.sessionId ?? null,
    },
  })
}

export async function recordAiUsage(row: UsageRow): Promise<void> {
  try {
    await recordAiUsageStrict(row)
  } catch {
    // Telemetry is never worth failing a request over.
  }
}
