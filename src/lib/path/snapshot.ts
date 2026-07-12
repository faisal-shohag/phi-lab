// Server-only. Assembles the full PathSnapshot the /path page renders: syncs
// progress (banking any freshly-mastered nodes), pulls today's quest, and reads
// the cached weekly report. One entry point so the page and the refresh route
// agree on exactly what "the path right now" means.

import { syncPath, activeNodeId, levelHeader, TOTAL_NODES } from './progress'
import { getQuest } from './quest'
import { getWeeklyReport } from './weekly'
import type { PathSnapshot } from './types'

export async function getPathSnapshot(userId: string): Promise<PathSnapshot> {
  // syncPath first: it may bank nodes and award XP, which the header must reflect.
  const sync = await syncPath(userId)
  const [quest, report, header] = await Promise.all([
    getQuest(userId),
    getWeeklyReport(userId),
    levelHeader(userId),
  ])

  return {
    nodes: sync.nodes,
    masteredCount: sync.nodes.filter((n) => n.state === 'mastered').length,
    totalNodes: TOTAL_NODES,
    activeNodeId: activeNodeId(sync.nodes),
    quest,
    report,
    xp: header.xp,
    level: header.level,
    levelTitle: header.levelTitle,
  }
}
