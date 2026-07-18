'use client'

import { useState, useMemo } from 'react'
import Link from 'next/link'
import { motion, AnimatePresence } from 'framer-motion'
import {
  ArrowLeft, Search, BookOpen, Filter, ChevronDown, ChevronUp,
  FileCode2, Palette, Braces, FileType2, Atom, PanelsTopLeft, Hexagon,
  Server, KeyRound, Database, type LucideIcon,
} from 'lucide-react'
import { TOPICS } from '@/lib/interview/topics'
import { TOPIC_SUBTOPICS, type BankQuestion, type Subtopic } from '@/lib/interview/questions'
import { AnimatedThemeToggler } from '@/components/ui/animated-theme-toggler'
import { UserMenu } from '@/components/auth/user-menu'
import { Logo } from '@/components/brand/logo'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { cn } from '@/lib/utils'

const ICONS: Record<string, LucideIcon> = {
  FileCode2, Palette, Braces, FileType2, Atom, PanelsTopLeft, Hexagon, Server, KeyRound, Database,
}

type Difficulty = 'easy' | 'medium' | 'expert'

const DIFFICULTY_CONFIG: Record<Difficulty, { label: string; color: string; dots: string }> = {
  easy: { label: 'Easy', color: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-300', dots: '●○○' },
  medium: { label: 'Medium', color: 'bg-amber-100 text-amber-700 dark:bg-amber-950/50 dark:text-amber-300', dots: '●●○' },
  expert: { label: 'Expert', color: 'bg-rose-100 text-rose-700 dark:bg-rose-950/50 dark:text-rose-300', dots: '●●●' },
}

interface QuestionWithMeta extends BankQuestion {
  topicId: string
  topicLabel: string
  subtopicLabel: string
}

export default function QuestionBankPage() {
  const [selectedTopic, setSelectedTopic] = useState<string | null>(null)
  const [selectedSubtopics, setSelectedSubtopics] = useState<Set<string>>(new Set())
  const [selectedDifficulties, setSelectedDifficulties] = useState<Set<Difficulty>>(new Set(['easy', 'medium', 'expert']))
  const [search, setSearch] = useState('')
  const [expanded, setExpanded] = useState<Set<number>>(new Set())

  // Flatten all questions with metadata
  const allQuestions = useMemo(() => {
    const questions: QuestionWithMeta[] = []
    for (const topicData of TOPIC_SUBTOPICS) {
      const topicLabel = TOPICS.find((t) => t.id === topicData.topicId)?.label ?? topicData.topicId
      for (const sub of topicData.subtopics) {
        const subQuestions = topicData.questions.filter((q) => q.subtopicId === sub.id)
        for (const q of subQuestions) {
          questions.push({
            ...q,
            topicId: topicData.topicId,
            topicLabel,
            subtopicLabel: sub.label,
          })
        }
      }
    }
    return questions
  }, [])

  // Get subtopics for selected topic
  const topicSubtopics = useMemo(() => {
    if (!selectedTopic) return []
    return TOPIC_SUBTOPICS.find((t) => t.topicId === selectedTopic)?.subtopics ?? []
  }, [selectedTopic])

  // Filter questions
  const filtered = useMemo(() => {
    return allQuestions.filter((q) => {
      if (selectedTopic && q.topicId !== selectedTopic) return false
      if (selectedSubtopics.size > 0 && !selectedSubtopics.has(q.subtopicId)) return false
      if (!selectedDifficulties.has(q.difficulty)) return false
      if (search) {
        const lower = search.toLowerCase()
        if (
          !q.text.toLowerCase().includes(lower) &&
          !q.subtopicLabel.toLowerCase().includes(lower) &&
          !q.topicLabel.toLowerCase().includes(lower)
        ) return false
      }
      return true
    })
  }, [allQuestions, selectedTopic, selectedSubtopics, selectedDifficulties, search])

  // Stats
  const stats = useMemo(() => {
    const total = filtered.length
    const byDifficulty = { easy: 0, medium: 0, expert: 0 } as Record<Difficulty, number>
    for (const q of filtered) byDifficulty[q.difficulty]++
    return { total, byDifficulty }
  }, [filtered])

  const handleTopicSelect = (topicId: string) => {
    if (topicId === selectedTopic) {
      setSelectedTopic(null)
      setSelectedSubtopics(new Set())
    } else {
      setSelectedTopic(topicId)
      setSelectedSubtopics(new Set())
    }
  }

  const toggleSubtopic = (id: string) => {
    setSelectedSubtopics((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  const toggleDifficulty = (d: Difficulty) => {
    setSelectedDifficulties((prev) => {
      const next = new Set(prev)
      if (next.has(d)) next.delete(d)
      else next.add(d)
      return next
    })
  }

  const toggleExpand = (idx: number) => {
    setExpanded((prev) => {
      const next = new Set(prev)
      if (next.has(idx)) next.delete(idx)
      else next.add(idx)
      return next
    })
  }

  const expandAll = () => {
    setExpanded(new Set(filtered.map((_, i) => i)))
  }

  const collapseAll = () => {
    setExpanded(new Set())
  }

  return (
    <div className="min-h-screen bg-linear-to-br from-slate-50 via-white to-slate-100 dark:from-slate-950 dark:via-slate-900 dark:to-slate-950">
      <header className="sticky top-0 z-10 border-b bg-background/70 backdrop-blur-sm">
        <div className="mx-auto flex max-w-5xl items-center gap-3 px-4 py-2.5">
          <Logo className="h-8 w-8" />
          <div>
            <h1 className="text-sm font-bold leading-tight">Question Bank</h1>
            <p className="text-[11px] leading-tight text-muted-foreground">Browse all interview questions</p>
          </div>
          <div className="ml-auto flex items-center gap-2">
            <Button asChild variant="ghost" size="sm">
              <Link href="/labs/interview">
                <ArrowLeft className="h-4 w-4" />
                <span className="hidden sm:inline">New interview</span>
              </Link>
            </Button>
            <AnimatedThemeToggler />
            <UserMenu showHistory={false} />
          </div>
        </div>
      </header>

      <main className="mx-auto w-full max-w-5xl px-4 py-8">
        {/* Topic pills */}
        <section>
          <h2 className="mb-3 text-sm font-semibold text-muted-foreground">Topic</h2>
          <div className="flex flex-wrap gap-2">
            {TOPICS.map((t) => {
              const Icon = ICONS[t.icon] ?? Braces
              const selected = selectedTopic === t.id
              const count = allQuestions.filter((q) => q.topicId === t.id).length
              return (
                <button
                  key={t.id}
                  onClick={() => handleTopicSelect(t.id)}
                  className={cn(
                    'inline-flex items-center gap-2 rounded-xl border-2 px-3 py-2 text-xs font-medium transition-all duration-150',
                    selected
                      ? 'border-fuchsia-500/60 bg-fuchsia-500/10 text-fuchsia-700 shadow-sm dark:text-fuchsia-300'
                      : 'border-border bg-card text-muted-foreground hover:border-fuchsia-300/50 hover:text-foreground',
                  )}
                >
                  <Icon className="h-3.5 w-3.5" />
                  {t.label}
                  <span className={cn(
                    'rounded-full px-1.5 py-0.5 text-[10px] leading-none',
                    selected
                      ? 'bg-fuchsia-500/15 text-fuchsia-600 dark:text-fuchsia-400'
                      : 'bg-muted text-muted-foreground',
                  )}>
                    {count}
                  </span>
                </button>
              )
            })}
          </div>
        </section>

        {/* Subtopic chips — only when a topic is selected */}
        {topicSubtopics.length > 0 && (
          <motion.section
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            transition={{ duration: 0.2 }}
            className="mt-4"
          >
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-semibold text-muted-foreground">Sub-topics</h2>
              <button
                type="button"
                onClick={() => setSelectedSubtopics(new Set(topicSubtopics.map((s) => s.id)))}
                className="text-[11px] font-medium text-fuchsia-600 hover:text-fuchsia-700 dark:text-fuchsia-400 dark:hover:text-fuchsia-300"
              >
                Select all
              </button>
            </div>
            <div className="mt-2 flex flex-wrap gap-2">
              {topicSubtopics.map((st) => {
                const selected = selectedSubtopics.has(st.id)
                const count = allQuestions.filter((q) => q.topicId === selectedTopic && q.subtopicId === st.id).length
                return (
                  <button
                    key={st.id}
                    onClick={() => toggleSubtopic(st.id)}
                    className={cn(
                      'inline-flex items-center gap-1.5 rounded-full border-2 px-3 py-1.5 text-xs font-medium transition-all duration-150',
                      selected
                        ? 'border-fuchsia-500/60 bg-fuchsia-500/10 text-fuchsia-700 shadow-sm dark:text-fuchsia-300'
                        : 'border-border bg-card text-muted-foreground hover:border-fuchsia-300/50 hover:text-foreground',
                    )}
                  >
                    {st.label}
                    <span className={cn(
                      'rounded-full px-1.5 py-0.5 text-[10px] leading-none',
                      selected
                        ? 'bg-fuchsia-500/15 text-fuchsia-600 dark:text-fuchsia-400'
                        : 'bg-muted text-muted-foreground',
                    )}>
                      {count}
                    </span>
                  </button>
                )
              })}
            </div>
          </motion.section>
        )}

        {/* Difficulty filter + search */}
        <section className="mt-6 flex flex-wrap items-center gap-4">
          <div className="flex items-center gap-2">
            <Filter className="h-3.5 w-3.5 text-muted-foreground" />
            <span className="text-xs font-semibold text-muted-foreground">Difficulty</span>
            {(['easy', 'medium', 'expert'] as Difficulty[]).map((d) => {
              const cfg = DIFFICULTY_CONFIG[d]
              const selected = selectedDifficulties.has(d)
              return (
                <button
                  key={d}
                  onClick={() => toggleDifficulty(d)}
                  className={cn(
                    'rounded-full border-2 px-2.5 py-1 text-[11px] font-medium transition-all',
                    selected
                      ? cn('border-current shadow-sm', cfg.color)
                      : 'border-border bg-card text-muted-foreground hover:border-foreground/30',
                  )}
                >
                  {cfg.label}
                </button>
              )
            })}
          </div>

          <div className="relative ml-auto">
            <Search className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search questions..."
              className="h-8 w-48 rounded-lg border bg-card pl-8 pr-3 text-xs text-foreground placeholder:text-muted-foreground focus:border-fuchsia-500/50 focus:outline-none focus:ring-1 focus:ring-fuchsia-500/20"
            />
          </div>
        </section>

        {/* Stats bar */}
        <div className="mt-4 flex items-center gap-4 text-xs text-muted-foreground">
          <span className="font-semibold">{stats.total} question{stats.total !== 1 ? 's' : ''}</span>
          <span className="text-emerald-600 dark:text-emerald-400">{stats.byDifficulty.easy} easy</span>
          <span className="text-amber-600 dark:text-amber-400">{stats.byDifficulty.medium} medium</span>
          <span className="text-rose-600 dark:text-rose-400">{stats.byDifficulty.expert} expert</span>
          <div className="ml-auto flex gap-2">
            <button onClick={expandAll} className="hover:text-foreground transition-colors">Expand all</button>
            <span className="text-muted-foreground/50">·</span>
            <button onClick={collapseAll} className="hover:text-foreground transition-colors">Collapse all</button>
          </div>
        </div>

        {/* Question list */}
        <div className="mt-4 space-y-2">
          <AnimatePresence mode="popLayout">
            {filtered.length === 0 ? (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="flex flex-col items-center gap-3 rounded-2xl border-2 border-border bg-card py-12 text-center"
              >
                <BookOpen className="h-8 w-8 text-muted-foreground/50" />
                <p className="text-sm font-semibold">No questions match your filters</p>
                <p className="text-xs text-muted-foreground">Try adjusting your topic, difficulty, or search term.</p>
              </motion.div>
            ) : (
              filtered.map((q, idx) => {
                const isExpanded = expanded.has(idx)
                const diffCfg = DIFFICULTY_CONFIG[q.difficulty]
                return (
                  <motion.div
                    key={`${q.topicId}-${q.subtopicId}-${idx}`}
                    layout
                    initial={{ opacity: 0, y: 5 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -5 }}
                    transition={{ duration: 0.15 }}
                    className="rounded-xl border-2 border-border bg-card shadow-sm overflow-hidden"
                  >
                    <button
                      onClick={() => toggleExpand(idx)}
                      className="flex w-full items-start gap-3 p-3.5 text-left hover:bg-accent/50 transition-colors"
                    >
                      <span className={cn('mt-0.5 shrink-0 text-[10px] font-mono', diffCfg.color, 'rounded-full px-1.5 py-0.5')}>
                        {diffCfg.dots}
                      </span>
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-medium leading-snug">{q.text}</p>
                        <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
                          <Badge variant="secondary" className="text-[10px]">{q.topicLabel}</Badge>
                          <Badge variant="outline" className="text-[10px]">{q.subtopicLabel}</Badge>
                          <span className={cn('rounded-full px-1.5 py-0.5 text-[10px] font-semibold', diffCfg.color)}>
                            {diffCfg.label}
                          </span>
                        </div>
                      </div>
                      {isExpanded ? (
                        <ChevronUp className="h-4 w-4 shrink-0 text-muted-foreground mt-0.5" />
                      ) : (
                        <ChevronDown className="h-4 w-4 shrink-0 text-muted-foreground mt-0.5" />
                      )}
                    </button>
                    <AnimatePresence>
                      {isExpanded && (
                        <motion.div
                          initial={{ height: 0 }}
                          animate={{ height: 'auto' }}
                          exit={{ height: 0 }}
                          transition={{ duration: 0.2 }}
                          className="overflow-hidden"
                        >
                          <div className="border-t bg-muted/30 px-3.5 py-3">
                            <p className="text-xs font-semibold text-muted-foreground mb-2">What the interviewer is looking for:</p>
                            <ul className="space-y-1.5 text-xs text-foreground/80">
                              <li className="flex gap-2">
                                <span className="text-fuchsia-500 mt-0.5">→</span>
                                <span>Demonstrate understanding of core concepts</span>
                              </li>
                              <li className="flex gap-2">
                                <span className="text-fuchsia-500 mt-0.5">→</span>
                                <span>Provide real-world examples or use cases</span>
                              </li>
                              <li className="flex gap-2">
                                <span className="text-fuchsia-500 mt-0.5">→</span>
                                <span>Explain trade-offs and alternatives</span>
                              </li>
                            </ul>
                            <p className="mt-3 text-[11px] text-muted-foreground italic">
                              This question may appear in an interview about {q.topicLabel}, focusing on {q.subtopicLabel}.
                            </p>
                          </div>
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </motion.div>
                )
              })
            )}
          </AnimatePresence>
        </div>
      </main>
    </div>
  )
}
