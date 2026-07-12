// Wire types shared by the Path server code and its client components. Pure —
// no Prisma, no server imports — so a 'use client' component can import them.

export type NodeState = 'locked' | 'available' | 'in-progress' | 'mastered'

export interface StepProgress {
  /** PathStep.id, unique within its node. */
  id: string
  done: boolean
  /** The receipt: "Won a Medium challenge · 12 Jul". Absent until done. */
  evidence?: string
  /**
   * Tried and fell short — e.g. a Feynman run scored 41 against a 60 bar. This
   * is the struggle signal the weekly re-planner reads, and the reason the UI
   * can say "you're close" instead of showing an empty checkbox.
   */
  attempts: number
  /** Best score so far on a scored step, when it exists but is under the bar. */
  bestScore?: number
}

export interface NodeProgress {
  nodeId: string
  state: NodeState
  steps: StepProgress[]
  doneCount: number
  requiredCount: number
  masteredAt?: string
  /** Two or more under-the-bar attempts on any one step. The AI is told about this. */
  struggling: boolean
}

/** One line of the daily quest. Frozen at compose time; `done` re-derived on read. */
export interface QuestItem {
  nodeId: string
  stepId: string
  label: string
  href: string
  minutes: number
  /** True when this is a spaced-repetition review of an already-mastered node. */
  review: boolean
  done: boolean
}

export interface QuestView {
  day: string
  items: QuestItem[]
  minutes: number
  complete: boolean
  /** Consecutive days completed. One missed day is forgiven — see quest.ts. */
  streak: number
  /** True when the streak is only alive because of the forgiven day. */
  onGrace: boolean
}

/** The AI's weekly plan + report card. Bilingual by design — see ai.ts. */
export interface WeeklyReport {
  weekOf: string
  headline: string
  summaryEn: string
  summaryBn: string
  wins: string[]
  struggles: string[]
  focus: { nodeId: string; why: string }[]
  encouragementEn: string
  encouragementBn: string
  /** Minutes/day the AI thinks this learner can actually sustain. */
  dailyMinutes: number
}

export interface PathSnapshot {
  nodes: NodeProgress[]
  masteredCount: number
  totalNodes: number
  /** The node the learner should be working on right now. */
  activeNodeId: string | null
  quest: QuestView | null
  report: WeeklyReport | null
  xp: number
  level: number
  levelTitle: string
}
