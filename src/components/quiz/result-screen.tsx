'use client'

import { useEffect, useRef } from 'react'
import { motion } from 'framer-motion'
import { Trophy, RotateCcw, BookOpen, ChevronDown, Check, X } from 'lucide-react'
import confetti from 'canvas-confetti'
import type { QuizQuestion } from '@/lib/quiz/topics'
import { topicLabel, difficultyLabel } from '@/lib/quiz/topics'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { cn } from '@/lib/utils'

interface ResultScreenProps {
  questions: QuizQuestion[]
  answers: number[]
  score: number
  total: number
  xpAwarded: number
  onRetry: () => void
  onNewQuiz: () => void
  topics: string[]
  difficulty: string
}

export function ResultScreen({ questions, answers, score, total, xpAwarded, onRetry, onNewQuiz, topics, difficulty }: ResultScreenProps) {
  const percentage = total > 0 ? Math.round((score / total) * 100) : 0
  const hasConfettied = useRef(false)

  useEffect(() => {
    if (percentage >= 80 && !hasConfettied.current) {
      hasConfettied.current = true
      const end = Date.now() + 1000
      const frame = () => {
        confetti({ particleCount: 3, angle: 60, spread: 55, origin: { x: 0 } })
        confetti({ particleCount: 3, angle: 120, spread: 55, origin: { x: 1 } })
        if (Date.now() < end) requestAnimationFrame(frame)
      }
      frame()
    }
  }, [percentage])

  return (
    <div className="space-y-6">
      {/* Score header */}
      <motion.div
        initial={{ scale: 0.8, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        className="flex flex-col items-center rounded-2xl border-2 border-border bg-card p-6 text-center"
      >
        <div className="relative">
          <svg className="h-28 w-28 -rotate-90" viewBox="0 0 120 120">
            <circle cx="60" cy="60" r="52" fill="none" stroke="currentColor" strokeWidth="8" className="text-muted" />
            <motion.circle
              cx="60"
              cy="60"
              r="52"
              fill="none"
              strokeWidth="8"
              strokeLinecap="round"
              className={cn(
                percentage >= 80 ? 'text-emerald-500' : percentage >= 50 ? 'text-amber-500' : 'text-red-500',
              )}
              stroke="currentColor"
              initial={{ strokeDasharray: '327 327', strokeDashoffset: 327 }}
              animate={{ strokeDashoffset: 327 - (327 * percentage) / 100 }}
              transition={{ duration: 1, ease: 'easeOut' }}
            />
          </svg>
          <div className="absolute inset-0 flex flex-col items-center justify-center">
            <Trophy className={cn('h-6 w-6', percentage >= 80 ? 'text-amber-500' : 'text-muted-foreground')} />
            <span className="text-2xl font-bold">{percentage}%</span>
          </div>
        </div>
        <p className="mt-3 text-lg font-semibold">
          {score} / {total} correct
        </p>
        <div className="mt-1 flex flex-wrap items-center justify-center gap-2">
          <Badge variant="secondary">+{xpAwarded} XP</Badge>
          {topics.map((t) => (
            <Badge key={t} variant="outline" className="text-[10px]">{topicLabel(t)}</Badge>
          ))}
          <Badge variant="outline" className="text-[10px]">{difficultyLabel(difficulty)}</Badge>
        </div>
        <div className="mt-4 flex gap-2">
          <Button variant="outline" size="sm" onClick={onRetry}>
            <RotateCcw className="mr-1 h-4 w-4" /> Try Again
          </Button>
          <Button size="sm" onClick={onNewQuiz}>
            <BookOpen className="mr-1 h-4 w-4" /> New Quiz
          </Button>
        </div>
      </motion.div>

      {/* Answer review */}
      <div className="space-y-3">
        <h3 className="text-sm font-semibold text-muted-foreground">Review Answers</h3>
        {questions.map((q, i) => (
          <ReviewItem key={i} question={q} answer={answers[i]} index={i} />
        ))}
      </div>
    </div>
  )
}

function ReviewItem({ question, answer, index }: { question: QuizQuestion; answer: number; index: number }) {
  const isCorrect = answer === question.correctIndex

  return (
    <details className="group rounded-xl border-2 border-border bg-card">
      <summary className="flex cursor-pointer items-center gap-3 p-4 select-none">
        {isCorrect ? (
          <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-emerald-500 text-white">
            <Check className="h-3.5 w-3.5" />
          </span>
        ) : (
          <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-red-500 text-white">
            <X className="h-3.5 w-3.5" />
          </span>
        )}
        <span className="flex-1 text-sm font-medium">
          <span className="text-muted-foreground">Q{index + 1}. </span>
          {question.question}
        </span>
        <Badge variant="secondary" className="shrink-0 text-[10px]">{topicLabel(question.topic)}</Badge>
        <ChevronDown className="h-4 w-4 text-muted-foreground transition-transform group-open:rotate-180" />
      </summary>
      <div className="border-t border-border px-4 pb-4 pt-3 space-y-2">
        <div className="space-y-1 text-sm">
          {!isCorrect && (
            <p className="text-red-600 dark:text-red-400">
              Your answer: {question.options[answer]}
            </p>
          )}
          <p className="text-emerald-600 dark:text-emerald-400">
            Correct answer: {question.options[question.correctIndex]}
          </p>
        </div>
        <p className="text-sm leading-relaxed text-muted-foreground">{question.explanation}</p>
      </div>
    </details>
  )
}
