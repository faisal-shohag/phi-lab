// XP awarded on a problem's FIRST accept, by difficulty. Stamped into
// Problem.xp at create time (editable by the admin), and paid idempotently via
// the XpEvent ledger (reason "code_lab_solved", sourceId = problemId).

import type { ProblemDifficulty } from './types'

export const XP_BY_DIFFICULTY: Record<ProblemDifficulty, number> = {
  EASY: 30,
  MEDIUM: 60,
  HARD: 100,
  EXTRA_HARD: 150,
}

export const CODE_LAB_SOLVED_REASON = 'code_lab_solved'
