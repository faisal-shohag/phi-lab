// Aggregations for the admin dashboard. Read-only; every number here comes from
// the AiUsageEvent ledger or the denormalized outcome columns on HivePost.
//
// Deliberately returns plain numbers rather than chart-ready shapes: the
// dashboard decides how to draw them, this decides what's true.
import { prisma } from '@/lib/prisma'
import type { AiProvider, AiTask, AiErrorKind } from '@/generated/prisma/client'

export interface ProviderUsage {
  provider: AiProvider
  calls: number
  successes: number
  failures: number
  successRate: number
  /** Calls where this provider was not the first choice — i.e. it caught a failover. */
  rescues: number
  avgLatencyMs: number
  totalTokens: number
}

export interface TaskUsage {
  task: AiTask
  calls: number
  failures: number
  avgLatencyMs: number
  totalTokens: number
}

export interface ErrorBucket {
  errorKind: AiErrorKind
  count: number
}

export interface RecentError {
  createdAt: string
  provider: AiProvider
  task: AiTask
  errorKind: AiErrorKind | null
  errorMessage: string | null
  postId: string | null
}

export interface HandoverStats {
  /** AI wrote at least one answer, then a human took over. */
  partialHandovers: number
  /** AI never answered: sensitive topic, "need a human", or generation failed outright. */
  directHandovers: number
  /** Currently sitting with a mentor. */
  openEscalations: number
}

export interface ResolutionStats {
  resolvedByAi: number
  resolvedByPeer: number
  resolvedByMentor: number
  unresolved: number
}

export interface HiveAnalytics {
  since: string
  totals: {
    aiCalls: number
    aiFailures: number
    totalTokens: number
    questionsCreated: number
  }
  providers: ProviderUsage[]
  tasks: TaskUsage[]
  errorsByKind: ErrorBucket[]
  recentErrors: RecentError[]
  handovers: HandoverStats
  resolutions: ResolutionStats
}

export async function hiveAnalytics(sinceDays = 30): Promise<HiveAnalytics> {
  const since = new Date(Date.now() - sinceDays * 24 * 60 * 60 * 1000)
  const window = { createdAt: { gte: since } }

  const [
    byProvider,
    rescuesByProvider,
    byTask,
    byError,
    recentErrors,
    totals,
    questionsCreated,
    escalations,
    resolutions,
    openEscalations,
  ] = await Promise.all([
    prisma.aiUsageEvent.groupBy({
      by: ['provider', 'success'],
      where: window,
      _count: { _all: true },
      _avg: { latencyMs: true },
      _sum: { totalTokens: true },
    }),
    // tryIndex > 1 means an earlier provider failed and this one picked it up.
    prisma.aiUsageEvent.groupBy({
      by: ['provider'],
      where: { ...window, success: true, tryIndex: { gt: 1 } },
      _count: { _all: true },
    }),
    prisma.aiUsageEvent.groupBy({
      by: ['task', 'success'],
      where: window,
      _count: { _all: true },
      _avg: { latencyMs: true },
      _sum: { totalTokens: true },
    }),
    prisma.aiUsageEvent.groupBy({
      by: ['errorKind'],
      where: { ...window, success: false },
      _count: { _all: true },
    }),
    prisma.aiUsageEvent.findMany({
      where: { ...window, success: false },
      orderBy: { createdAt: 'desc' },
      take: 25,
      select: { createdAt: true, provider: true, task: true, errorKind: true, errorMessage: true, postId: true },
    }),
    prisma.aiUsageEvent.aggregate({
      where: window,
      _count: { _all: true },
      _sum: { totalTokens: true },
    }),
    prisma.hivePost.count({ where: { type: 'QUESTION', ...window } }),
    // Every post ever handed to a human, split by whether the AI had answered.
    prisma.hivePost.groupBy({
      by: ['escalatedAfterAiReplies'],
      where: { escalatedAt: { not: null } },
      _count: { _all: true },
    }),
    prisma.hivePost.groupBy({
      by: ['resolvedBy'],
      where: { type: 'QUESTION' },
      _count: { _all: true },
    }),
    prisma.hivePost.count({ where: { status: 'ESCALATED' } }),
  ])

  const aiFailures = byProvider.filter((r) => !r.success).reduce((n, r) => n + r._count._all, 0)

  const rescueMap = new Map(rescuesByProvider.map((r) => [r.provider, r._count._all]))
  const providerIds = [...new Set(byProvider.map((r) => r.provider))]
  const providers: ProviderUsage[] = providerIds.map((provider) => {
    const rows = byProvider.filter((r) => r.provider === provider)
    const successes = rows.filter((r) => r.success).reduce((n, r) => n + r._count._all, 0)
    const failures = rows.filter((r) => !r.success).reduce((n, r) => n + r._count._all, 0)
    const calls = successes + failures
    // Average the per-group averages, weighted by the calls behind each.
    const latency = rows.reduce((n, r) => n + (r._avg.latencyMs ?? 0) * r._count._all, 0)
    return {
      provider,
      calls,
      successes,
      failures,
      successRate: calls ? Math.round((successes / calls) * 100) : 0,
      rescues: rescueMap.get(provider) ?? 0,
      avgLatencyMs: calls ? Math.round(latency / calls) : 0,
      totalTokens: rows.reduce((n, r) => n + (r._sum.totalTokens ?? 0), 0),
    }
  })

  const taskIds = [...new Set(byTask.map((r) => r.task))]
  const tasks: TaskUsage[] = taskIds.map((task) => {
    const rows = byTask.filter((r) => r.task === task)
    const calls = rows.reduce((n, r) => n + r._count._all, 0)
    const latency = rows.reduce((n, r) => n + (r._avg.latencyMs ?? 0) * r._count._all, 0)
    return {
      task,
      calls,
      failures: rows.filter((r) => !r.success).reduce((n, r) => n + r._count._all, 0),
      avgLatencyMs: calls ? Math.round(latency / calls) : 0,
      totalTokens: rows.reduce((n, r) => n + (r._sum.totalTokens ?? 0), 0),
    }
  })

  // 0 AI replies before the hand-off = the AI never got to try.
  const directHandovers = escalations
    .filter((r) => (r.escalatedAfterAiReplies ?? 0) === 0)
    .reduce((n, r) => n + r._count._all, 0)
  const partialHandovers = escalations
    .filter((r) => (r.escalatedAfterAiReplies ?? 0) > 0)
    .reduce((n, r) => n + r._count._all, 0)

  const resolvedCount = (who: 'AI' | 'PEER' | 'MENTOR') =>
    resolutions.find((r) => r.resolvedBy === who)?._count._all ?? 0

  return {
    since: since.toISOString(),
    totals: {
      aiCalls: totals._count._all,
      aiFailures,
      totalTokens: totals._sum.totalTokens ?? 0,
      questionsCreated,
    },
    providers: providers.sort((a, b) => b.calls - a.calls),
    tasks: tasks.sort((a, b) => b.calls - a.calls),
    errorsByKind: byError
      .filter((r): r is typeof r & { errorKind: AiErrorKind } => r.errorKind !== null)
      .map((r) => ({ errorKind: r.errorKind, count: r._count._all }))
      .sort((a, b) => b.count - a.count),
    recentErrors: recentErrors.map((e) => ({
      createdAt: e.createdAt.toISOString(),
      provider: e.provider,
      task: e.task,
      errorKind: e.errorKind,
      errorMessage: e.errorMessage,
      postId: e.postId,
    })),
    handovers: { partialHandovers, directHandovers, openEscalations },
    resolutions: {
      resolvedByAi: resolvedCount('AI'),
      resolvedByPeer: resolvedCount('PEER'),
      resolvedByMentor: resolvedCount('MENTOR'),
      unresolved: resolutions.find((r) => r.resolvedBy === null)?._count._all ?? 0,
    },
  }
}
