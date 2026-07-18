// Server-only. Works out where a learner actually stands on The Path.
//
// The central rule: a step is done when a LAB RECORDED IT, never because a
// button was clicked. So nothing here reads a "completed" flag — it reads the
// XP ledger, the won challenges, and the graded lab sessions, and asks whether
// the evidence satisfies the step. That makes the path un-gameable by the
// client, and it means a learner who did the work *before* the path existed
// gets credit for it retroactively.
//
// The one subtlety is challenge wins. Unlike a Feynman run (which names its
// concept) or an interview (which names its topic), a ChallengeAttempt only
// records a difficulty — one Medium win looks like any other. So wins are a
// *fungible currency* and are consumed greedily, oldest first, walking the
// curriculum in order: each win pays for exactly one node's build step. Without
// that, a single Medium win would silently satisfy the build step of all eleven
// nodes that ask for one.

import { prisma } from '@/lib/prisma'
import { awardXp } from '@/lib/gamification/award'
import { levelInfo } from '@/lib/gamification/levels'
import { ALL_NODES, MODULES, moduleOfNode, nodeById, requiredSteps, TOTAL_NODES, type PathNode, type PathStep } from './curriculum'
import type { NodeProgress, NodeState, StepProgress } from './types'

const DIFFICULTY_RANK: Record<string, number> = { easy: 1, medium: 2, hard: 3 }

/** Everything the path needs from the DB, fetched once. */
export interface Evidence {
  /** Concept keys credited by stepping a JS Motion demo to its final frame. */
  vizConcepts: Map<string, Date>
  /** Won challenges, oldest first. Consumed greedily by build steps. */
  wins: { id: string; difficulty: string; mode: string; createdAt: Date }[]
  /** Lost challenges — a struggle signal for whichever node is in progress. */
  losses: number
  feynman: Scored[]
  english: Scored[]
  interview: (Scored & { topic: string; level: string })[]
  analogies: { concept: string; createdAt: Date }[]
  /** Completed Quiz Lab runs. `topics` is the set the quiz covered. */
  quizzes: { topics: string[]; score: number; createdAt: Date }[]
  /** Problem slug → date first accepted in Code Lab. Concept-named, not fungible. */
  codeSolved: Map<string, Date>
  /** Pixel challenge id → the tiers it cleared and when it first did. */
  pixelCleared: Map<string, { tiers: Set<string>; createdAt: Date }>
  mastered: Map<string, Date>
}

interface Scored {
  /** feynman: concept. english: scenario. interview: topic (plus `level`). */
  key: string
  score: number
  createdAt: Date
}

export async function loadEvidence(userId: string): Promise<Evidence> {
  const [vizEvents, attempts, feynman, english, interview, analogies, quizzes, code, pixel, mastered] = await Promise.all([
    prisma.xpEvent.findMany({
      where: { userId, reason: 'viz_concept' },
      select: { meta: true, createdAt: true },
    }),
    prisma.challengeAttempt.findMany({
      where: { userId, status: { in: ['won', 'lost'] } },
      select: { id: true, status: true, difficulty: true, mode: true, createdAt: true },
      orderBy: { createdAt: 'asc' },
    }),
    prisma.feynmanSession.findMany({
      where: { userId, status: 'COMPLETED' },
      select: { concept: true, clarityScore: true, createdAt: true },
    }),
    prisma.englishSession.findMany({
      where: { userId, status: 'COMPLETED' },
      select: { scenario: true, overallScore: true, createdAt: true },
    }),
    prisma.interviewSession.findMany({
      where: { userId, status: 'COMPLETED' },
      select: { topic: true, level: true, overallScore: true, createdAt: true },
    }),
    prisma.analogyCard.findMany({ where: { userId }, select: { concept: true, createdAt: true } }),
    prisma.quizSession.findMany({
      where: { userId, status: 'completed' },
      select: { topics: true, score: true, createdAt: true },
    }),
    // Accepted Code Lab submissions, oldest first — the join gives us the slug so
    // a node's `solve(slug)` step credits the right problem, not any solve.
    prisma.codeSubmission.findMany({
      where: { userId, verdict: 'ACCEPTED' },
      select: { problem: { select: { slug: true } }, createdAt: true },
      orderBy: { createdAt: 'asc' },
    }),
    // Every Pixel submission — we union the tiers each challenge ever cleared.
    prisma.pixelSubmission.findMany({
      where: { userId },
      select: { challengeId: true, tiers: true, createdAt: true },
      orderBy: { createdAt: 'asc' },
    }),
    prisma.pathProgress.findMany({ where: { userId }, select: { nodeId: true, masteredAt: true } }),
  ])

  const vizConcepts = new Map<string, Date>()
  for (const e of vizEvents) {
    const concept = (e.meta as { concept?: unknown } | null)?.concept
    if (typeof concept === 'string' && !vizConcepts.has(concept)) vizConcepts.set(concept, e.createdAt)
  }

  // First accept per slug wins the date; rows are ascending, so the first seen is it.
  const codeSolved = new Map<string, Date>()
  for (const s of code) {
    const slug = s.problem?.slug
    if (slug && !codeSolved.has(slug)) codeSolved.set(slug, s.createdAt)
  }

  // Union of every tier a challenge cleared, dated by the earliest submission.
  const pixelCleared = new Map<string, { tiers: Set<string>; createdAt: Date }>()
  for (const p of pixel) {
    const entry = pixelCleared.get(p.challengeId)
    if (entry) {
      for (const t of p.tiers) entry.tiers.add(t)
    } else {
      pixelCleared.set(p.challengeId, { tiers: new Set(p.tiers), createdAt: p.createdAt })
    }
  }

  return {
    vizConcepts,
    wins: attempts.filter((a) => a.status === 'won'),
    losses: attempts.filter((a) => a.status === 'lost').length,
    feynman: feynman.map((s) => ({ key: s.concept, score: s.clarityScore ?? 0, createdAt: s.createdAt })),
    english: english.map((s) => ({ key: s.scenario, score: s.overallScore ?? 0, createdAt: s.createdAt })),
    interview: interview.map((s) => ({ key: s.topic, level: s.level, topic: s.topic, score: s.overallScore ?? 0, createdAt: s.createdAt })),
    analogies: analogies.map((a) => ({ concept: a.concept.toLowerCase(), createdAt: a.createdAt })),
    quizzes: quizzes.map((q) => ({ topics: q.topics, score: q.score ?? 0, createdAt: q.createdAt })),
    codeSolved,
    pixelCleared,
    mastered: new Map(mastered.map((p) => [p.nodeId, p.masteredAt])),
  }
}

// Tier ranking so `pixel(id, 'close')` is satisfied by a 'perfect' clear too.
const TIER_RANK: Record<string, number> = { standing: 1, close: 2, perfect: 3 }

const fmt = (d: Date) => d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })

/**
 * Evaluate one step against the evidence. `spend` hands out a challenge win and
 * marks it used — it is the only stateful part, and it is why nodes must be
 * evaluated in curriculum order.
 */
function evaluateStep(step: PathStep, ev: Evidence, spend: (min: string) => { id: string; difficulty: string; createdAt: Date } | undefined): StepProgress {
  switch (step.kind) {
    case 'viz': {
      const at = step.concept ? ev.vizConcepts.get(step.concept) : undefined
      return at
        ? { id: step.id, done: true, evidence: `Stepped to the end · ${fmt(at)}`, attempts: 0 }
        : { id: step.id, done: false, attempts: 0 }
    }

    case 'challenge': {
      const win = spend(step.difficulty ?? 'easy')
      if (win) {
        return { id: step.id, done: true, evidence: `Won a ${win.difficulty} challenge · ${fmt(win.createdAt)}`, attempts: 0 }
      }
      // A loss is not attributable to a node (the attempt records no topic), so
      // it counts as a generic "you have been fighting challenges" signal.
      return { id: step.id, done: false, attempts: Math.min(ev.losses, 3) }
    }

    case 'feynman':
      return scoredStep(step, ev.feynman, 'Explained it', step.concept ?? '')
    case 'english':
      return scoredStep(step, ev.english, 'Spoke it', step.scenario ?? '')
    case 'interview': {
      const runs = ev.interview.filter((r) => r.topic === step.topic && (!step.level || r.level === step.level))
      return scoredStep(step, runs, 'Cleared the interview', step.topic ?? '')
    }

    case 'analogy': {
      const want = (step.concept ?? '').toLowerCase()
      const card = ev.analogies.find((a) => a.concept.includes(want) || want.includes(a.concept))
      return card
        ? { id: step.id, done: true, evidence: `Card made · ${fmt(card.createdAt)}`, attempts: 0 }
        : { id: step.id, done: false, attempts: 0 }
    }

    case 'quiz': {
      const bar = step.minScore ?? 0
      const mine = ev.quizzes.filter((q) => !step.topic || q.topics.includes(step.topic))
      const passed = mine.filter((q) => q.score >= bar).sort((a, b) => b.score - a.score)[0]
      if (passed) {
        return { id: step.id, done: true, evidence: `Quiz cleared — ${passed.score}/100 · ${fmt(passed.createdAt)}`, attempts: 0 }
      }
      const best = mine.reduce((m, q) => Math.max(m, q.score), 0)
      return { id: step.id, done: false, attempts: mine.length, bestScore: mine.length > 0 ? best : undefined }
    }

    case 'code': {
      const at = step.slug ? ev.codeSolved.get(step.slug) : undefined
      return at
        ? { id: step.id, done: true, evidence: `Solved it · ${fmt(at)}`, attempts: 0 }
        : { id: step.id, done: false, attempts: 0 }
    }

    case 'pixel': {
      const entry = step.pixelId ? ev.pixelCleared.get(step.pixelId) : undefined
      const need = TIER_RANK[step.tier ?? 'standing'] ?? 1
      const cleared = entry && [...entry.tiers].some((t) => (TIER_RANK[t] ?? 0) >= need)
      return cleared
        ? { id: step.id, done: true, evidence: `Rebuilt it · ${fmt(entry.createdAt)}`, attempts: 0 }
        : { id: step.id, done: false, attempts: entry ? 1 : 0 }
    }
  }
}

/**
 * A scored lab step: it is done when a matching run cleared the bar. Runs that
 * matched but fell short are counted, not discarded — that is the whole struggle
 * signal, and the difference between "hasn't tried" and "tried three times".
 */
function scoredStep(step: PathStep, runs: Scored[], verb: string, key: string): StepProgress {
  const bar = step.minScore ?? 0
  const mine = key ? runs.filter((r) => r.key === key) : runs
  const passed = mine.filter((r) => r.score >= bar).sort((a, b) => b.score - a.score)[0]
  if (passed) {
    return { id: step.id, done: true, evidence: `${verb} — ${passed.score}/100 · ${fmt(passed.createdAt)}`, attempts: 0 }
  }
  const best = mine.reduce((m, r) => Math.max(m, r.score), 0)
  return { id: step.id, done: false, attempts: mine.length, bestScore: mine.length > 0 ? best : undefined }
}

/** Where every node stands. Pure given the evidence — no writes. */
export function evaluate(ev: Evidence): NodeProgress[] {
  // Challenge wins, cheapest-first per difficulty tier, consumed as we walk.
  const unused = [...ev.wins]
  const spend = (min: string) => {
    const need = DIFFICULTY_RANK[min] ?? 1
    const i = unused.findIndex((w) => (DIFFICULTY_RANK[w.difficulty] ?? 0) >= need)
    if (i === -1) return undefined
    return unused.splice(i, 1)[0]
  }

  const byId = new Map<string, NodeProgress>()
  const out: NodeProgress[] = []

  // MODULES order is the curriculum order, and prerequisites never point
  // forwards, so one pass is enough to resolve unlocks.
  for (const node of ALL_NODES) {
    const steps = node.steps.map((s) => evaluateStep(s, ev, spend))
    const required = new Set(requiredSteps(node).map((s) => s.id))
    const doneCount = steps.filter((s) => required.has(s.id) && s.done).length
    const requiredCount = required.size

    const unlocked = node.requires.every((r) => byId.get(r)?.state === 'mastered')
    const complete = doneCount === requiredCount
    // A node the learner already banked stays mastered even if we later raise a
    // bar or retire a demo. The receipt was written; we do not take it back.
    const banked = ev.mastered.has(node.id)

    let state: NodeState
    if (banked || (unlocked && complete)) state = 'mastered'
    else if (!unlocked) state = 'locked'
    else if (steps.some((s) => s.done || s.attempts > 0)) state = 'in-progress'
    else state = 'available'

    const progress: NodeProgress = {
      nodeId: node.id,
      state,
      steps,
      doneCount,
      requiredCount,
      masteredAt: ev.mastered.get(node.id)?.toISOString(),
      struggling: state !== 'mastered' && steps.some((s) => !s.done && s.attempts >= 2),
    }
    byId.set(node.id, progress)
    out.push(progress)
  }

  return out
}

/** The node to work on now: the first unlocked-but-unfinished one. */
export function activeNodeId(nodes: NodeProgress[]): string | null {
  return nodes.find((n) => n.state === 'in-progress')?.nodeId
    ?? nodes.find((n) => n.state === 'available')?.nodeId
    ?? null
}

export interface SyncResult {
  nodes: NodeProgress[]
  /** Nodes that crossed into mastery on this call. Drives the celebration UI. */
  newlyMastered: string[]
  xpAwarded: number
}

/**
 * Recompute, then bank any node that just crossed its gate: write the receipt
 * and pay the bonus. Idempotent twice over — the PathProgress row is unique per
 * (user, node), and awardXp is unique per (user, reason, sourceId) — so calling
 * this on every page load is safe and costs one write the first time only.
 */
export async function syncPath(userId: string): Promise<SyncResult> {
  const ev = await loadEvidence(userId)
  const nodes = evaluate(ev)

  const fresh = nodes.filter((n) => n.state === 'mastered' && !ev.mastered.has(n.nodeId))
  let xpAwarded = 0

  for (const n of fresh) {
    const node = nodeById(n.nodeId)
    if (!node) continue

    // The receipt first: if the XP grant fails, the learner keeps the mastery.
    // The reverse order would let a crash cost them the node.
    await prisma.pathProgress.upsert({
      where: { userId_nodeId: { userId, nodeId: node.id } },
      create: { userId, nodeId: node.id, evidence: { steps: n.steps } as object },
      update: {},
    })

    const result = await awardXp({
      userId,
      reason: node.boss ? 'path_boss_cleared' : 'path_node_mastered',
      sourceId: `node:${node.id}`,
      amount: node.xp,
      meta: { nodeId: node.id, module: moduleOfNode(node.id)?.id, boss: !!node.boss },
    })
    xpAwarded += result.xpGained
  }

  return { nodes, newlyMastered: fresh.map((n) => n.nodeId), xpAwarded }
}

/** Level + XP header data, read alongside the map. */
export async function levelHeader(userId: string) {
  const user = await prisma.user.findUnique({ where: { id: userId }, select: { xp: true } })
  const info = levelInfo(user?.xp ?? 0)
  return { xp: info.xp, level: info.level, levelTitle: info.title }
}

/** Modules with their nodes' progress attached — what the map renders. */
export function groupByModule(nodes: NodeProgress[]) {
  const byId = new Map(nodes.map((n) => [n.nodeId, n]))
  return MODULES.map((m) => {
    const progress = m.nodes.map((n) => byId.get(n.id)).filter((p): p is NodeProgress => !!p)
    return {
      moduleId: m.id,
      mastered: progress.filter((p) => p.state === 'mastered').length,
      total: m.nodes.length,
      locked: progress.every((p) => p.state === 'locked'),
    }
  })
}

export { TOTAL_NODES }
export type { PathNode }
