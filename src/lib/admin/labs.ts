// What the labs are actually doing — usage over a window, and what is running
// right now. Read-only; everything is derivable from tables that already exist.
//
// This is the deeper cousin of the "Lab engagement" card on the overview
// (platformMetrics() in metrics.ts). That card counts only COMPLETED and FAILED
// by name and folds every other status into an unlabelled total, which means the
// two numbers an operator most needs are invisible there: how many learners walk
// out mid-round (ABANDONED), and how many are in one right now (IN_PROGRESS). It
// also has no notion of JS Motion, which appears in no admin metric at all.
//
// Scores and durations are the same story: every session stores overallScore /
// clarityScore and startedAt/endedAt, and nothing has ever read them.
import { prisma } from '@/lib/prisma'
import { getSettings } from '@/lib/admin/settings'
import { HEARTBEAT_STALE_MS } from '@/lib/support/prompt'

/** The five session-shaped labs. JS Motion is challenge-shaped and reported apart. */
export type LabName = 'Interview' | 'Feynman' | 'English' | 'Support' | 'Analogies'

export interface LabUsage {
  lab: LabName
  sessions: number
  completed: number
  failed: number
  /** Walked out mid-round. The number the overview card silently swallows. */
  abandoned: number
  /** Still running (or wedged) at the moment of the query. */
  inProgress: number
  completionRate: number
  abandonRate: number
  /** Mean score of graded rounds; Support reports its 1-5 rating. Null when none. */
  avgScore: number | null
  /** Mean wall-clock of a COMPLETED round. Null when nothing has completed. */
  avgDurationMs: number | null
}

export interface ChallengeUsage {
  attempts: number
  won: number
  lost: number
  active: number
  winRate: number
  /** XP the learners put on the line, and what came back. */
  xpStaked: number
  xpWon: number
  hintsUsed: number
  byDifficulty: { difficulty: string; attempts: number; won: number }[]
}

/** One day, one lab. The chart pivots these into stacked series. */
export interface LabTrendPoint {
  date: string
  lab: string
  sessions: number
}

export interface LabsUsage {
  since: string
  labs: LabUsage[]
  challenges: ChallengeUsage
  trend: LabTrendPoint[]
}

function rate(part: number, total: number): number {
  return total ? Math.round((part / total) * 100) : 0
}

/** Mean of a nullable Prisma _avg, rounded to one decimal. */
function avg(value: number | null): number | null {
  return value === null ? null : Math.round(value * 10) / 10
}

/**
 * Fold a groupBy(['status']) result into a LabUsage.
 *
 * Exported for the unit test: this is the logic the overview's gradedLab() gets
 * wrong by omission, so it is the part worth pinning.
 */
export function foldStatuses(
  lab: LabName,
  rows: { status: string; _count: { _all: number } }[],
  names: { completed: string; failed: string; abandoned: string; inProgress: string[] },
  extras: { avgScore?: number | null; avgDurationMs?: number | null } = {},
): LabUsage {
  const n = (s: string) => rows.find((r) => r.status === s)?._count._all ?? 0
  const sessions = rows.reduce((acc, r) => acc + r._count._all, 0)
  const completed = n(names.completed)
  const abandoned = n(names.abandoned)
  return {
    lab,
    sessions,
    completed,
    failed: n(names.failed),
    abandoned,
    inProgress: names.inProgress.reduce((acc, s) => acc + n(s), 0),
    completionRate: rate(completed, sessions),
    abandonRate: rate(abandoned, sessions),
    avgScore: extras.avgScore ?? null,
    avgDurationMs: extras.avgDurationMs ?? null,
  }
}

/** Rows the duration query hands back, one per lab that has completed anything. */
interface DurationRow {
  lab: string
  ms: number | null
}

export async function labsUsage(sinceDays = 30): Promise<LabsUsage> {
  const since = new Date(Date.now() - sinceDays * 24 * 60 * 60 * 1000)
  const window = { createdAt: { gte: since } }

  const [
    interview,
    feynman,
    english,
    support,
    analogies,
    interviewScore,
    feynmanScore,
    englishScore,
    supportRating,
    challengeStatus,
    challengeTotals,
    challengeDifficulty,
    durations,
    trendRows,
  ] = await Promise.all([
    prisma.interviewSession.groupBy({ by: ['status'], where: window, _count: { _all: true } }),
    prisma.feynmanSession.groupBy({ by: ['status'], where: window, _count: { _all: true } }),
    prisma.englishSession.groupBy({ by: ['status'], where: window, _count: { _all: true } }),
    prisma.supportSession.groupBy({ by: ['status'], where: window, _count: { _all: true } }),
    prisma.analogyCard.count({ where: window }),

    // Scores: only graded rounds carry one, so a null average means "none graded
    // yet", not "everyone scored zero".
    prisma.interviewSession.aggregate({ where: { ...window, overallScore: { not: null } }, _avg: { overallScore: true } }),
    prisma.feynmanSession.aggregate({ where: { ...window, clarityScore: { not: null } }, _avg: { clarityScore: true } }),
    prisma.englishSession.aggregate({ where: { ...window, overallScore: { not: null } }, _avg: { overallScore: true } }),
    prisma.supportSession.aggregate({ where: { ...window, rating: { not: null } }, _avg: { rating: true } }),

    prisma.challengeAttempt.groupBy({ by: ['status'], where: window, _count: { _all: true } }),
    prisma.challengeAttempt.aggregate({
      where: window,
      _sum: { stake: true, wonXp: true, hintsUsed: true },
      _count: { _all: true },
    }),
    prisma.challengeAttempt.groupBy({ by: ['difficulty', 'status'], where: window, _count: { _all: true } }),

    // Duration and the day buckets need raw SQL — Prisma can't average an interval
    // or date_trunc. Same precedent (and the same ::int cast, because the pg
    // adapter returns bigint for count(), which JSON.stringify refuses) as the
    // signups query in metrics.ts and the trend query in ai-usage.ts.
    //
    // COMPLETED only: an abandoned round's "duration" is just how long the tab sat
    // open before the sweep found it, and averaging that in would quietly make
    // every lab look longer than it is.
    prisma.$queryRaw<DurationRow[]>`
      SELECT 'Interview' AS lab,
             avg(extract(epoch FROM ("endedAt" - "startedAt")) * 1000) AS ms
        FROM interview_session
       WHERE "createdAt" >= ${since} AND status = 'COMPLETED' AND "endedAt" IS NOT NULL
      UNION ALL
      SELECT 'Feynman',
             avg(extract(epoch FROM ("endedAt" - "startedAt")) * 1000)
        FROM feynman_session
       WHERE "createdAt" >= ${since} AND status = 'COMPLETED' AND "endedAt" IS NOT NULL
      UNION ALL
      SELECT 'English',
             avg(extract(epoch FROM ("endedAt" - "startedAt")) * 1000)
        FROM english_session
       WHERE "createdAt" >= ${since} AND status = 'COMPLETED' AND "endedAt" IS NOT NULL
      UNION ALL
      SELECT 'Support',
             avg(extract(epoch FROM ("endedAt" - "startedAt")) * 1000)
        FROM support_session
       WHERE "createdAt" >= ${since} AND status = 'completed'
         AND "endedAt" IS NOT NULL AND "startedAt" IS NOT NULL
    `,

    prisma.$queryRaw<{ date: Date; lab: string; sessions: number }[]>`
      SELECT date_trunc('day', "createdAt") AS date, 'Interview' AS lab, count(*)::int AS sessions
        FROM interview_session WHERE "createdAt" >= ${since} GROUP BY 1
      UNION ALL
      SELECT date_trunc('day', "createdAt"), 'Feynman', count(*)::int
        FROM feynman_session WHERE "createdAt" >= ${since} GROUP BY 1
      UNION ALL
      SELECT date_trunc('day', "createdAt"), 'English', count(*)::int
        FROM english_session WHERE "createdAt" >= ${since} GROUP BY 1
      UNION ALL
      SELECT date_trunc('day', "createdAt"), 'Support', count(*)::int
        FROM support_session WHERE "createdAt" >= ${since} GROUP BY 1
      UNION ALL
      SELECT date_trunc('day', "createdAt"), 'Analogies', count(*)::int
        FROM analogy_card WHERE "createdAt" >= ${since} GROUP BY 1
      UNION ALL
      SELECT date_trunc('day', "createdAt"), 'JS Motion', count(*)::int
        FROM challenge_attempt WHERE "createdAt" >= ${since} GROUP BY 1
      ORDER BY 1 ASC
    `,
  ])

  const durationOf = (lab: string): number | null => {
    const ms = durations.find((d) => d.lab === lab)?.ms
    return ms === null || ms === undefined ? null : Math.round(Number(ms))
  }

  // The three graded labs share the InterviewStatus enum.
  const GRADED = { completed: 'COMPLETED', failed: 'FAILED', abandoned: 'ABANDONED', inProgress: ['IN_PROGRESS'] }

  const labs: LabUsage[] = [
    foldStatuses('Interview', interview, GRADED, {
      avgScore: avg(interviewScore._avg.overallScore),
      avgDurationMs: durationOf('Interview'),
    }),
    foldStatuses('Feynman', feynman, GRADED, {
      avgScore: avg(feynmanScore._avg.clarityScore),
      avgDurationMs: durationOf('Feynman'),
    }),
    foldStatuses('English', english, GRADED, {
      avgScore: avg(englishScore._avg.overallScore),
      avgDurationMs: durationOf('English'),
    }),
    // Support has its own lowercase vocabulary, and two live states: a learner in
    // the queue is as much "in progress" as one in the call.
    foldStatuses(
      'Support',
      support,
      { completed: 'completed', failed: 'failed', abandoned: 'abandoned', inProgress: ['active', 'waiting'] },
      { avgScore: avg(supportRating._avg.rating), avgDurationMs: durationOf('Support') },
    ),
    // Analogies are one-shot: a created card is a completed card. No status column
    // exists to fold, so it is stated directly rather than faked through one.
    {
      lab: 'Analogies',
      sessions: analogies,
      completed: analogies,
      failed: 0,
      abandoned: 0,
      inProgress: 0,
      completionRate: analogies ? 100 : 0,
      abandonRate: 0,
      avgScore: null,
      avgDurationMs: null,
    },
  ]

  const challengeN = (s: string) => challengeStatus.find((r) => r.status === s)?._count._all ?? 0
  const won = challengeN('won')
  const settled = won + challengeN('lost')

  const difficulties = [...new Set(challengeDifficulty.map((r) => r.difficulty))]
  const challenges: ChallengeUsage = {
    attempts: challengeTotals._count._all,
    won,
    lost: challengeN('lost'),
    active: challengeN('active'),
    // Of the attempts that actually finished. Counting still-running ones as
    // losses would make the rate drift down every time someone starts a challenge.
    winRate: rate(won, settled),
    xpStaked: challengeTotals._sum.stake ?? 0,
    xpWon: challengeTotals._sum.wonXp ?? 0,
    hintsUsed: challengeTotals._sum.hintsUsed ?? 0,
    byDifficulty: difficulties
      .map((difficulty) => {
        const rows = challengeDifficulty.filter((r) => r.difficulty === difficulty)
        return {
          difficulty,
          attempts: rows.reduce((acc, r) => acc + r._count._all, 0),
          won: rows.find((r) => r.status === 'won')?._count._all ?? 0,
        }
      })
      .sort((a, b) => b.attempts - a.attempts),
  }

  return {
    since: since.toISOString(),
    labs,
    challenges,
    trend: trendRows.map((r) => ({
      date: r.date.toISOString().slice(0, 10),
      lab: r.lab,
      sessions: Number(r.sessions),
    })),
  }
}

// ── The monitor ───────────────────────────────────────────────────────────

export interface LiveSession {
  id: string
  lab: LabName
  feature: 'INTERVIEW' | 'FEYNMAN' | 'ENGLISH' | 'SUPPORT'
  userId: string
  userName: string | null
  userEmail: string | null
  /** Topic / concept / scenario / support category — what they're actually doing. */
  subject: string
  startedAt: string
  elapsedMs: number
  /** Support only: place in the queue, 1-based. */
  queuePosition?: number
  /** Waiting in the Support queue rather than in a call. */
  waiting?: boolean
  /** Past its round length (or heartbeat-stale) — almost certainly a dead tab. */
  stale: boolean
}

/**
 * Everything running right now.
 *
 * "Right now" is bounded at two hours, matching STALE_AFTER_MS in labs/sweep.ts:
 * a round older than that is not a learner, it is garbage the cron has not reaped
 * yet, and listing it as live would make the monitor lie. The `stale` flag is the
 * softer signal — past its own round length, so almost certainly a closed tab —
 * and it is what an admin acts on with force-end.
 */
export async function liveLabSessions(): Promise<LiveSession[]> {
  const now = Date.now()
  const cutoff = new Date(now - 2 * 60 * 60 * 1000)
  const user = { select: { id: true, name: true, email: true } }

  const [settings, interview, feynman, english, support] = await Promise.all([
    getSettings(),
    prisma.interviewSession.findMany({
      where: { status: 'IN_PROGRESS', startedAt: { gte: cutoff } },
      select: { id: true, topic: true, startedAt: true, user },
      orderBy: { startedAt: 'asc' },
    }),
    prisma.feynmanSession.findMany({
      where: { status: 'IN_PROGRESS', startedAt: { gte: cutoff } },
      select: { id: true, concept: true, startedAt: true, user },
      orderBy: { startedAt: 'asc' },
    }),
    prisma.englishSession.findMany({
      where: { status: 'IN_PROGRESS', startedAt: { gte: cutoff } },
      select: { id: true, scenario: true, startedAt: true, user },
      orderBy: { startedAt: 'asc' },
    }),
    prisma.supportSession.findMany({
      where: { status: { in: ['waiting', 'active'] }, createdAt: { gte: cutoff } },
      select: {
        id: true, category: true, problem: true, status: true,
        startedAt: true, createdAt: true, lastSeenAt: true, user,
      },
      orderBy: { createdAt: 'asc' }, // FIFO — this is the queue order
    }),
  ])

  const graded = (
    lab: LabName,
    feature: LiveSession['feature'],
    roundSeconds: number,
    rows: { id: string; startedAt: Date; user: { id: string; name: string | null; email: string | null } }[],
    subjectOf: (row: never) => string,
  ): LiveSession[] =>
    rows.map((row) => {
      const elapsedMs = now - row.startedAt.getTime()
      return {
        id: row.id,
        lab,
        feature,
        userId: row.user.id,
        userName: row.user.name,
        userEmail: row.user.email,
        subject: subjectOf(row as never) || '—',
        startedAt: row.startedAt.toISOString(),
        elapsedMs,
        // Its own round is over and it never reported a result: the tab is gone.
        stale: elapsedMs > roundSeconds * 1000,
      }
    })

  const sessions: LiveSession[] = [
    ...graded('Interview', 'INTERVIEW', settings['lab.interview.roundSeconds'], interview,
      (r: { topic: string }) => r.topic),
    ...graded('Feynman', 'FEYNMAN', settings['lab.feynman.roundSeconds'], feynman,
      (r: { concept: string }) => r.concept),
    ...graded('English', 'ENGLISH', settings['lab.english.roundSeconds'], english,
      (r: { scenario: string }) => r.scenario),
  ]

  let position = 0
  for (const row of support) {
    const waiting = row.status === 'waiting'
    if (waiting) position += 1
    // A waiting session has no startedAt (it is set on promotion), so its clock
    // runs from when it joined the queue.
    const from = (row.startedAt ?? row.createdAt).getTime()
    sessions.push({
      id: row.id,
      lab: 'Support',
      feature: 'SUPPORT',
      userId: row.user.id,
      userName: row.user.name,
      userEmail: row.user.email,
      subject: row.category || row.problem.slice(0, 60) || '—',
      startedAt: new Date(from).toISOString(),
      elapsedMs: now - from,
      queuePosition: waiting ? position : undefined,
      waiting,
      // Support is the one lab that heartbeats (the queue poll), so staleness is
      // measurable rather than inferred: no heartbeat means the tab is gone, and
      // if it holds an active slot it is blocking whoever is next.
      stale: waiting
        ? now - row.lastSeenAt.getTime() > HEARTBEAT_STALE_MS
        : now - from > settings['lab.support.roundSeconds'] * 1000,
    })
  }

  return sessions.sort((a, b) => b.elapsedMs - a.elapsedMs)
}
