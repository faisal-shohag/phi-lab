// Server-only. The daily quest: a small, composed-once list of steps drawn from
// where the learner actually is on the path, plus the occasional spaced-
// repetition review of something they mastered a while ago.
//
// Two rules make it trustworthy:
//   1. Composed once per UTC day and frozen (DailyQuest row). Recomposing mid-day
//      as the learner makes progress would keep moving the finish line — you'd
//      never see "done".
//   2. Whether an item is *done* is NOT stored on the item. It is re-derived from
//      the same evidence the path uses, so a quest cannot be completed without the
//      lab recording the work. The frozen part is *which* steps, never their state.

import { prisma } from '@/lib/prisma'
import { awardXp } from '@/lib/gamification/award'
import { ALL_NODES, nodeById, requiredSteps } from './curriculum'
import { evaluate, loadEvidence, type Evidence } from './progress'
import type { NodeProgress, QuestItem, QuestView } from './types'

const DAILY_TARGET_MINUTES = 25
const QUEST_XP = 30
/** Days after mastery a concept resurfaces for review: the forgetting curve. */
const REVIEW_AFTER_DAYS = [3, 7, 21]

function todayUTC(): string {
  return new Date().toISOString().slice(0, 10)
}

function daysBetween(a: Date, b: Date): number {
  return Math.floor((b.getTime() - a.getTime()) / 86_400_000)
}

/**
 * Compose the item list for `day`. Pure given the evidence + node progress, so
 * it is deterministic: the same learner on the same day gets the same quest even
 * if the row has to be recreated.
 */
function compose(nodes: NodeProgress[], ev: Evidence): Omit<QuestItem, 'done'>[] {
  const byId = new Map(nodes.map((n) => [n.nodeId, n]))
  const items: Omit<QuestItem, 'done'>[] = []
  let minutes = 0

  // Fresh work first: the unfinished required steps of whatever nodes are open.
  for (const node of ALL_NODES) {
    const p = byId.get(node.id)
    if (!p || (p.state !== 'in-progress' && p.state !== 'available')) continue
    for (const step of requiredSteps(node)) {
      if (p.steps.find((s) => s.id === step.id)?.done) continue
      items.push({ nodeId: node.id, stepId: step.id, label: step.label, href: step.href, minutes: step.minutes, review: false })
      minutes += step.minutes
      if (minutes >= DAILY_TARGET_MINUTES) return items
    }
    if (items.length > 0) break // stay focused on one node's worth of fresh work
  }

  // Then top up with one spaced-repetition review, if anything is due today.
  const now = new Date(`${todayUTC()}T00:00:00Z`)
  for (const [nodeId, at] of ev.mastered) {
    const age = daysBetween(at, now)
    if (!REVIEW_AFTER_DAYS.includes(age)) continue
    const node = nodeById(nodeId)
    const review = node?.steps.find((s) => s.kind === 'feynman') ?? node?.steps.find((s) => s.kind === 'challenge')
    if (!node || !review) continue
    items.push({
      nodeId,
      stepId: `review-${review.id}`,
      label: `Review: ${node.title}`,
      href: review.href,
      minutes: 5,
      review: true,
    })
    break
  }

  return items
}

/** Re-derive whether a frozen quest item is now satisfied. */
function itemDone(item: Omit<QuestItem, 'done'>, nodes: NodeProgress[]): boolean {
  const node = nodes.find((n) => n.nodeId === item.nodeId)
  if (!node) return false
  // Review items are a nudge, not a gate — they never block quest completion.
  if (item.review) return true
  return node.steps.find((s) => s.id === item.stepId)?.done ?? false
}

/**
 * Get (or compose) today's quest, re-derive done-state, award the daily bonus
 * the first time every item is satisfied, and compute the streak. One call does
 * everything the quest card needs.
 */
export async function getQuest(userId: string): Promise<QuestView> {
  const day = todayUTC()
  const ev = await loadEvidence(userId)
  const nodes = evaluate(ev)

  let row = await prisma.dailyQuest.findUnique({ where: { userId_day: { userId, day } } })
  if (!row) {
    const composed = compose(nodes, ev)
    // A learner with nothing open (brand new, or fully done) still gets a row so
    // the streak logic has something to read; it is just empty.
    row = await prisma.dailyQuest.create({
      data: { userId, day, items: composed as object },
    }).catch(async () => {
      // Lost a compose race with a parallel request — read the winner.
      return prisma.dailyQuest.findUniqueOrThrow({ where: { userId_day: { userId, day } } })
    })
  }

  const frozen = (row.items as unknown as Omit<QuestItem, 'done'>[]) ?? []
  const items: QuestItem[] = frozen.map((it) => ({ ...it, done: itemDone(it, nodes) }))
  const complete = items.length > 0 && items.every((it) => it.done)

  // Bank the completion (idempotent) the moment it first holds.
  if (complete && !row.completedAt) {
    await prisma.dailyQuest.update({ where: { id: row.id }, data: { completedAt: new Date() } })
    await awardXp({ userId, reason: 'path_daily_quest', sourceId: `quest:${day}`, amount: QUEST_XP, meta: { day } })
    row.completedAt = new Date()
  }

  const { streak, onGrace } = await computeStreak(userId, day, complete)

  return {
    day,
    items,
    minutes: items.reduce((m, it) => m + it.minutes, 0),
    complete,
    streak,
    onGrace,
  }
}

/**
 * Consecutive completed days ending today, with ONE forgiven gap. Duolingo's
 * hard-won lesson: punishing a single missed day collapses the streak and the
 * learner quits. So a lone skipped day keeps the streak alive (on "grace"); a
 * second consecutive miss breaks it.
 */
async function computeStreak(userId: string, today: string, todayComplete: boolean): Promise<{ streak: number; onGrace: boolean }> {
  const rows = await prisma.dailyQuest.findMany({
    where: { userId, completedAt: { not: null } },
    select: { day: true },
    orderBy: { day: 'desc' },
    take: 120,
  })
  const done = new Set(rows.map((r) => r.day))
  if (todayComplete) done.add(today)

  let streak = 0
  let graceUsed = false
  let onGrace = false
  const cursor = new Date(`${today}T00:00:00Z`)

  // Start from today if it's done, else from yesterday (today still in progress
  // shouldn't zero a real streak).
  if (!done.has(today)) cursor.setUTCDate(cursor.getUTCDate() - 1)

  for (let i = 0; i < 120; i++) {
    const key = cursor.toISOString().slice(0, 10)
    if (done.has(key)) {
      streak++
    } else if (!graceUsed && streak > 0) {
      graceUsed = true
      onGrace = true // the most recent gap is the forgiven one
    } else {
      break
    }
    cursor.setUTCDate(cursor.getUTCDate() - 1)
  }

  return { streak, onGrace: onGrace && streak > 0 }
}
