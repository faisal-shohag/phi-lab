'use client'

import { useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { Check, X, HelpCircle } from 'lucide-react'
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
            <span className="ml-auto text-xs font-bold text-amber-600 dark:text-amber-400">🔥 {streak} streak</span>
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
