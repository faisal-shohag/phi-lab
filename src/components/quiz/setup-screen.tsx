'use client'

import { useState } from 'react'
import { Loader2, Sparkles, Zap } from 'lucide-react'
import { QUIZ_TOPICS, DIFFICULTY_LEVELS, QUESTION_COUNTS, type QuizTopic, type QuizDifficulty } from '@/lib/quiz/topics'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'

interface SetupScreenProps {
  onGenerate: (topics: QuizTopic[], difficulty: QuizDifficulty, count: number) => void
  loading: boolean
}

const QUICK_COMBOS = [
  { label: '10 JS Questions', topics: ['javascript'] as QuizTopic[], difficulty: 'intermediate' as QuizDifficulty, count: 10 },
  { label: '5 React Basics', topics: ['react'] as QuizTopic[], difficulty: 'beginner' as QuizDifficulty, count: 5 },
  { label: '15 Full Stack', topics: ['javascript', 'nodejs', 'expressjs', 'mongodb'] as QuizTopic[], difficulty: 'advanced' as QuizDifficulty, count: 15 },
]

export function SetupScreen({ onGenerate, loading }: SetupScreenProps) {
  const [selectedTopics, setSelectedTopics] = useState<QuizTopic[]>([])
  const [difficulty, setDifficulty] = useState<QuizDifficulty>('intermediate')
  const [count, setCount] = useState(10)

  function toggleTopic(id: QuizTopic) {
    setSelectedTopics((prev) =>
      prev.includes(id) ? prev.filter((t) => t !== id) : [...prev, id],
    )
  }

  function handleGenerate() {
    if (selectedTopics.length === 0 || loading) return
    onGenerate(selectedTopics, difficulty, count)
  }

  function applyQuick(combo: typeof QUICK_COMBOS[number]) {
    setSelectedTopics(combo.topics)
    setDifficulty(combo.difficulty)
    setCount(combo.count)
  }

  return (
    <div className="space-y-6">
      {/* Quick Start */}
      <div>
        <p className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Quick start</p>
        <div className="flex flex-wrap gap-2">
          {QUICK_COMBOS.map((combo) => (
            <button
              key={combo.label}
              onClick={() => applyQuick(combo)}
              disabled={loading}
              className="rounded-full border border-border bg-card px-3 py-1.5 text-xs font-medium transition-colors hover:border-primary/50 hover:bg-accent disabled:opacity-50"
            >
              <Zap className="mr-1 inline-block h-3 w-3" />
              {combo.label}
            </button>
          ))}
        </div>
      </div>

      {/* Topics */}
      <div>
        <label className="text-sm font-semibold">Select topics</label>
        <p className="text-xs text-muted-foreground">Choose one or more</p>
        <div className="mt-2 grid grid-cols-3 gap-2 sm:grid-cols-5">
          {QUIZ_TOPICS.map((topic) => {
            const Icon = topic.icon
            const active = selectedTopics.includes(topic.id)
            return (
              <button
                key={topic.id}
                onClick={() => toggleTopic(topic.id)}
                disabled={loading}
                className={cn(
                  'flex flex-col items-center gap-1 rounded-xl border-2 p-3 text-xs font-medium transition-all',
                  active
                    ? 'border-primary bg-primary/5 shadow-sm'
                    : 'border-border bg-card hover:bg-accent hover:border-border/80',
                )}
              >
                <Icon className={cn('h-5 w-5', topic.color)} />
                <span>{topic.label}</span>
              </button>
            )
          })}
        </div>
      </div>

      {/* Difficulty */}
      <div>
        <label className="text-sm font-semibold">Difficulty</label>
        <div className="mt-2 flex gap-2">
          {DIFFICULTY_LEVELS.map((d) => (
            <button
              key={d.id}
              onClick={() => setDifficulty(d.id)}
              disabled={loading}
              className={cn(
                'flex-1 rounded-xl border-2 px-3 py-2.5 text-sm font-semibold transition-all',
                difficulty === d.id
                  ? 'border-primary bg-primary/5 shadow-sm'
                  : 'border-border bg-card hover:bg-accent',
              )}
            >
              {d.label}
              <span className="mt-0.5 block text-[10px] font-normal text-muted-foreground">{d.description}</span>
            </button>
          ))}
        </div>
      </div>

      {/* Question Count */}
      <div>
        <label className="text-sm font-semibold">Number of questions</label>
        <div className="mt-2 flex gap-2">
          {QUESTION_COUNTS.map((n) => (
            <button
              key={n}
              onClick={() => setCount(n)}
              disabled={loading}
              className={cn(
                'flex-1 rounded-xl border-2 px-3 py-2 text-sm font-semibold transition-all',
                count === n
                  ? 'border-primary bg-primary/5 shadow-sm'
                  : 'border-border bg-card hover:bg-accent',
              )}
            >
              {n}
            </button>
          ))}
        </div>
      </div>

      {/* Generate */}
      <Button
        onClick={handleGenerate}
        disabled={loading || selectedTopics.length === 0}
        size="lg"
        className="w-full"
      >
        {loading ? (
          <>
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            Generating questions...
          </>
        ) : (
          <>
            <Sparkles className="mr-2 h-4 w-4" />
            Generate Quiz
          </>
        )}
      </Button>
    </div>
  )
}
