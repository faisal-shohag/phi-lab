// Pure ICPC-lite contest scoring. No DB, no server-only marker — unit-tested in
// isolation and reused by the server standings query.

export interface AcceptedSubmission {
  userId: string
  problemId: string
  createdAt: Date
}

export interface ProblemPoints {
  problemId: string
  points: number
}

export interface ScoredEntry {
  userId: string
  points: number
  solved: number
  /** Time of the last first-solve, for the tie-break. Null if nothing solved. */
  lastAccept: Date | null
}

/**
 * Rank everyone with an accepted submission: total points over *distinctly*
 * solved problems descending, ties broken by the earliest last-solve time. Only
 * the first accept of a problem counts; later accepts and wrong tries are
 * ignored (no penalty). Submissions for problems not in `problems` are dropped.
 */
export function rankContest(problems: ProblemPoints[], accepted: AcceptedSubmission[]): ScoredEntry[] {
  const pointsByProblem = new Map(problems.map((p) => [p.problemId, p.points]))

  // Per (user, problem) keep the earliest accept.
  const firstAccept = new Map<string, Map<string, Date>>()
  for (const s of accepted) {
    if (!pointsByProblem.has(s.problemId)) continue
    let byProblem = firstAccept.get(s.userId)
    if (!byProblem) { byProblem = new Map(); firstAccept.set(s.userId, byProblem) }
    const prev = byProblem.get(s.problemId)
    if (!prev || s.createdAt < prev) byProblem.set(s.problemId, s.createdAt)
  }

  const scored: ScoredEntry[] = [...firstAccept.entries()].map(([userId, byProblem]) => {
    let points = 0
    let lastAccept: Date | null = null
    for (const [problemId, at] of byProblem) {
      points += pointsByProblem.get(problemId) ?? 0
      if (!lastAccept || at > lastAccept) lastAccept = at
    }
    return { userId, points, solved: byProblem.size, lastAccept }
  })

  scored.sort((a, b) =>
    b.points - a.points ||
    (a.lastAccept?.getTime() ?? 0) - (b.lastAccept?.getTime() ?? 0),
  )
  return scored
}
