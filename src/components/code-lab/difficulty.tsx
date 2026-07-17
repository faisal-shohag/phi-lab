import type { ProblemDifficulty } from '@/lib/code-lab/types'

// Shared difficulty presentation, so the list, workspace header, and profile
// section all label and colour a difficulty the same way.
export const DIFFICULTY_META: Record<ProblemDifficulty, { label: string; className: string }> = {
  EASY: { label: 'Easy', className: 'text-emerald-600 border-emerald-500/40 dark:text-emerald-400' },
  MEDIUM: { label: 'Medium', className: 'text-amber-600 border-amber-500/40 dark:text-amber-400' },
  HARD: { label: 'Hard', className: 'text-rose-600 border-rose-500/40 dark:text-rose-400' },
  EXTRA_HARD: { label: 'Extra Hard', className: 'text-fuchsia-600 border-fuchsia-500/40 dark:text-fuchsia-400' },
}

export const DIFFICULTY_ORDER: ProblemDifficulty[] = ['EASY', 'MEDIUM', 'HARD', 'EXTRA_HARD']
