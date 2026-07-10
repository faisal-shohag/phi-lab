'use client'

import { useState } from 'react'
import { motion } from 'framer-motion'
import {
  FileCode2, Palette, Braces, FileType2, Atom, PanelsTopLeft, Hexagon,
  Server, KeyRound, Database, Check, Clock, Radio,
  HeartHandshake, Briefcase, Gavel, Flame, type LucideIcon,
} from 'lucide-react'
import { TOPICS, LEVELS, PRESSURES, ROUND_SECONDS, type LevelId, type PressureId } from '@/lib/interview/topics'
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
  onContinue: (topic: string, level: LevelId, pressure: PressureId) => void
  /** Optional signed-in user name for a friendly greeting. */
  greeting?: string
}

export function SetupScreen({ onContinue, greeting }: SetupScreenProps) {
  const [topic, setTopic] = useState<string | null>(null)
  const [level, setLevel] = useState<LevelId>('medium')
  const [pressure, setPressure] = useState<PressureId>('neutral')
  // Admin-tunable; ROUND_SECONDS is only the pre-fetch placeholder.
  const roundSeconds = useRoundLength('interview', ROUND_SECONDS)

  const canContinue = !!topic

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
                  onClick={() => setTopic(t.id)}
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

        {/* Level segmented control */}
        <section className="mt-6 border-t pt-6">
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
          <h2 className="mb-1 text-sm font-semibold text-muted-foreground">3. Set the pressure</h2>
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
          onClick={() => topic && onContinue(topic, level, pressure)}
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
