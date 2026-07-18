'use client'

// The Path spotlight — the platform's spine. Every lab is a step; the Path is
// the order. The right-hand mockup is a live little roadmap: a vertical track of
// module nodes, one of them "current", each node made of the same four-step loop
// the real curriculum uses (see the header comment in lib/path/curriculum.ts):
//   see it → build it → explain it → say it.
import Link from 'next/link'
import { motion } from 'framer-motion'
import { ArrowRight, Route, Sparkles, Target, CalendarCheck, Trophy } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Reveal, useAmbientMotion } from './reveal'
import { cn } from '@/lib/utils'

const POINTS = [
  {
    icon: Target,
    title: 'Personalized to your goal',
    body: 'A short onboarding sets your goal and pace, then the AI plots your route and an honest ETA to job-ready.',
  },
  {
    icon: CalendarCheck,
    title: 'A daily quest, not a playlist',
    body: 'Each day the Path budgets a session you can actually finish, and a weekly report tells you what to fix next.',
  },
  {
    icon: Trophy,
    title: 'Mastery gates, not checkboxes',
    body: "You don't clear a node by clicking through it — you clear it by doing the thing and explaining it back.",
  },
]

// One node of the mockup track. `current` gets the glow + the animated ring.
const NODES = [
  { label: 'Variables & scope', state: 'done' as const },
  { label: 'The call stack', state: 'current' as const },
  { label: 'Closures', state: 'locked' as const },
]

const LOOP = ['see it', 'build it', 'explain it', 'say it']

function RoadmapMockup() {
  const animated = useAmbientMotion()
  return (
    <div className="relative rounded-2xl border border-border bg-card/80 p-5 shadow-xl backdrop-blur-sm sm:p-6">
      <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-muted-foreground">Module 2 · Execution model</p>

      <div className="relative mt-5 space-y-3">
        {/* Vertical connector down the node rail. */}
        <div className="absolute left-[15px] top-2 bottom-2 w-px bg-linear-to-b from-emerald-400 via-fuchsia-400 to-border" />

        {NODES.map((node) => {
          const done = node.state === 'done'
          const current = node.state === 'current'
          return (
            <div key={node.label} className="relative flex items-start gap-3">
              <span className="relative z-10 mt-0.5 flex size-8 shrink-0 items-center justify-center">
                {current && animated && (
                  <motion.span
                    className="absolute inset-0 rounded-full border-2 border-fuchsia-400/50"
                    animate={{ scale: [1, 1.5, 1], opacity: [0.5, 0, 0.5] }}
                    transition={{ duration: 2.2, repeat: Infinity, ease: 'easeInOut' }}
                  />
                )}
                <span
                  className={cn(
                    'flex size-8 items-center justify-center rounded-full border-2 text-[11px] font-bold shadow-sm',
                    done && 'border-emerald-400 bg-emerald-500/15 text-emerald-500',
                    current && 'border-fuchsia-400 bg-linear-to-br from-fuchsia-500 to-violet-600 text-white',
                    node.state === 'locked' && 'border-border bg-muted text-muted-foreground',
                  )}
                >
                  {done ? '✓' : current ? '2' : '🔒'}
                </span>
              </span>

              <div
                className={cn(
                  'min-w-0 flex-1 rounded-xl border p-3 transition-colors',
                  current ? 'border-fuchsia-300/60 bg-fuchsia-500/5 dark:border-fuchsia-500/30' : 'border-border/70',
                )}
              >
                <p className={cn('text-sm font-semibold', node.state === 'locked' && 'text-muted-foreground')}>
                  {node.label}
                </p>
                {current && (
                  <div className="mt-2 flex flex-wrap gap-1.5">
                    {LOOP.map((step, i) => (
                      <motion.span
                        key={step}
                        className={cn(
                          'rounded-md px-2 py-0.5 font-mono text-[10px]',
                          i === 1
                            ? 'bg-fuchsia-500/15 font-semibold text-fuchsia-600 dark:text-fuchsia-300'
                            : 'bg-muted text-muted-foreground',
                        )}
                        animate={animated && i === 1 ? { opacity: [0.55, 1, 0.55] } : undefined}
                        transition={{ duration: 2, repeat: Infinity, ease: 'easeInOut' }}
                      >
                        {step}
                      </motion.span>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )
        })}
      </div>

      {/* ETA chip, echoing the real Path's "ETA to job-ready". */}
      <div className="mt-5 flex items-center justify-between rounded-xl bg-muted/60 px-3 py-2">
        <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
          <Sparkles className="size-3.5 text-fuchsia-500" /> On track
        </span>
        <span className="font-mono text-xs font-semibold tabular-nums">~6 weeks to job-ready</span>
      </div>
    </div>
  )
}

export function PathSpotlight() {
  const animated = useAmbientMotion()

  return (
    <section
      id="path"
      className="relative overflow-hidden border-y border-fuchsia-200/40 bg-linear-to-b from-fuchsia-50/60 via-violet-50/30 to-transparent dark:border-fuchsia-900/25 dark:from-fuchsia-950/20 dark:via-violet-950/10"
    >
      <div className="mx-auto max-w-6xl px-4 py-16 sm:px-6 sm:py-24">
        <div className="grid items-center gap-10 lg:grid-cols-2 lg:gap-14">
          <Reveal>
            <span className="inline-flex items-center gap-2 font-mono text-[11px] font-semibold uppercase tracking-[0.2em] text-fuchsia-600 dark:text-fuchsia-400">
              <Badge className="bg-linear-to-br from-fuchsia-500 to-violet-600 px-2 py-0 text-[10px] text-white">
                The Path
              </Badge>
              Start here
            </span>
            <h2 className="mt-3 text-2xl font-bold tracking-tight sm:text-3xl">
              One guided path. Every lab, in the right order.
            </h2>
            <p className="mt-3 max-w-lg text-sm leading-relaxed text-muted-foreground sm:text-base">
              Eight labs is a lot of doors. The Path is your AI-personalized journey from your
              first <span className="font-mono text-foreground">console.log</span> to job-ready —
              it decides what you do next, pulls in the right lab for each skill, and only lets
              you advance once you can prove you&apos;ve got it.
            </p>

            <ul className="mt-7 space-y-5">
              {POINTS.map(({ icon: Icon, title, body }) => (
                <li key={title} className="flex gap-3.5">
                  <span className="mt-0.5 flex size-9 shrink-0 items-center justify-center rounded-lg bg-linear-to-br from-fuchsia-500 to-violet-600 text-white shadow-md">
                    <Icon className="size-4.5" />
                  </span>
                  <div>
                    <p className="font-semibold">{title}</p>
                    <p className="mt-0.5 text-sm leading-relaxed text-muted-foreground">{body}</p>
                  </div>
                </li>
              ))}
            </ul>

            <Button
              asChild
              size="lg"
              className="group mt-8 h-12 rounded-full bg-linear-to-r from-fuchsia-500 to-violet-600 text-base text-white shadow-lg shadow-fuchsia-500/25 hover:from-fuchsia-500 hover:to-violet-500"
            >
              <Link href="/path">
                <Route className="size-4" /> Start the Path
                <ArrowRight className="size-4 transition-transform group-hover:translate-x-0.5" />
              </Link>
            </Button>
          </Reveal>

          <Reveal>
            <motion.div
              whileHover={animated ? { y: -4 } : undefined}
              transition={{ type: 'spring', stiffness: 300, damping: 22 }}
              className="relative"
            >
              <div
                aria-hidden
                className="absolute -inset-6 -z-10 rounded-[2rem] bg-linear-to-br from-fuchsia-300/40 via-violet-300/25 to-transparent blur-2xl dark:from-fuchsia-500/15 dark:via-violet-500/10"
              />
              <RoadmapMockup />
            </motion.div>
          </Reveal>
        </div>
      </div>
    </section>
  )
}
