'use client'

import { cn } from '@/lib/utils'
import type { QuizQuestion } from '@/lib/quiz/topics'
import { topicLabel } from '@/lib/quiz/topics'
import { Badge } from '@/components/ui/badge'

interface QuestionCardProps {
  question: QuizQuestion
  index: number
  selected: number | null
  onSelect: (optionIndex: number) => void
  showResult?: boolean
}

const OPTION_LABELS = ['A', 'B', 'C', 'D']

export function QuestionCard({ question, index, selected, onSelect, showResult }: QuestionCardProps) {
  return (
    <div className="space-y-4">
      <div className="flex items-start justify-between gap-3">
        <h3 className="text-base font-semibold leading-relaxed">
          <span className="text-muted-foreground">Q{index + 1}. </span>
          {question.question}
        </h3>
        <Badge variant="secondary" className="shrink-0 text-[10px]">
          {topicLabel(question.topic)}
        </Badge>
      </div>

      <div className="space-y-2">
        {question.options.map((option, i) => {
          const isCorrect = showResult && i === question.correctIndex
          const isWrong = showResult && selected === i && i !== question.correctIndex
          const isSelected = selected === i

          return (
            <button
              key={i}
              onClick={() => !showResult && onSelect(i)}
              disabled={showResult}
              className={cn(
                'flex w-full items-start gap-3 rounded-xl border-2 p-3.5 text-left text-sm transition-all',
                showResult
                  ? isCorrect
                    ? 'border-emerald-500 bg-emerald-50 dark:bg-emerald-950/30'
                    : isWrong
                      ? 'border-red-500 bg-red-50 dark:bg-red-950/30'
                      : 'border-border bg-card opacity-60'
                  : isSelected
                    ? 'border-primary bg-primary/5 shadow-sm'
                    : 'border-border bg-card hover:bg-accent hover:border-border/80',
              )}
            >
              <span
                className={cn(
                  'flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-xs font-bold',
                  showResult
                    ? isCorrect
                      ? 'bg-emerald-500 text-white'
                      : isWrong
                        ? 'bg-red-500 text-white'
                        : 'bg-muted text-muted-foreground'
                    : isSelected
                      ? 'bg-primary text-primary-foreground'
                      : 'bg-muted text-muted-foreground',
                )}
              >
                {OPTION_LABELS[i]}
              </span>
              <span className="pt-0.5 leading-relaxed">{option}</span>
            </button>
          )
        })}
      </div>
    </div>
  )
}
