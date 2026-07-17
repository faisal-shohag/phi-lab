'use client'

import { useState } from 'react'
import { ChevronLeft, ChevronRight, Send } from 'lucide-react'
import type { QuizQuestion } from '@/lib/quiz/topics'
import { QuestionCard } from './question-card'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'

interface QuizPlayerProps {
  questions: QuizQuestion[]
  onSubmit: (answers: number[]) => void
  submitting: boolean
}

export function QuizPlayer({ questions, onSubmit, submitting }: QuizPlayerProps) {
  const [current, setCurrent] = useState(0)
  const [answers, setAnswers] = useState<(number | null)[]>(() => Array(questions.length).fill(null))

  const answered = answers.filter((a) => a !== null).length
  const allAnswered = answered === questions.length

  function select(i: number) {
    setAnswers((prev) => {
      const next = [...prev]
      next[current] = i
      return next
    })
  }

  function submit() {
    if (!allAnswered || submitting) return
    onSubmit(answers as number[])
  }

  return (
    <div className="space-y-4">
      {/* Progress bar */}
      <div className="space-y-2">
        <div className="flex items-center justify-between text-xs text-muted-foreground">
          <span>
            Question {current + 1} / {questions.length}
          </span>
          <span>
            {answered} / {questions.length} answered
          </span>
        </div>
        <div className="h-1.5 overflow-hidden rounded-full bg-muted">
          <div
            className="h-full rounded-full bg-primary transition-all duration-300"
            style={{ width: `${((current + 1) / questions.length) * 100}%` }}
          />
        </div>
      </div>

      {/* Question dots */}
      <div className="flex flex-wrap gap-1.5">
        {questions.map((_, i) => (
          <button
            key={i}
            onClick={() => setCurrent(i)}
            className={cn(
              'h-2.5 w-2.5 rounded-full transition-all',
              i === current
                ? 'bg-primary scale-125'
                : answers[i] !== null
                  ? 'bg-primary/60'
                  : 'bg-muted',
            )}
            title={`Question ${i + 1}`}
          />
        ))}
      </div>

      {/* Question */}
      <QuestionCard
        question={questions[current]}
        index={current}
        selected={answers[current]}
        onSelect={select}
      />

      {/* Navigation */}
      <div className="flex items-center justify-between pt-2">
        <Button
          variant="outline"
          onClick={() => setCurrent((c) => Math.max(0, c - 1))}
          disabled={current === 0}
        >
          <ChevronLeft className="mr-1 h-4 w-4" />
          Previous
        </Button>

        {current === questions.length - 1 ? (
          <Button onClick={submit} disabled={!allAnswered || submitting}>
            <Send className="mr-1 h-4 w-4" />
            Submit Quiz
          </Button>
        ) : (
          <Button onClick={() => setCurrent((c) => Math.min(questions.length - 1, c + 1))}>
            Next
            <ChevronRight className="ml-1 h-4 w-4" />
          </Button>
        )}
      </div>
    </div>
  )
}
