// Growth and engagement aggregates for the admin overview. Read-only; all of it
// is derivable from tables that already exist, so nothing here needed a schema
// change.
//
// DAU/WAU come from the Session table rather than a bespoke events table: a row
// is written per sign-in, and `updatedAt` moves as the session is used. It is a
// proxy for "active", not a page-view metric, and it undercounts a user who
// stays signed in without a session refresh. Named honestly for that reason.
import { prisma } from '@/lib/prisma'
import type { Role } from '@/generated/prisma/client'

export interface LabEngagement {
  lab: 'Interview' | 'Feynman' | 'English' | 'Support' | 'Analogies'
  sessions: number
  completed: number
  failed: number
  completionRate: number
}

export interface SignupPoint {
  date: string
  signups: number
}

export interface PlatformMetrics {
  since: string
  users: {
    total: number
    suspended: number
    newInWindow: number
    byRole: { role: Role; count: number }[]
  }
  active: {
    /** Distinct users with a session touched in the last 24h / 7d. */
    daily: number
    weekly: number
  }
  signups: SignupPoint[]
  labs: LabEngagement[]
  hive: {
    questions: number
    openEscalations: number
  }
  support: {
    queueDepth: number
    activeNow: number
    avgRating: number | null
  }
}

function rate(completed: number, total: number): number {
  return total ? Math.round((completed / total) * 100) : 0
}

export async function platformMetrics(sinceDays = 30): Promise<PlatformMetrics> {
  const since = new Date(Date.now() - sinceDays * 24 * 60 * 60 * 1000)
  const dayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000)
  const weekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000)
  const window = { createdAt: { gte: since } }

  const [
    totalUsers,
    suspendedUsers,
    newUsers,
    byRole,
    dau,
    wau,
    signupRows,
    interview,
    feynman,
    english,
    support,
    analogies,
    questions,
    openEscalations,
    supportQueue,
    supportActive,
    supportRating,
  ] = await Promise.all([
    prisma.user.count(),
    prisma.user.count({ where: { suspendedAt: { not: null } } }),
    prisma.user.count({ where: window }),
    prisma.user.groupBy({ by: ['role'], _count: { _all: true } }),
    prisma.session.findMany({ where: { updatedAt: { gte: dayAgo } }, select: { userId: true }, distinct: ['userId'] }),
    prisma.session.findMany({ where: { updatedAt: { gte: weekAgo } }, select: { userId: true }, distinct: ['userId'] }),
    // Bucketed by day — Prisma groupBy can't date_trunc. int cast because the pg
    // adapter hands back bigint for count().
    prisma.$queryRaw<{ date: Date; signups: number }[]>`
      SELECT date_trunc('day', "createdAt") AS date, count(*)::int AS signups
      FROM "user" WHERE "createdAt" >= ${since}
      GROUP BY 1 ORDER BY 1 ASC
    `,
    prisma.interviewSession.groupBy({ by: ['status'], where: window, _count: { _all: true } }),
    prisma.feynmanSession.groupBy({ by: ['status'], where: window, _count: { _all: true } }),
    prisma.englishSession.groupBy({ by: ['status'], where: window, _count: { _all: true } }),
    prisma.supportSession.groupBy({ by: ['status'], where: window, _count: { _all: true } }),
    prisma.analogyCard.count({ where: window }),
    prisma.hivePost.count({ where: { type: 'QUESTION', ...window } }),
    prisma.hivePost.count({ where: { status: 'ESCALATED' } }),
    prisma.supportSession.count({ where: { status: 'waiting' } }),
    prisma.supportSession.count({ where: { status: 'active' } }),
    prisma.supportSession.aggregate({ where: { rating: { not: null } }, _avg: { rating: true } }),
  ])

  /** The three graded labs share the InterviewStatus enum. */
  const gradedLab = (
    lab: LabEngagement['lab'],
    rows: { status: string; _count: { _all: number } }[],
  ): LabEngagement => {
    const n = (s: string) => rows.find((r) => r.status === s)?._count._all ?? 0
    const completed = n('COMPLETED')
    const failed = n('FAILED')
    const sessions = rows.reduce((acc, r) => acc + r._count._all, 0)
    return { lab, sessions, completed, failed, completionRate: rate(completed, sessions) }
  }

  // Support uses its own lowercase status vocabulary, not InterviewStatus.
  const supportSessions = support.reduce((acc, r) => acc + r._count._all, 0)
  const supportCompleted = support.find((r) => r.status === 'completed')?._count._all ?? 0
  const supportAbandoned = support.find((r) => r.status === 'abandoned')?._count._all ?? 0

  return {
    since: since.toISOString(),
    users: {
      total: totalUsers,
      suspended: suspendedUsers,
      newInWindow: newUsers,
      byRole: byRole.map((r) => ({ role: r.role, count: r._count._all })),
    },
    active: { daily: dau.length, weekly: wau.length },
    signups: signupRows.map((r) => ({ date: r.date.toISOString().slice(0, 10), signups: Number(r.signups) })),
    labs: [
      gradedLab('Interview', interview),
      gradedLab('Feynman', feynman),
      gradedLab('English', english),
      {
        lab: 'Support',
        sessions: supportSessions,
        completed: supportCompleted,
        failed: supportAbandoned,
        completionRate: rate(supportCompleted, supportSessions),
      },
      // Analogies are one-shot: a created card is a completed card.
      { lab: 'Analogies', sessions: analogies, completed: analogies, failed: 0, completionRate: analogies ? 100 : 0 },
    ],
    hive: { questions, openEscalations },
    support: {
      queueDepth: supportQueue,
      activeNow: supportActive,
      avgRating: supportRating._avg.rating ? Math.round(supportRating._avg.rating * 10) / 10 : null,
    },
  }
}
