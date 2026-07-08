'use client'

import { useState } from 'react'
import { motion } from 'framer-motion'
import {
  Bug, HeartHandshake, Compass, MessageCircle, LifeBuoy, Clock, Loader2, type LucideIcon,
} from 'lucide-react'
import { SUPPORT_CATEGORIES, SUPPORT_LANGUAGES, supportCategoryById, SUPPORT_SECONDS } from '@/lib/support/prompt'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'

const ICONS: Record<string, LucideIcon> = {
  Bug, HeartHandshake, Compass, MessageCircle,
}

const MIN_LEN = 10

interface SetupScreenProps {
  onSubmit: (category: string, problem: string, language: string) => void
  greeting?: string
  submitting?: boolean
}

export function SetupScreen({ onSubmit, greeting, submitting }: SetupScreenProps) {
  const [category, setCategory] = useState<string | null>(null)
  const [problem, setProblem] = useState('')
  const [language, setLanguage] = useState('en')

  const cat = supportCategoryById(category ?? '')
  const canSubmit = !!category && problem.trim().length >= MIN_LEN && !submitting

  return (
    <div className="relative mx-auto w-full max-w-2xl px-4 py-8 sm:py-12">
      <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4 }} className="text-center">
        <div className="relative mx-auto mt-5 flex h-16 w-16 items-center justify-center">
          <div className="absolute inset-0 rounded-2xl bg-linear-to-br from-rose-500 via-pink-500 to-fuchsia-500 opacity-40 blur-xl" aria-hidden />
          <div className="relative flex h-14 w-14 items-center justify-center rounded-2xl bg-linear-to-br from-rose-500 via-pink-500 to-fuchsia-500 shadow-lg shadow-pink-500/20">
            <LifeBuoy className="h-7 w-7 text-white" />
          </div>
        </div>

        <h1 className="mt-4 text-2xl font-bold tracking-tight sm:text-3xl">
          {greeting ? <>How can we help, {greeting.split(' ')[0]}?</> : (
            <>
              Talk it through with{' '}
              <span className="bg-linear-to-br from-rose-500 via-pink-500 to-fuchsia-500 bg-clip-text text-transparent">someone</span>
            </>
          )}
        </h1>
        <p className="mx-auto mt-2 max-w-md text-sm leading-relaxed text-muted-foreground">
          A live voice chat with a supportive AI — about a bug, something on your mind, or where to go next.
          Sessions last up to <span className="font-semibold text-foreground">{Math.round(SUPPORT_SECONDS / 60)} minutes</span>.
        </p>
      </motion.div>

      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, delay: 0.1 }}
        className="mt-8 rounded-3xl border bg-card/60 p-4 shadow-xl shadow-black/[0.03] backdrop-blur-sm sm:p-6 dark:shadow-black/10"
      >
        <h2 className="mb-3 text-sm font-semibold text-muted-foreground">What do you want to talk about?</h2>
        <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2">
          {SUPPORT_CATEGORIES.map((c) => {
            const Icon = ICONS[c.icon] ?? MessageCircle
            const selected = category === c.id
            return (
              <button
                key={c.id}
                onClick={() => setCategory(c.id)}
                title={c.blurb}
                className={cn(
                  'group flex items-start gap-3 rounded-xl border-2 p-3.5 text-left transition-all duration-150',
                  selected
                    ? 'border-transparent text-white shadow-md bg-linear-to-br ' + c.gradient
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
                  <div className="text-sm font-semibold leading-tight">{c.label}</div>
                  <p className={cn('mt-0.5 text-[11px] leading-snug', selected ? 'text-white/90' : 'text-muted-foreground')}>
                    {c.blurb}
                  </p>
                </div>
              </button>
            )
          })}
        </div>

        <div className="mt-5">
          <label htmlFor="problem" className="mb-2 block text-sm font-semibold text-muted-foreground">
            Describe your problem
          </label>
          <textarea
            id="problem"
            value={problem}
            onChange={(e) => setProblem(e.target.value)}
            rows={4}
            maxLength={2000}
            placeholder={cat?.placeholder ?? 'Tell us what’s going on so we can help right away…'}
            className="w-full resize-none rounded-xl border-2 border-border bg-card p-3 text-sm outline-none transition-colors focus:border-foreground/40"
          />
          <p className="mt-1 text-right text-[11px] text-muted-foreground">
            {problem.trim().length < MIN_LEN ? `A little more detail (${MIN_LEN}+ characters)` : `${problem.length}/2000`}
          </p>
        </div>

        <div className="mt-4">
          <h2 className="mb-2 text-sm font-semibold text-muted-foreground">Language</h2>
          <div className="flex items-center gap-1.5">
            {SUPPORT_LANGUAGES.map((l) => (
              <button
                key={l.id}
                onClick={() => setLanguage(l.id)}
                className={cn(
                  'rounded-full font-bengali border px-3.5 py-1.5 text-sm font-semibold transition-colors',
                  language === l.id ? 'border-transparent bg-foreground text-background' : 'border-border bg-card hover:bg-accent',
                )}
              >
                {l.label}
              </button>
            ))}
          </div>
        </div>
      </motion.div>

      <div className="mt-8 flex flex-col items-center gap-2">
        <Button
          size="lg"
          className="h-12 w-full max-w-xs border-0 bg-linear-to-r from-rose-500 via-pink-500 to-fuchsia-500 text-base text-white shadow-lg shadow-pink-500/25 transition-all hover:shadow-xl hover:brightness-105"
          disabled={!canSubmit}
          onClick={() => category && onSubmit(category, problem, language)}
        >
          {submitting && <Loader2 className="h-4 w-4 animate-spin" />}
          {submitting ? 'Finding you a spot…' : 'Join a support session'}
        </Button>
        <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
          <Clock className="h-3.5 w-3.5" />
          Only 3 sessions run at once — you may wait briefly for a turn
        </p>
      </div>
    </div>
  )
}
