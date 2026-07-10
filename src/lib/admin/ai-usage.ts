// Cross-feature AI usage aggregation — the headline of the admin dashboard.
//
// Read-only. Every number comes from the AiUsageEvent ledger. Sibling of
// src/lib/hive/analytics.ts, which stays Hive-scoped and is reused as-is for the
// /admin/hive page; this module is the platform-wide view.
//
// Returns plain numbers rather than chart-ready shapes: the dashboard decides
// how to draw them, this decides what's true.
import { prisma } from '@/lib/prisma'
import type { AiFeature, AiProvider, AiTask } from '@/generated/prisma/client'

export interface FeatureUsage {
  feature: AiFeature
  calls: number
  successes: number
  failures: number
  successRate: number
  avgLatencyMs: number
  promptTokens: number
  responseTokens: number
  totalTokens: number
  /** Wall-clock minutes of live voice, where the feature has any. */
  liveMinutes: number
  /** True when any of this feature's tokens were self-reported by a browser. */
  hasClientReportedTokens: boolean
}

export interface ProviderSlice {
  provider: AiProvider
  calls: number
  failures: number
  totalTokens: number
}

export interface TaskSlice {
  task: AiTask
  calls: number
  failures: number
  avgLatencyMs: number
  totalTokens: number
}

export interface ModelSlice {
  model: string
  calls: number
  totalTokens: number
}

/** One day, one feature. The trend chart pivots these into series. */
export interface TrendPoint {
  date: string
  feature: AiFeature
  calls: number
  tokens: number
}

export interface AiUsageSummary {
  since: string
  totals: {
    calls: number
    failures: number
    totalTokens: number
    /** Tokens the server observed itself. The rest were client-reported. */
    trustedTokens: number
    avgLatencyMs: number
  }
  features: FeatureUsage[]
  providers: ProviderSlice[]
  tasks: TaskSlice[]
  models: ModelSlice[]
  trend: TrendPoint[]
  recentErrors: {
    createdAt: string
    feature: AiFeature
    provider: AiProvider
    task: AiTask
    errorKind: string | null
    errorMessage: string | null
  }[]
}

/** Weighted mean of per-group averages. Averaging the averages would lie. */
function weightedAvg(rows: { avg: number | null; n: number }[]): number {
  const n = rows.reduce((acc, r) => acc + r.n, 0)
  if (!n) return 0
  return Math.round(rows.reduce((acc, r) => acc + (r.avg ?? 0) * r.n, 0) / n)
}

export async function aiUsageSummary(sinceDays = 30): Promise<AiUsageSummary> {
  const since = new Date(Date.now() - sinceDays * 24 * 60 * 60 * 1000)
  const window = { createdAt: { gte: since } }

  const [byFeature, byProvider, byTask, byModel, clientReported, liveDuration, trendRows, recentErrors] =
    await Promise.all([
      prisma.aiUsageEvent.groupBy({
        by: ['feature', 'success'],
        where: window,
        _count: { _all: true },
        _avg: { latencyMs: true },
        _sum: { totalTokens: true, promptTokens: true, responseTokens: true },
      }),
      prisma.aiUsageEvent.groupBy({
        by: ['provider', 'success'],
        where: window,
        _count: { _all: true },
        _sum: { totalTokens: true },
      }),
      prisma.aiUsageEvent.groupBy({
        by: ['task', 'success'],
        where: window,
        _count: { _all: true },
        _avg: { latencyMs: true },
        _sum: { totalTokens: true },
      }),
      prisma.aiUsageEvent.groupBy({
        by: ['model'],
        where: window,
        _count: { _all: true },
        _sum: { totalTokens: true },
      }),
      // Which features carry browser-reported token counts, and how many tokens
      // across the platform we did NOT observe ourselves.
      prisma.aiUsageEvent.groupBy({
        by: ['feature'],
        where: { ...window, tokensClientReported: true },
        _count: { _all: true },
        _sum: { totalTokens: true },
      }),
      prisma.aiUsageEvent.groupBy({
        by: ['feature'],
        where: { ...window, durationMs: { not: null } },
        _sum: { durationMs: true },
      }),
      // Prisma groupBy cannot bucket a timestamp by day, so this one drops to
      // SQL. Counts are cast to int because the pg adapter returns bigint for
      // count()/sum(), which JSON.stringify refuses to serialize.
      prisma.$queryRaw<{ date: Date; feature: AiFeature; calls: number; tokens: number }[]>`
        SELECT date_trunc('day', "createdAt") AS date,
               feature,
               count(*)::int AS calls,
               COALESCE(sum("totalTokens"), 0)::int AS tokens
        FROM ai_usage_event
        WHERE "createdAt" >= ${since}
        GROUP BY 1, 2
        ORDER BY 1 ASC
      `,
      prisma.aiUsageEvent.findMany({
        where: { ...window, success: false },
        orderBy: { createdAt: 'desc' },
        take: 25,
        select: {
          createdAt: true,
          feature: true,
          provider: true,
          task: true,
          errorKind: true,
          errorMessage: true,
        },
      }),
    ])

  const clientReportedFeatures = new Set(clientReported.map((r) => r.feature))
  const clientReportedTokens = clientReported.reduce((n, r) => n + (r._sum.totalTokens ?? 0), 0)
  const liveMsByFeature = new Map(liveDuration.map((r) => [r.feature, r._sum.durationMs ?? 0]))

  const featureIds = [...new Set(byFeature.map((r) => r.feature))]
  const features: FeatureUsage[] = featureIds
    .map((feature) => {
      const rows = byFeature.filter((r) => r.feature === feature)
      const successes = rows.filter((r) => r.success).reduce((n, r) => n + r._count._all, 0)
      const failures = rows.filter((r) => !r.success).reduce((n, r) => n + r._count._all, 0)
      const calls = successes + failures
      return {
        feature,
        calls,
        successes,
        failures,
        successRate: calls ? Math.round((successes / calls) * 100) : 0,
        avgLatencyMs: weightedAvg(rows.map((r) => ({ avg: r._avg.latencyMs, n: r._count._all }))),
        promptTokens: rows.reduce((n, r) => n + (r._sum.promptTokens ?? 0), 0),
        responseTokens: rows.reduce((n, r) => n + (r._sum.responseTokens ?? 0), 0),
        totalTokens: rows.reduce((n, r) => n + (r._sum.totalTokens ?? 0), 0),
        liveMinutes: Math.round((liveMsByFeature.get(feature) ?? 0) / 60_000),
        hasClientReportedTokens: clientReportedFeatures.has(feature),
      }
    })
    .sort((a, b) => b.calls - a.calls)

  const providerIds = [...new Set(byProvider.map((r) => r.provider))]
  const providers: ProviderSlice[] = providerIds
    .map((provider) => {
      const rows = byProvider.filter((r) => r.provider === provider)
      return {
        provider,
        calls: rows.reduce((n, r) => n + r._count._all, 0),
        failures: rows.filter((r) => !r.success).reduce((n, r) => n + r._count._all, 0),
        totalTokens: rows.reduce((n, r) => n + (r._sum.totalTokens ?? 0), 0),
      }
    })
    .sort((a, b) => b.calls - a.calls)

  const taskIds = [...new Set(byTask.map((r) => r.task))]
  const tasks: TaskSlice[] = taskIds
    .map((task) => {
      const rows = byTask.filter((r) => r.task === task)
      return {
        task,
        calls: rows.reduce((n, r) => n + r._count._all, 0),
        failures: rows.filter((r) => !r.success).reduce((n, r) => n + r._count._all, 0),
        avgLatencyMs: weightedAvg(rows.map((r) => ({ avg: r._avg.latencyMs, n: r._count._all }))),
        totalTokens: rows.reduce((n, r) => n + (r._sum.totalTokens ?? 0), 0),
      }
    })
    .sort((a, b) => b.calls - a.calls)

  const totalCalls = features.reduce((n, f) => n + f.calls, 0)
  const totalTokens = features.reduce((n, f) => n + f.totalTokens, 0)

  return {
    since: since.toISOString(),
    totals: {
      calls: totalCalls,
      failures: features.reduce((n, f) => n + f.failures, 0),
      totalTokens,
      trustedTokens: totalTokens - clientReportedTokens,
      avgLatencyMs: weightedAvg(byFeature.map((r) => ({ avg: r._avg.latencyMs, n: r._count._all }))),
    },
    features,
    providers,
    tasks,
    models: byModel
      .map((r) => ({ model: r.model, calls: r._count._all, totalTokens: r._sum.totalTokens ?? 0 }))
      .sort((a, b) => b.calls - a.calls),
    trend: trendRows.map((r) => ({
      date: r.date.toISOString().slice(0, 10),
      feature: r.feature,
      calls: Number(r.calls),
      tokens: Number(r.tokens),
    })),
    recentErrors: recentErrors.map((e) => ({
      createdAt: e.createdAt.toISOString(),
      feature: e.feature,
      provider: e.provider,
      task: e.task,
      errorKind: e.errorKind,
      errorMessage: e.errorMessage,
    })),
  }
}
