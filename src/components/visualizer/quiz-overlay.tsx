'use client'

import { useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { Check, X, HelpCircle, Flame } from 'lucide-react'
import { cn } from '@/lib/utils'
import type { QuizQuestion } from '@/lib/visualizer/quiz'

interface QuizOverlayProps {
  question: QuizQuestion
  streak: number
  // Called after the learner answers and dismisses; `correct` reports result.
  onResolved: (correct: boolean) => void
}

export function QuizOverlay({ question, streak, onResolved }: QuizOverlayProps) {
  const [picked, setPicked] = useState<string | null>(null)
  const answered = picked !== null
  const correct = picked === question.answer

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="absolute inset-0 z-30 flex items-center justify-center bg-background/70 backdrop-blur-sm p-4"
    >
      <motion.div
        initial={{ scale: 0.94, y: 10 }}
        animate={{ scale: 1, y: 0 }}
        exit={{ scale: 0.94, y: 10 }}
        transition={{ type: 'spring', stiffness: 300, damping: 26 }}
        className="w-full max-w-md rounded-2xl border-2 border-border bg-card p-5 shadow-xl"
      >
        <div className="flex items-center gap-2 mb-3">
          <HelpCircle className="h-5 w-5 text-amber-500" />
          <span className="font-semibold text-sm">Predict — line {question.line}</span>
          {streak > 0 && (
            <span className="relative ml-auto flex items-center gap-1 text-xs font-bold text-amber-600 dark:text-amber-400">
              <motion.span
                className="relative inline-flex"
                animate={
                  answered && !correct
                    ? { scale: [1, 1.3, 0], opacity: [1, 1, 0], filter: ['grayscale(0)', 'grayscale(1)', 'grayscale(1)'] }
                    : { scale: [1, 1.15, 1] }
                }
                transition={answered && !correct ? { duration: 0.6 } : { duration: 1.4, repeat: Infinity }}
                style={{ filter: streak >= 5 ? 'drop-shadow(0 0 6px rgba(251,146,60,0.8))' : streak >= 3 ? 'drop-shadow(0 0 4px rgba(251,146,60,0.6))' : undefined }}
              >
                <Flame className={cn('fill-current', streak >= 5 ? 'h-5 w-5 text-orange-500' : streak >= 3 ? 'h-4 w-4 text-amber-500' : 'h-3.5 w-3.5 text-amber-400')} />
              </motion.span>
              {/* Smoke puff when the streak breaks */}
              {answered && !correct && (
                <motion.span
                  initial={{ opacity: 0, y: 0, scale: 0.5 }}
                  animate={{ opacity: [0, 0.6, 0], y: -14, scale: 1.4 }}
                  transition={{ duration: 0.7, delay: 0.2 }}
                  className="pointer-events-none absolute left-1 top-0 h-2 w-2 rounded-full bg-muted-foreground/60 blur-[2px]"
                />
              )}
              <span className={cn(answered && !correct && 'text-muted-foreground line-through')}>{streak} streak</span>
            </span>
          )}
        </div>
        <p className="text-sm text-muted-foreground mb-4">{question.prompt}</p>

        <div className={cn('grid gap-2', question.kind === 'boolean' ? 'grid-cols-2' : 'grid-cols-1')}>
          {question.options.map((opt) => {
            const isAnswer = opt === question.answer
            const isPicked = opt === picked
            return (
              <button
                key={opt}
                disabled={answered}
                onClick={() => setPicked(opt)}
                className={cn(
                  'flex items-center justify-between gap-2 rounded-lg border-2 px-3 py-2 text-left font-mono text-sm transition-all',
                  !answered && 'border-border hover:border-amber-400 hover:bg-accent',
                  answered && isAnswer && 'border-emerald-500 bg-emerald-50 dark:bg-emerald-950/60',
                  answered && isPicked && !isAnswer && 'border-rose-500 bg-rose-50 dark:bg-rose-950/60',
                  answered && !isAnswer && !isPicked && 'border-border opacity-50',
                )}
              >
                <span className="truncate">{opt === '' ? '(empty)' : opt}</span>
                {answered && isAnswer && <Check className="h-4 w-4 text-emerald-500 shrink-0" />}
                {answered && isPicked && !isAnswer && <X className="h-4 w-4 text-rose-500 shrink-0" />}
              </button>
            )
          })}
        </div>

        <AnimatePresence>
          {answered && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              className="mt-4"
            >
              <p className={cn('text-sm font-semibold mb-3', correct ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-400')}>
                {correct ? 'Correct! 🎉' : `Not quite — the answer is ${question.answer || '(empty)'}.`}
              </p>
              <button
                onClick={() => onResolved(correct)}
                className="w-full rounded-lg bg-foreground text-background py-2 text-sm font-semibold hover:bg-foreground/90 transition-colors"
              >
                Continue →
              </button>
            </motion.div>
          )}
        </AnimatePresence>
      </motion.div>
    </motion.div>
  )
}
