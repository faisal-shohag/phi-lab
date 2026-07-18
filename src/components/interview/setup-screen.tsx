'use client'

import { useState } from 'react'
import { motion } from 'framer-motion'
import {
  FileCode2, Palette, Braces, FileType2, Atom, PanelsTopLeft, Hexagon,
  Server, KeyRound, Database, Check, Clock, Radio,
  HeartHandshake, Briefcase, Gavel, Flame, type LucideIcon,
} from 'lucide-react'
import { TOPICS, LEVELS, PRESSURES, ROUND_SECONDS, type LevelId, type PressureId } from '@/lib/interview/topics'
import { subtopicsForTopic, type Subtopic } from '@/lib/interview/questions'
import { useRoundLength } from '@/lib/labs/use-round-length'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'

const ICONS: Record<string, LucideIcon> = {
  FileCode2, Palette, Braces, FileType2, Atom, PanelsTopLeft, Hexagon, Server, KeyRound, Database,
}

const PRESSURE_ICONS: Record<string, LucideIcon> = {
  HeartHandshake, Briefcase, Gavel, Flame,
}

interface SetupScreenProps {
  /** Advance to the green room to choose voice/language and check the mic. */
  onContinue: (topic: string, level: LevelId, pressure: PressureId, subtopicIds: string[]) => void
  /** Optional signed-in user name for a friendly greeting. */
  greeting?: string
}

export function SetupScreen({ onContinue, greeting }: SetupScreenProps) {
  const [topic, setTopic] = useState<string | null>(null)
  const [level, setLevel] = useState<LevelId>('medium')
  const [pressure, setPressure] = useState<PressureId>('neutral')
  const [selectedSubtopics, setSelectedSubtopics] = useState<Set<string>>(new Set())
  const [showQuestions, setShowQuestions] = useState(false)
  // Admin-tunable; ROUND_SECONDS is only the pre-fetch placeholder.
  const roundSeconds = useRoundLength('interview', ROUND_SECONDS)

  // Derive subtopics from the selected topic.
  const topicData = topic ? subtopicsForTopic(topic) : undefined
  const subtopics: Subtopic[] = topicData?.subtopics ?? []
  const questions = topicData?.questions ?? []

  // When topic changes, default-select all subtopics.
  const handleTopicSelect = (id: string) => {
    if (id !== topic) {
      const data = subtopicsForTopic(id)
      if (data) {
        setSelectedSubtopics(new Set(data.subtopics.map((s) => s.id)))
      } else {
        setSelectedSubtopics(new Set())
      }
    }
    setTopic(id)
  }

  const toggleSubtopic = (id: string) => {
    setSelectedSubtopics((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  const selectAllSubtopics = () => {
    setSelectedSubtopics(new Set(subtopics.map((s) => s.id)))
  }

  const questionsForSubtopic = (subId: string) =>
    questions.filter((q) => q.subtopicId === subId)

  const canContinue = !!topic && selectedSubtopics.size > 0

  return (
    <div className="relative mx-auto w-full max-w-3xl px-4 py-8 sm:py-12">
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}
        className="text-center"
      >
       

        <div className="relative mx-auto mt-5 flex h-16 w-16 items-center justify-center">
          <div className="absolute inset-0 rounded-2xl bg-linear-to-br from-amber-500 via-fuchsia-500 to-violet-600 opacity-40 blur-xl" aria-hidden />
          <div className="relative flex h-14 w-14 items-center justify-center rounded-2xl bg-linear-to-br from-amber-500 via-fuchsia-500 to-violet-600 shadow-lg shadow-fuchsia-500/20">
            <Radio className="h-7 w-7 text-white" />
          </div>
        </div>

        <h1 className="mt-4 text-2xl font-bold tracking-tight sm:text-3xl">
          {greeting ? (
            <>Ready when you are, {greeting.split(' ')[0]}</>
          ) : (
            <>
              Live{' '}
              <span className="bg-linear-to-br from-amber-500 via-fuchsia-500 to-violet-600 bg-clip-text text-transparent">
                Technical Interview
              </span>
            </>
          )}
        </h1>
        <p className="mx-auto mt-2 max-w-md text-sm leading-relaxed text-muted-foreground">
          A voice conversation with an AI interviewer. Pick a topic and level, then talk it out for one{' '}
          <span className="font-semibold text-foreground">{Math.round(roundSeconds / 60)}-minute</span> round.
        </p>
      </motion.div>

      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, delay: 0.1 }}
        className="mt-8 rounded-3xl border bg-card/60 p-4 shadow-xl shadow-black/[0.03] backdrop-blur-sm sm:p-6 dark:shadow-black/10"
      >
        {/* Topic grid */}
        <section>
          <h2 className="mb-3 text-sm font-semibold text-muted-foreground">1. Choose a topic</h2>
          <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-3 lg:grid-cols-5">
            {TOPICS.map((t) => {
              const Icon = ICONS[t.icon] ?? Braces
              const selected = topic === t.id
              return (
                <button
                  key={t.id}
                  onClick={() => handleTopicSelect(t.id)}
                  title={t.blurb}
                  className={cn(
                    'group flex flex-col items-start gap-2 rounded-xl border-2 p-3 text-left transition-all duration-150',
                    selected
                      ? 'border-fuchsia-500/60 bg-linear-to-br from-amber-500/10 via-fuchsia-500/10 to-violet-600/10 shadow-md'
                      : 'border-border bg-card hover:-translate-y-0.5 hover:border-fuchsia-300/60 hover:bg-accent hover:shadow-md',
                  )}
                >
                  <div
                    className={cn(
                      'flex h-8 w-8 items-center justify-center rounded-lg transition-colors',
                      selected
                        ? 'bg-linear-to-br from-amber-500 via-fuchsia-500 to-violet-600 text-white shadow-sm'
                        : 'bg-muted text-muted-foreground group-hover:text-foreground',
                    )}
                  >
                    <Icon className="h-4 w-4" />
                  </div>
                  <span className="text-sm font-semibold leading-tight">{t.label}</span>
                </button>
              )
            })}
          </div>
        </section>

        {/* Subtopic chips — only visible after topic selection */}
        {subtopics.length > 0 && (
          <section className="mt-6 border-t pt-6">
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-semibold text-muted-foreground">2. Pick sub-topics</h2>
              <button
                type="button"
                onClick={selectAllSubtopics}
                className="text-[11px] font-medium text-fuchsia-600 hover:text-fuchsia-700 dark:text-fuchsia-400 dark:hover:text-fuchsia-300"
              >
                Select all
              </button>
            </div>
            <p className="mb-3 text-[11px] text-muted-foreground">
              The AI interviewer will shift between these areas. Unselect any you want to skip.
            </p>
            <div className="flex flex-wrap gap-2">
              {subtopics.map((st) => {
                const selected = selectedSubtopics.has(st.id)
                const count = questionsForSubtopic(st.id).length
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
                    {selected ? (
                      <Check className="h-3 w-3" />
                    ) : (
                      <span className="h-3 w-3 rounded-full border border-current opacity-50" />
                    )}
                    {st.label}
                    {count > 0 && (
                      <span className={cn(
                        'ml-0.5 rounded-full px-1.5 py-0.5 text-[10px] leading-none',
                        selected
                          ? 'bg-fuchsia-500/15 text-fuchsia-600 dark:text-fuchsia-400'
                          : 'bg-muted text-muted-foreground',
                      )}>
                        {count}
                      </span>
                    )}
                  </button>
                )
              })}
            </div>

            {/* Sample questions preview */}
            {questions.length > 0 && (
              <div className="mt-4">
                <button
                  type="button"
                  onClick={() => setShowQuestions(!showQuestions)}
                  className="flex items-center gap-1.5 text-[11px] font-medium text-muted-foreground hover:text-foreground transition-colors"
                >
                  <FileCode2 className="h-3 w-3" />
                  {showQuestions ? 'Hide' : 'Preview'} sample questions ({questions.length})
                </button>
                {showQuestions && (
                  <motion.div
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: 'auto', opacity: 1 }}
                    transition={{ duration: 0.2 }}
                    className="mt-2 max-h-48 overflow-y-auto rounded-xl border bg-muted/30 p-3 space-y-2"
                  >
                    {subtopics.filter((st) => selectedSubtopics.has(st.id)).map((st) => {
                      const stQuestions = questionsForSubtopic(st.id)
                      if (stQuestions.length === 0) return null
                      return (
                        <div key={st.id}>
                          <p className="text-[11px] font-semibold text-muted-foreground mb-1">{st.label}</p>
                          <ul className="space-y-1">
                            {stQuestions.map((q, i) => (
                              <li key={i} className="text-xs text-foreground/80 flex gap-2">
                                <span className="shrink-0 text-[10px] font-mono text-muted-foreground mt-0.5">
                                  {q.difficulty === 'easy' ? '●' : q.difficulty === 'medium' ? '●●' : '●●●'}
                                </span>
                                {q.text}
                              </li>
                            ))}
                          </ul>
                        </div>
                      )
                    })}
                  </motion.div>
                )}
              </div>
            )}
          </section>
        )}

        {/* Level segmented control */}
        <section className="mt-6 border-t pt-6">
          <h2 className="mb-3 text-sm font-semibold text-muted-foreground">{subtopics.length > 0 ? '3' : '2'}. Pick a difficulty</h2>
          <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-3">
            {LEVELS.map((l) => {
              const selected = level === l.id
              return (
                <button
                  key={l.id}
                  onClick={() => setLevel(l.id)}
                  className={cn(
                    'rounded-xl border-2 p-3 text-left transition-all duration-150',
                    selected
                      ? 'border  text-white shadow-md bg-linear-to-r from-pink-500 to-red-500'
                      : 'border-border bg-card hover:border-foreground/30 hover:bg-accent',
                  )}
                >
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-semibold">{l.label}</span>
                    {selected && <Check className="h-3.5 w-3.5" />}
                  </div>
                  <p className={cn('mt-1 text-[11px] leading-snug', selected ? ' dark:text-zinc-100' : 'text-muted-foreground dark:text-zinc-100')}>
                    {l.description}
                  </p>
                </button>
              )
            })}
          </div>
        </section>

        {/* Pressure / demeanor — the Anxiety Trainer dimension */}
        <section className="mt-6 border-t pt-6">
          <h2 className="mb-1 text-sm font-semibold text-muted-foreground">{subtopics.length > 0 ? '4' : '3'}. Set the pressure</h2>
          <p className="mb-3 text-[11px] text-muted-foreground">
            Same questions, different nerves. Ramp up to train composure under a tough panel.
          </p>
          <div className="grid grid-cols-2 gap-2.5 lg:grid-cols-4">
            {PRESSURES.map((p) => {
              const Icon = PRESSURE_ICONS[p.icon] ?? Briefcase
              const selected = pressure === p.id
              return (
                <button
                  key={p.id}
                  onClick={() => setPressure(p.id)}
                  title={p.description}
                  className={cn(
                    'group flex flex-col items-start gap-2 rounded-xl border-2 p-3 text-left transition-all duration-150',
                    selected
                      ? 'border-transparent text-white shadow-md bg-linear-to-br ' + p.tint
                      : 'border-border bg-card hover:-translate-y-0.5 hover:border-foreground/30 hover:bg-accent hover:shadow-md',
                  )}
                >
                  <div
                    className={cn(
                      'flex h-8 w-8 items-center justify-center rounded-lg transition-colors',
                      selected ? 'bg-white/20 text-white' : 'bg-muted text-muted-foreground group-hover:text-foreground',
                    )}
                  >
                    <Icon className="h-4 w-4" />
                  </div>
                  <div className="flex items-center gap-1.5">
                    <span className="text-sm font-semibold leading-tight">{p.label}</span>
                    {selected && <Check className="h-3.5 w-3.5" />}
                  </div>
                  <p className={cn('text-[11px] leading-snug', selected ? 'text-white/90' : 'text-muted-foreground')}>
                    {p.description}
                  </p>
                </button>
              )
            })}
          </div>
        </section>
      </motion.div>

      {/* Continue to green room */}
      <div className="mt-8 flex flex-col items-center gap-2">
        <Button
          size="lg"
          className="h-12 w-full max-w-xs border-0 bg-linear-to-r from-amber-500 via-fuchsia-500 to-violet-600 text-base text-white shadow-lg shadow-fuchsia-500/25 transition-all hover:shadow-xl hover:shadow-fuchsia-500/30 hover:brightness-105"
          disabled={!canContinue}
          onClick={() => topic && onContinue(topic, level, pressure, Array.from(selectedSubtopics))}
        >
          Continue
        </Button>
        <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
          <Clock className="h-3.5 w-3.5" />
          Next: pick your interviewer, language & check your mic
        </p>
      </div>
    </div>
  )
}
