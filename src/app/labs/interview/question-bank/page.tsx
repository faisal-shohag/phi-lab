'use client'

import { useState, useMemo, useRef, useEffect } from 'react'
import Link from 'next/link'
import { motion, AnimatePresence } from 'framer-motion'
import {
  ArrowLeft, Search, BookOpen, Filter, ChevronDown, ChevronUp,
  MessageCircle, Send, Loader2, X,
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
import { HiveMarkdown } from '@/components/hive/markdown'
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
  const [chatQuestion, setChatQuestion] = useState<QuestionWithMeta | null>(null)
  const [chatMessages, setChatMessages] = useState<{ role: 'user' | 'assistant'; content: string }[]>([])
  const [chatInput, setChatInput] = useState('')
  const [chatLoading, setChatLoading] = useState(false)
  const chatEndRef = useRef<HTMLDivElement>(null)

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

  const openChat = (q: QuestionWithMeta) => {
    setChatQuestion(q)
    setChatMessages([])
    setChatInput('')
  }

  const closeChat = () => {
    setChatQuestion(null)
    setChatMessages([])
    setChatInput('')
  }

  const sanitize = (s: string) =>
    s.replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F\u200B-\u200F\u2028-\u202F\uFEFF]/g, '').trim()

  const sendChat = async () => {
    const raw = sanitize(chatInput)
    if (!raw || !chatQuestion || chatLoading) return
    const userMsg = raw
    setChatInput('')
    setChatMessages((prev) => [...prev, { role: 'user', content: userMsg }])
    setChatLoading(true)

    try {
      const res = await fetch('/api/interview/question-chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          question: chatQuestion.text,
          answer: chatQuestion.answer,
          topic: chatQuestion.topicLabel,
          subtopic: chatQuestion.subtopicLabel,
          message: userMsg,
          history: chatMessages,
        }),
      })
      const data = await res.json()
      setChatMessages((prev) => [...prev, { role: 'assistant', content: data.reply ?? 'Sorry, I could not generate a response.' }])
    } catch {
      setChatMessages((prev) => [...prev, { role: 'assistant', content: 'Failed to get a response. Please try again.' }])
    } finally {
      setChatLoading(false)
    }
  }

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [chatMessages])

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
                            <p className="text-xs font-semibold text-muted-foreground mb-2">Answer:</p>
                            <p className="text-sm text-foreground/90 leading-relaxed">{q.answer}</p>
                            <div className="mt-3 flex items-center gap-2">
                              <Button
                                size="sm"
                                variant="outline"
                                className="h-7 text-[11px] gap-1.5 border-fuchsia-500/30 text-fuchsia-600 hover:bg-fuchsia-500/10 dark:text-fuchsia-400"
                                onClick={(e) => { e.stopPropagation(); openChat(q) }}
                              >
                                <MessageCircle className="h-3 w-3" />
                                Ask AI about this
                              </Button>
                            </div>
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

      {/* Chat panel overlay */}
      <AnimatePresence>
        {chatQuestion && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-end justify-end bg-black/40 p-4 sm:items-center sm:justify-end"
            onClick={closeChat}
          >
            <motion.div
              initial={{ x: 400, opacity: 0 }}
              animate={{ x: 0, opacity: 1 }}
              exit={{ x: 400, opacity: 0 }}
              transition={{ type: 'spring', damping: 25, stiffness: 300 }}
              onClick={(e) => e.stopPropagation()}
              className="flex h-[80vh] w-full max-w-md flex-col rounded-2xl border-2 border-border bg-card shadow-2xl"
            >
              {/* Chat header */}
              <div className="flex items-center gap-3 border-b px-4 py-3">
                <div className="flex h-8 w-8 items-center justify-center rounded-full bg-fuchsia-500/10">
                  <MessageCircle className="h-4 w-4 text-fuchsia-600 dark:text-fuchsia-400" />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-semibold">Ask AI</p>
                  <p className="truncate text-[11px] text-muted-foreground">{chatQuestion.topicLabel} · {chatQuestion.subtopicLabel}</p>
                </div>
                <button onClick={closeChat} className="rounded-lg p-1.5 hover:bg-accent transition-colors">
                  <X className="h-4 w-4" />
                </button>
              </div>

              {/* Question context */}
              <div className="border-b bg-muted/30 px-4 py-3">
                <p className="text-[11px] font-semibold text-muted-foreground mb-1">Question</p>
                <p className="text-xs text-foreground/80 leading-relaxed">{chatQuestion.text}</p>
                <p className="mt-2 text-[11px] font-semibold text-muted-foreground mb-1">Answer</p>
                <p className="text-xs text-foreground/80 leading-relaxed">{chatQuestion.answer}</p>
              </div>

              {/* Messages */}
              <div className="flex-1 overflow-y-auto px-4 py-3 space-y-3">
                {chatMessages.length === 0 && (
                  <div className="flex flex-col items-center gap-2 py-8 text-center">
                    <MessageCircle className="h-8 w-8 text-muted-foreground/30" />
                    <p className="text-xs text-muted-foreground">Ask anything about this question to learn more.</p>
                    <div className="mt-2 flex flex-wrap gap-1.5">
                      {['Can you explain this in simpler terms?', 'Give me a real-world example.', 'What are common mistakes?'].map((suggestion) => (
                        <button
                          key={suggestion}
                          onClick={() => { setChatInput(suggestion) }}
                          className="rounded-full border bg-card px-2.5 py-1 text-[10px] text-muted-foreground hover:border-fuchsia-300/50 hover:text-foreground transition-colors"
                        >
                          {suggestion}
                        </button>
                      ))}
                    </div>
                  </div>
                )}
                {chatMessages.map((msg, i) => (
                  <div key={i} className={cn('flex', msg.role === 'user' ? 'justify-end' : 'justify-start')}>
                    <div className={cn(
                      'max-w-[85%] rounded-xl px-3 py-2 text-xs leading-relaxed',
                      msg.role === 'user'
                        ? 'bg-fuchsia-500 text-white'
                        : 'bg-muted text-foreground',
                    )}>
                      {msg.role === 'user'
                        ? msg.content
                        : <HiveMarkdown className="text-xs">{msg.content}</HiveMarkdown>
                      }
                    </div>
                  </div>
                ))}
                {chatLoading && (
                  <div className="flex justify-start">
                    <div className="rounded-xl bg-muted px-3 py-2 text-xs">
                      <Loader2 className="h-3 w-3 animate-spin" />
                    </div>
                  </div>
                )}
                <div ref={chatEndRef} />
              </div>

              {/* Input */}
              <div className="border-t px-4 py-3">
                <div className="flex items-center gap-2">
                  <input
                    type="text"
                    value={chatInput}
                    onChange={(e) => setChatInput(e.target.value)}
                    onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendChat() } }}
                    placeholder="Ask a follow-up question..."
                    className="flex-1 rounded-xl border bg-background px-3 py-2 text-xs placeholder:text-muted-foreground focus:border-fuchsia-500/50 focus:outline-none focus:ring-1 focus:ring-fuchsia-500/20"
                  />
                  <Button
                    size="sm"
                    onClick={sendChat}
                    disabled={!chatInput.trim() || chatLoading}
                    className="h-8 w-8 rounded-xl p-0 bg-fuchsia-500 hover:bg-fuchsia-600"
                  >
                    <Send className="h-3.5 w-3.5" />
                  </Button>
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
