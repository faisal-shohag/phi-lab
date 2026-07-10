'use client'

import { useState } from 'react'
import { motion } from 'framer-motion'
import {
  Code2, Users, HandCoins, MessagesSquare, Coffee, Languages, Clock, type LucideIcon,
} from 'lucide-react'
import { SCENARIOS, ROUND_SECONDS } from '@/lib/english/scenarios'
import { useRoundLength } from '@/lib/labs/use-round-length'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'

const ICONS: Record<string, LucideIcon> = {
  Code2, Users, HandCoins, MessagesSquare, Coffee,
}

interface SetupScreenProps {
  onContinue: (scenario: string) => void
  greeting?: string
}

export function SetupScreen({ onContinue, greeting }: SetupScreenProps) {
  const [scenario, setScenario] = useState<string | null>(null)
  const roundSeconds = useRoundLength('english', ROUND_SECONDS)
  const canContinue = !!scenario

  return (
    <div className="relative mx-auto w-full max-w-3xl px-4 py-8 sm:py-12">
      <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4 }} className="text-center">
        <div className="relative mx-auto mt-5 flex h-16 w-16 items-center justify-center">
          <div className="absolute inset-0 rounded-2xl bg-linear-to-br from-sky-500 via-cyan-500 to-teal-500 opacity-40 blur-xl" aria-hidden />
          <div className="relative flex h-14 w-14 items-center justify-center rounded-2xl bg-linear-to-br from-sky-500 via-cyan-500 to-teal-500 shadow-lg shadow-cyan-500/20">
            <Languages className="h-7 w-7 text-white" />
          </div>
        </div>

        <h1 className="mt-4 text-2xl font-bold tracking-tight sm:text-3xl">
          {greeting ? <>Let&apos;s practise, {greeting.split(' ')[0]}</> : (
            <>
              English for{' '}
              <span className="bg-linear-to-br from-sky-500 via-cyan-500 to-teal-500 bg-clip-text text-transparent">Developers</span>
            </>
          )}
        </h1>
        <p className="mx-auto mt-2 max-w-md text-sm leading-relaxed text-muted-foreground">
          Practise speaking technical English with an AI partner. Pick a real work situation and talk it through for one{' '}
          <span className="font-semibold text-foreground">{Math.round(roundSeconds / 60)}-minute</span> round.
        </p>
      </motion.div>

      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, delay: 0.1 }}
        className="mt-8 rounded-3xl border bg-card/60 p-4 shadow-xl shadow-black/[0.03] backdrop-blur-sm sm:p-6 dark:shadow-black/10"
      >
        <h2 className="mb-3 text-sm font-semibold text-muted-foreground">Choose a situation to practise</h2>
        <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2">
          {SCENARIOS.map((s) => {
            const Icon = ICONS[s.icon] ?? Code2
            const selected = scenario === s.id
            return (
              <button
                key={s.id}
                onClick={() => setScenario(s.id)}
                title={s.blurb}
                className={cn(
                  'group flex items-start gap-3 rounded-xl border-2 p-3.5 text-left transition-all duration-150',
                  selected
                    ? 'border-transparent text-white shadow-md bg-linear-to-br ' + s.gradient
                    : 'border-border bg-card hover:-translate-y-0.5 hover:border-foreground/30 hover:bg-accent hover:shadow-md',
                )}
              >
                <div
                  className={cn(
                    'flex h-9 w-9 shrink-0 items-center justify-center rounded-lg transition-colors',
                    selected ? 'bg-white/20 text-white' : 'bg-muted text-muted-foreground group-hover:text-foreground',
                  )}
                >
                  <Icon className="h-4 w-4" />
                </div>
                <div className="min-w-0">
                  <div className="text-sm font-semibold leading-tight">{s.label}</div>
                  <p className={cn('mt-0.5 text-[11px] leading-snug', selected ? 'text-white/90' : 'text-muted-foreground')}>
                    {s.blurb}
                  </p>
                </div>
              </button>
            )
          })}
        </div>
      </motion.div>

      <div className="mt-8 flex flex-col items-center gap-2">
        <Button
          size="lg"
          className="h-12 w-full max-w-xs border-0 bg-linear-to-r from-sky-500 via-cyan-500 to-teal-500 text-base text-white shadow-lg shadow-cyan-500/25 transition-all hover:shadow-xl hover:brightness-105"
          disabled={!canContinue}
          onClick={() => scenario && onContinue(scenario)}
        >
          Continue
        </Button>
        <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
          <Clock className="h-3.5 w-3.5" />
          Next: pick your partner&apos;s voice & check your mic
        </p>
      </div>
    </div>
  )
}
