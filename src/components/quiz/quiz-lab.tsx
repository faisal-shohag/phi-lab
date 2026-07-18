'use client'

import { useCallback, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { toast } from 'sonner'
import { Loader2, History } from 'lucide-react'
import { refreshXp } from '@/lib/gamification/use-xp'
import { type QuizQuestion, type QuizSessionData, type QuizTopic, type QuizDifficulty } from '@/lib/quiz/topics'
import { resolveErrorCopy } from '@/lib/interview/errors'
import { AnimatedThemeToggler } from '@/components/ui/animated-theme-toggler'
import { UserMenu } from '@/components/auth/user-menu'
import { XpBadge } from '@/components/gamification/xp-badge'
import { Logo } from '@/components/brand/logo'
import { Button } from '@/components/ui/button'
import { SetupScreen } from './setup-screen'
import { QuizPlayer } from './quiz-player'
import { ResultScreen } from './result-screen'
import { HistoryList } from './history-list'
import { cn } from '@/lib/utils'

type Screen = 'setup' | 'playing' | 'result'

interface QuizLabProps {
  initialHistory: QuizSessionData[]
}

export function QuizLab({ initialHistory }: QuizLabProps) {
  const [screen, setScreen] = useState<Screen>('setup')
  const [history, setHistory] = useState(initialHistory)
  const [currentSession, setCurrentSession] = useState<QuizSessionData | null>(null)
  const [loading, setLoading] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [showHistory, setShowHistory] = useState(false)

  const handleGenerate = useCallback(async (topics: QuizTopic[], difficulty: QuizDifficulty, count: number) => {
    setLoading(true)
    try {
      const res = await fetch('/api/quiz/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ topics, difficulty, count }),
      })
      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        toast.error(resolveErrorCopy(data?.error).title, { description: data?.message })
        return
      }
      const data = await res.json() as QuizSessionData
      setCurrentSession(data)
      setScreen('playing')
    } catch {
      toast.error('Could not generate quiz', { description: 'Check your connection and try again.' })
    } finally {
      setLoading(false)
    }
  }, [])

  const handleSubmit = useCallback(async (answers: number[]) => {
    if (!currentSession) return
    setSubmitting(true)
    try {
      const res = await fetch('/api/quiz/submit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sessionId: currentSession.id, answers }),
      })
      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        toast.error(resolveErrorCopy(data?.error).title, { description: data?.message })
        return
      }
      const data = await res.json() as {
        id: string
        score: number
        total: number
        questions: QuizQuestion[]
        answers: number[]
        xpAwarded: number
        status: string
      }
      const completed: QuizSessionData = {
        ...currentSession,
        questions: data.questions,
        answers: data.answers,
        score: data.score,
        total: data.total,
        xpAwarded: data.xpAwarded,
        status: data.status,
      }
      setCurrentSession(completed)
      setHistory((prev) => [completed, ...prev])
      setScreen('result')
      void refreshXp()
    } catch {
      toast.error('Could not submit quiz', { description: 'Check your connection and try again.' })
    } finally {
      setSubmitting(false)
    }
  }, [currentSession])

  function handleRetry() {
    if (!currentSession) return
    setCurrentSession(null)
    setScreen('setup')
    void handleGenerate(
      currentSession.topics as QuizTopic[],
      currentSession.difficulty as QuizDifficulty,
      currentSession.questionCount,
    )
  }

  function handleNewQuiz() {
    setCurrentSession(null)
    setScreen('setup')
  }

  function handleHistorySelect(session: QuizSessionData) {
    if (session.status === 'completed') {
      setCurrentSession(session)
      setScreen('result')
    }
  }

  return (
    <div className="min-h-screen bg-linear-to-br from-zinc-50 via-white to-zinc-100 dark:from-zinc-950 dark:via-zinc-900 dark:to-zinc-950">
      <header className="sticky top-0 z-10 border-b bg-background/70 backdrop-blur-sm">
        <div className="mx-auto flex max-w-6xl items-center gap-3 px-4 py-2.5">
          <Logo className="h-8 w-8" />
          <div>
            <h1 className="text-sm font-bold leading-tight">Quiz Generator</h1>
            <p className="text-[11px] leading-tight text-muted-foreground">Test your knowledge with AI-powered quizzes</p>
          </div>
          <div className="ml-auto flex items-center gap-2">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setShowHistory((h) => !h)}
              className="lg:hidden"
            >
              <History className="h-4 w-4" />
            </Button>
            <AnimatedThemeToggler />
            <XpBadge />
            <UserMenu />
          </div>
        </div>
      </header>

      <main className="mx-auto grid w-full max-w-6xl gap-6 px-4 py-8 lg:grid-cols-[minmax(0,1fr)_minmax(0,320px)]">
        {/* Main content */}
        <div>
          <AnimatePresence mode="wait">
            {screen === 'setup' && (
              <motion.div
                key="setup"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                className="rounded-2xl border-2 border-border bg-card p-5 shadow-sm"
              >
                <h2 className="mb-1 text-base font-bold">Create a Quiz</h2>
                <p className="mb-4 text-xs text-muted-foreground">Pick your topics, difficulty, and how many questions you want.</p>
                <SetupScreen onGenerate={handleGenerate} loading={loading} />
              </motion.div>
            )}

            {screen === 'playing' && currentSession && (
              <motion.div
                key="playing"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                className="rounded-2xl border-2 border-border bg-card p-5 shadow-sm"
              >
                {submitting ? (
                  <div className="flex flex-col items-center justify-center py-16">
                    <Loader2 className="h-8 w-8 animate-spin text-primary" />
                    <p className="mt-3 text-sm font-medium">Submitting your answers...</p>
                  </div>
                ) : (
                  <QuizPlayer
                    questions={currentSession.questions}
                    onSubmit={handleSubmit}
                    submitting={submitting}
                  />
                )}
              </motion.div>
            )}

            {screen === 'result' && currentSession && currentSession.score !== null && (
              <motion.div
                key="result"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
              >
                <ResultScreen
                  questions={currentSession.questions}
                  answers={currentSession.answers ?? []}
                  score={currentSession.score}
                  total={currentSession.total}
                  xpAwarded={currentSession.xpAwarded}
                  onRetry={handleRetry}
                  onNewQuiz={handleNewQuiz}
                  topics={currentSession.topics}
                  difficulty={currentSession.difficulty}
                />
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* History sidebar */}
        <aside className={cn('lg:sticky lg:top-20 lg:self-start', showHistory ? 'block' : 'hidden lg:block')}>
          <div className="rounded-2xl border-2 border-border bg-card p-4 shadow-sm">
            <div className="mb-3 flex items-center justify-between">
              <h3 className="text-sm font-bold">History</h3>
              <span className="text-[10px] text-muted-foreground">
                {history.filter((s) => s.status === 'completed').length} quizzes
              </span>
            </div>
            <HistoryList
              sessions={history}
              onSelect={handleHistorySelect}
              selectedId={currentSession?.id ?? null}
            />
          </div>
        </aside>
      </main>
    </div>
  )
}
