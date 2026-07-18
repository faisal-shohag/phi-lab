// Pure. The navigator's arithmetic: given where the learner stands (node states),
// their pace (weekly hours) and destination (goal), how much road is left and
// when do they arrive. No DB, no writes — recomputed on every snapshot, so the
// ETA moves as the learner moves. That movement *is* the feature: a shrinking
// date after every mastered node.

import { nodeMinutes } from './curriculum'
import { goalNodes, type PathGoal } from './goals'
import type { NodeProgress } from './types'

// Listed step minutes assume a clean first-try run. Real learning loops: a failed
// challenge, a re-explain, a second interview. This multiplier turns "ideal
// minutes" into "honest minutes" so the ETA doesn't lie low. Deliberately modest
// — an encouraging-but-not-fantasy estimate.
const PRACTICE_MULTIPLIER = 1.6

/** Minutes of work left on this goal's road: unmastered nodes only. */
export function remainingMinutes(nodes: NodeProgress[], goal: PathGoal): number {
  const stateById = new Map(nodes.map((n) => [n.nodeId, n.state]))
  let total = 0
  for (const node of goalNodes(goal)) {
    if (stateById.get(node.id) === 'mastered') continue
    total += nodeMinutes(node)
  }
  return total
}

export interface PathEta {
  goal: PathGoal
  /** Whole weeks to the destination at the given pace, min 0. */
  weeks: number
  /** ISO date (YYYY-MM-DD) the learner is projected to finish. */
  targetDate: string
  /** Honest minutes of work remaining (after the practice multiplier). */
  remainingMinutes: number
  /** True once every node on the road is mastered — the destination is reached. */
  arrived: boolean
}

/**
 * The moving ETA. `now` is injectable so tests are deterministic and the server
 * and client agree on the same clock.
 */
export function pathEta(
  nodes: NodeProgress[],
  weeklyHours: number,
  goal: PathGoal,
  now: Date = new Date(),
): PathEta {
  const raw = remainingMinutes(nodes, goal)
  const honest = Math.round(raw * PRACTICE_MULTIPLIER)
  // Guard a nonsense pace: never divide by zero, floor at 1 hr/week.
  const perWeek = Math.max(1, weeklyHours) * 60
  const weeks = honest === 0 ? 0 : Math.ceil(honest / perWeek)

  const target = new Date(now)
  target.setUTCDate(target.getUTCDate() + weeks * 7)

  return {
    goal,
    weeks,
    targetDate: target.toISOString().slice(0, 10),
    remainingMinutes: honest,
    arrived: raw === 0,
  }
}
