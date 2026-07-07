'use client'

import { useState } from 'react'
import { motion } from 'framer-motion'
import {
  FileCode2, Palette, Braces, FileType2, Atom, PanelsTopLeft, Hexagon,
  Server, KeyRound, Database, Check, Clock, Radio, type LucideIcon,
} from 'lucide-react'
import { TOPICS, LEVELS, ROUND_SECONDS, type LevelId } from '@/lib/interview/topics'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'

const ICONS: Record<string, LucideIcon> = {
  FileCode2, Palette, Braces, FileType2, Atom, PanelsTopLeft, Hexagon, Server, KeyRound, Database,
}

interface SetupScreenProps {
  /** Advance to the green room to choose voice/language and check the mic. */
  onContinue: (topic: string, level: LevelId) => void
  /** Optional signed-in user name for a friendly greeting. */
  greeting?: string
}

export function SetupScreen({ onContinue, greeting }: SetupScreenProps) {
  const [topic, setTopic] = useState<string | null>(null)
  const [level, setLevel] = useState<LevelId>('medium')

  const canContinue = !!topic

  return (
    <div className="mx-auto w-full max-w-3xl px-4 py-8 sm:py-12">
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}
        className="text-center"
      >
        <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-linear-to-br from-amber-500 via-fuchsia-500 to-violet-600 shadow-lg">
          <Radio className="h-7 w-7 text-white" />
        </div>
        <h1 className="text-2xl font-bold sm:text-3xl">
          {greeting ? `Ready when you are, ${greeting.split(' ')[0]}` : 'Live Technical Interview'}
        </h1>
        <p className="mt-2 text-sm text-muted-foreground">
          A voice conversation with an AI interviewer. Pick a topic and level, then talk it out for one{' '}
          <span className="font-semibold text-foreground">{Math.round(ROUND_SECONDS / 60)}-minute</span> round.
        </p>
      </motion.div>

      {/* Topic grid */}
      <section className="mt-8">
        <h2 className="mb-3 text-sm font-semibold text-muted-foreground">1. Choose a topic</h2>
        <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-3 lg:grid-cols-5">
          {TOPICS.map((t) => {
            const Icon = ICONS[t.icon] ?? Braces
            const selected = topic === t.id
            return (
              <button
                key={t.id}
                onClick={() => setTopic(t.id)}
                title={t.blurb}
                className={cn(
                  'group flex flex-col items-start gap-2 rounded-xl border-2 p-3 text-left transition-all duration-150',
                  selected
                    ? 'border-amber-500 bg-amber-50 shadow-md dark:bg-amber-950/40'
                    : 'border-border bg-card hover:border-amber-300 hover:bg-accent',
                )}
              >
                <div
                  className={cn(
                    'flex h-8 w-8 items-center justify-center rounded-lg transition-colors',
                    selected ? 'bg-amber-500 text-white' : 'bg-muted text-muted-foreground group-hover:text-foreground',
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

      {/* Level segmented control */}
      <section className="mt-6">
        <h2 className="mb-3 text-sm font-semibold text-muted-foreground">2. Pick a difficulty</h2>
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
                    ? 'border-foreground bg-foreground text-background shadow-md'
                    : 'border-border bg-card hover:border-foreground/30 hover:bg-accent',
                )}
              >
                <div className="flex items-center gap-2">
                  <span className="text-sm font-semibold">{l.label}</span>
                  {selected && <Check className="h-3.5 w-3.5" />}
                </div>
                <p className={cn('mt-1 text-[11px] leading-snug', selected ? 'text-background/70' : 'text-muted-foreground')}>
                  {l.description}
                </p>
              </button>
            )
          })}
        </div>
      </section>

      {/* Continue to green room */}
      <div className="mt-8 flex flex-col items-center gap-2">
        <Button size="lg" className="h-12 w-full max-w-xs text-base" disabled={!canContinue} onClick={() => topic && onContinue(topic, level)}>
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
