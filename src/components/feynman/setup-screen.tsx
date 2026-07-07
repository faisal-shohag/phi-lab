'use client'

import { useState } from 'react'
import { motion } from 'framer-motion'
import {
  Box, RefreshCw, ArrowUpNarrowWide, Timer, Crosshair, Network, Repeat,
  TrendingUp, Link2, Braces, GraduationCap, Clock, type LucideIcon,
} from 'lucide-react'
import { CONCEPTS, ROUND_SECONDS } from '@/lib/feynman/concepts'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'

const ICONS: Record<string, LucideIcon> = {
  Box, RefreshCw, ArrowUpNarrowWide, Timer, Crosshair, Network, Repeat, TrendingUp, Link2, Braces,
}

interface SetupScreenProps {
  /** Advance to the green room to pick a voice/language and check the mic. */
  onContinue: (concept: string) => void
  greeting?: string
}

export function SetupScreen({ onContinue, greeting }: SetupScreenProps) {
  const [concept, setConcept] = useState<string | null>(null)
  const canContinue = !!concept

  return (
    <div className="relative mx-auto w-full max-w-3xl px-4 py-8 sm:py-12">
      <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4 }} className="text-center">
        <div className="relative mx-auto mt-5 flex h-16 w-16 items-center justify-center">
          <div className="absolute inset-0 rounded-2xl bg-linear-to-br from-indigo-500 via-sky-500 to-emerald-500 opacity-40 blur-xl" aria-hidden />
          <div className="relative flex h-14 w-14 items-center justify-center rounded-2xl bg-linear-to-br from-indigo-500 via-sky-500 to-emerald-500 shadow-lg shadow-sky-500/20">
            <GraduationCap className="h-7 w-7 text-white" />
          </div>
        </div>

        <h1 className="mt-4 text-2xl font-bold tracking-tight sm:text-3xl">
          {greeting ? <>Teach it, {greeting.split(' ')[0]}</> : (
            <>
              Learn by{' '}
              <span className="bg-linear-to-br from-indigo-500 via-sky-500 to-emerald-500 bg-clip-text text-transparent">Teaching</span>
            </>
          )}
        </h1>
        <p className="mx-auto mt-2 max-w-md text-sm leading-relaxed text-muted-foreground">
          Explain a concept out loud to a curious AI beginner. It asks the naive questions — you find the gaps in your own understanding. One{' '}
          <span className="font-semibold text-foreground">{Math.round(ROUND_SECONDS / 60)}-minute</span> round.
        </p>
      </motion.div>

      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, delay: 0.1 }}
        className="mt-8 rounded-3xl border bg-card/60 p-4 shadow-xl shadow-black/[0.03] backdrop-blur-sm sm:p-6 dark:shadow-black/10"
      >
        <h2 className="mb-3 text-sm font-semibold text-muted-foreground">Choose a concept to teach</h2>
        <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-3 lg:grid-cols-4">
          {CONCEPTS.map((c) => {
            const Icon = ICONS[c.icon] ?? Box
            const selected = concept === c.id
            return (
              <button
                key={c.id}
                onClick={() => setConcept(c.id)}
                title={c.blurb}
                className={cn(
                  'group flex flex-col items-start gap-2 rounded-xl border-2 p-3 text-left transition-all duration-150',
                  selected
                    ? 'border-transparent text-white shadow-md bg-linear-to-br ' + c.gradient
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
                <span className="text-sm font-semibold leading-tight">{c.label}</span>
                <span className={cn('text-[11px] leading-snug', selected ? 'text-white/90' : 'text-muted-foreground')}>
                  {c.blurb}
                </span>
              </button>
            )
          })}
        </div>
      </motion.div>

      <div className="mt-8 flex flex-col items-center gap-2">
        <Button
          size="lg"
          className="h-12 w-full max-w-xs border-0 bg-linear-to-r from-indigo-500 via-sky-500 to-emerald-500 text-base text-white shadow-lg shadow-sky-500/25 transition-all hover:shadow-xl hover:brightness-105"
          disabled={!canContinue}
          onClick={() => concept && onContinue(concept)}
        >
          Continue
        </Button>
        <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
          <Clock className="h-3.5 w-3.5" />
          Next: pick your student&apos;s voice, language & check your mic
        </p>
      </div>
    </div>
  )
}
