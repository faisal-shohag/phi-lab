// Recording every AI call. Best-effort by design: telemetry must never be the
// reason a student's question fails, so writes are fire-and-forget and swallow
// their own errors.
//
// One row per provider call, including the ones that failed and were failed
// over. A dashboard built on only the successful calls would show a fleet that
// never has a bad day.
import { prisma } from '@/lib/prisma'
import type { AiErrorKind, AiProvider, AiTask } from '@/generated/prisma/client'

/** Context the caller threads through so a usage row knows what it was for. */
export interface AiCallContext {
  task: AiTask
  postId?: string
  userId?: string
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
  tokens?: TokenUsage
  confidence?: number
  errorKind?: AiErrorKind
  errorMessage?: string
}

export async function recordAiUsage(row: UsageRow): Promise<void> {
  try {
    await prisma.aiUsageEvent.create({
      data: {
        provider: row.provider,
        model: row.model,
        task: row.task,
        success: row.success,
        aiAttempt: row.aiAttempt ?? null,
        tryIndex: row.tryIndex,
        latencyMs: Math.round(row.latencyMs),
        promptTokens: row.tokens?.promptTokens ?? null,
        responseTokens: row.tokens?.responseTokens ?? null,
        totalTokens: row.tokens?.totalTokens ?? null,
        confidence: row.confidence ?? null,
        errorKind: row.errorKind ?? null,
        errorMessage: row.errorMessage?.slice(0, 500) ?? null,
        postId: row.postId ?? null,
        userId: row.userId ?? null,
      },
    })
  } catch {
    // Telemetry is never worth failing a request over.
  }
}
