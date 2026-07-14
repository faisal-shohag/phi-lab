// Server-only. Which Bug Hunt levels a learner has fixed, read from the XP
// ledger — same as the problem catalog, there is no "solved" flag to forge.
//
// Kept apart from problems-progress.ts on purpose: bug fixes do not count
// toward the Challenge gate, and merging the two would make it far too easy to
// let them start counting by accident.
import 'server-only'

import { prisma } from '@/lib/prisma'
import { BUG_LEVELS, TOTAL_BUGS } from './bugs'
import { bugFixXp } from '../gamification/reasons'

export interface BugProgress {
  completedIds: string[]
  completed: number
  total: number
  /** XP still on the table across the levels not yet fixed. */
  xpRemaining: number
}

export async function getBugProgress(userId: string): Promise<BugProgress> {
  const events = await prisma.xpEvent.findMany({
    where: { userId, reason: 'viz_bug_fixed' },
    select: { sourceId: true },
  })

  const fixed = new Set<string>()
  for (const e of events) {
    if (e.sourceId.startsWith('bug:')) fixed.add(e.sourceId.slice('bug:'.length))
  }

  // Ignore receipts for levels that have since been retired.
  const known = new Set(BUG_LEVELS.map((b) => b.id))
  const completedIds = [...fixed].filter((id) => known.has(id))

  const done = new Set(completedIds)
  const xpRemaining = BUG_LEVELS
    .filter((b) => !done.has(b.id))
    .reduce((sum, b) => sum + bugFixXp(b.difficulty), 0)

  return {
    completedIds,
    completed: completedIds.length,
    total: TOTAL_BUGS,
    xpRemaining,
  }
}
