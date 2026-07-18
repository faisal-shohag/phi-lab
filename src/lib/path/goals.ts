// Pure. Maps a learner's destination to the slice of the map their route runs
// through. The map (MODULES) is fixed; the goal only decides which modules the
// route and ETA are computed over. Nothing here reads the DB or mutates state —
// so it imports cleanly from a client component or a route handler.
//
// Keeping this a pure projection (goal → module id set) means switching goals is
// free: same map, same mastery, a different filter. No node is ever *lost* by
// narrowing the goal — a dropped module's nodes simply stop counting toward the
// ETA and stop appearing on the active route. Widen the goal again and they
// return exactly as they were.

import { MODULES, ALL_NODES, moduleOfNode, type PathNode } from './curriculum'

/** The three destinations. Mirrors the Prisma `PathGoal` enum. */
export type PathGoal = 'FRONTEND' | 'FULLSTACK' | 'INTERVIEW_PREP'

export const PATH_GOALS: { id: PathGoal; label: string; blurb: string }[] = [
  { id: 'FRONTEND', label: 'Front-end', blurb: 'HTML, CSS, JavaScript, React — the browser half of the job.' },
  { id: 'FULLSTACK', label: 'Full-stack', blurb: 'Everything, front to back. The default road.' },
  { id: 'INTERVIEW_PREP', label: 'Interview prep', blurb: 'The whole map, weighted toward the rounds you get grilled on.' },
]

// Which modules a goal routes through. FRONTEND stops before the backend module
// (Node/Mongo/Auth); the closing Job Ready gauntlet stays on every road because
// it is the finish line, not backend content. FULLSTACK and INTERVIEW_PREP cover
// the whole map — they differ only in how the route *weights* nodes, not which
// modules exist, so their module sets are identical here.
const GOAL_MODULES: Record<PathGoal, string[]> = {
  FRONTEND: ['foundations', 'thinking', 'javascript', 'async', 'web', 'react', 'job-ready'],
  FULLSTACK: MODULES.map((m) => m.id),
  INTERVIEW_PREP: MODULES.map((m) => m.id),
}

/** The module ids this goal's route runs through, in curriculum order. */
export function goalModuleIds(goal: PathGoal): string[] {
  return GOAL_MODULES[goal] ?? GOAL_MODULES.FULLSTACK
}

/** True when a node is on this goal's road (its module is included). */
export function nodeInGoal(nodeId: string, goal: PathGoal): boolean {
  const mod = moduleOfNode(nodeId)
  return !!mod && goalModuleIds(goal).includes(mod.id)
}

/** The nodes on this goal's road, in curriculum order. */
export function goalNodes(goal: PathGoal): PathNode[] {
  const ids = new Set(goalModuleIds(goal))
  return ALL_NODES.filter((n) => {
    const mod = moduleOfNode(n.id)
    return !!mod && ids.has(mod.id)
  })
}
