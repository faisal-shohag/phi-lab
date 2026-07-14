// Server-only. Where a learner stands in the curriculum, read straight from the
// XP ledger — there is no "completed" flag to forge.
//
// Two kinds of receipt count:
//   viz_problem — this catalog's own, one per problem (`problem:<id>`).
//   viz_concept — the older per-concept receipt, left behind by learners who
//                 stepped demos before topics existed. Mapped back through
//                 CONCEPT_TO_PROBLEMS so their progress carries over instead of
//                 resetting to zero on the day this ships.
import 'server-only'

import { prisma } from '@/lib/prisma'
import {
  ALL_PROBLEMS,
  CONCEPT_TO_PROBLEMS,
  CHALLENGE_GATE_PERCENT,
  CHALLENGE_GATE_TOPIC,
  PROBLEM_TOPICS,
  TOTAL_PROBLEMS,
  type TopicId,
} from './problems'

export interface TopicProgress {
  topicId: TopicId
  done: number
  total: number
}

export interface ProblemProgress {
  completedIds: string[]
  completed: number
  total: number
  /** 0…1 — share of the whole catalog finished. */
  percent: number
  topics: TopicProgress[]
  gateTopicComplete: boolean
  challengeUnlocked: boolean
  /** How many more problems until the percentage gate clears. 0 once it has. */
  remainingForGate: number
}

export async function getProblemProgress(userId: string): Promise<ProblemProgress> {
  const events = await prisma.xpEvent.findMany({
    where: { userId, reason: { in: ['viz_problem', 'viz_concept'] } },
    select: { reason: true, sourceId: true, meta: true },
  })

  const completed = new Set<string>()
  for (const e of events) {
    if (e.reason === 'viz_problem') {
      if (e.sourceId.startsWith('problem:')) completed.add(e.sourceId.slice('problem:'.length))
    } else {
      const concept = (e.meta as { concept?: unknown } | null)?.concept
      if (typeof concept === 'string') {
        for (const id of CONCEPT_TO_PROBLEMS[concept] ?? []) completed.add(id)
      }
    }
  }

  // Ignore receipts for problems that have since been retired, so a shrinking
  // catalog can't push someone over 100%.
  const known = new Set(ALL_PROBLEMS.map((p) => p.id))
  const completedIds = [...completed].filter((id) => known.has(id))

  const done = new Set(completedIds)
  const topics: TopicProgress[] = PROBLEM_TOPICS.map((t) => ({
    topicId: t.id,
    done: t.problems.filter((p) => done.has(p.id)).length,
    total: t.problems.length,
  }))

  const percent = TOTAL_PROBLEMS === 0 ? 0 : completedIds.length / TOTAL_PROBLEMS
  const gateTopic = topics.find((t) => t.topicId === CHALLENGE_GATE_TOPIC)
  const gateTopicComplete = !!gateTopic && gateTopic.done === gateTopic.total

  const needed = Math.ceil(TOTAL_PROBLEMS * CHALLENGE_GATE_PERCENT)
  return {
    completedIds,
    completed: completedIds.length,
    total: TOTAL_PROBLEMS,
    percent,
    topics,
    gateTopicComplete,
    challengeUnlocked: percent >= CHALLENGE_GATE_PERCENT && gateTopicComplete,
    remainingForGate: Math.max(0, needed - completedIds.length),
  }
}
