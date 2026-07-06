'use client'

import Link from 'next/link'
import { motion } from 'framer-motion'
import { Cpu, Mic, ArrowRight } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Reveal, RevealItem } from './reveal'
import { useAmbientMotion } from './reveal'
import { cn } from '@/lib/utils'

const JS_MOTION_CHIPS = ['Memory & call stack', 'Heap graph', 'Timeline & breakpoints', 'Quiz mode', 'Shareable links']
const INTERVIEW_CHIPS = ['10 topics · HTML → MongoDB', 'Live transcript', 'Gemini-powered', 'Score ring + sub-scores']

const CODE_LINES = ['function push(stack, v) {', '  stack.push(v)', '  return stack', '}']

function JsMotionMockup() {
  const animated = useAmbientMotion()
  return (
    <div className="mt-5 flex items-stretch gap-3 rounded-lg border border-border bg-slate-950 p-3 shadow-inner">
      <div className="relative flex-1 font-mono text-[11px] leading-6 text-slate-300">
        {animated && (
          <motion.div
            className="absolute inset-x-0 h-6 rounded bg-amber-500/20"
            animate={{ top: ['0%', '25%', '50%', '75%', '0%'] }}
            transition={{ duration: 5, repeat: Infinity, ease: 'easeInOut', times: [0, 0.25, 0.5, 0.75, 1] }}
          />
        )}
        {CODE_LINES.map((line, i) => (
          <div key={i} className="relative pl-1">
            <span className="text-slate-600">{i + 1}</span> <span className="ml-2">{line}</span>
          </div>
        ))}
      </div>
      <div className="flex w-24 shrink-0 flex-col justify-end gap-1.5">
        {['push()', 'main()'].map((frame, i) => (
          <motion.div
            key={frame}
            className="rounded-md border border-amber-500/40 bg-amber-500/10 px-2 py-1 text-center font-mono text-[10px] text-amber-300"
            animate={animated ? { opacity: [0.4, 1, 0.4] } : undefined}
            transition={{ duration: 3, repeat: Infinity, ease: 'easeInOut', delay: i * 0.8 }}
          >
            {frame}
          </motion.div>
        ))}
      </div>
    </div>
  )
}

function InterviewMockup() {
  const animated = useAmbientMotion()
  const r = 26
  const c = 2 * Math.PI * r

  return (
    <div className="mt-5 flex items-center gap-4 rounded-lg border border-border bg-muted/40 p-3">
      <div className="relative flex h-16 w-16 shrink-0 items-center justify-center">
        <div className="absolute h-12 w-12 rounded-full bg-linear-to-br from-violet-500 to-emerald-500 shadow-lg" />
        {animated && (
          <motion.div
            className="absolute h-14 w-14 rounded-full border-2 border-violet-400/40"
            animate={{ scale: [1, 1.3, 1], opacity: [0.3, 0, 0.3] }}
            transition={{ duration: 2.4, repeat: Infinity, ease: 'easeInOut' }}
          />
        )}
      </div>

      <div className="flex-1 space-y-1.5">
        <div className="max-w-[85%] rounded-xl rounded-bl-sm bg-violet-100 px-2.5 py-1.5 text-[11px] text-violet-950 dark:bg-violet-950/50 dark:text-violet-100">
          Explain the event loop.
        </div>
        <div className="ml-auto max-w-[85%] rounded-xl rounded-br-sm bg-emerald-100 px-2.5 py-1.5 text-[11px] text-emerald-950 dark:bg-emerald-950/50 dark:text-emerald-100">
          It&apos;s a single-threaded queue that...
        </div>
      </div>

      <svg width={64} height={64} className="-rotate-90 shrink-0">
        <circle cx={32} cy={32} r={r} fill="none" strokeWidth={5} className="stroke-muted" />
        <motion.circle
          cx={32} cy={32} r={r} fill="none" strokeWidth={5} strokeLinecap="round"
          className="stroke-emerald-500"
          strokeDasharray={c}
          initial={{ strokeDashoffset: c }}
          whileInView={{ strokeDashoffset: c * 0.14 }}
          viewport={{ once: true }}
          transition={{ duration: 1, ease: 'easeOut', delay: 0.3 }}
        />
      </svg>
    </div>
  )
}

interface LabCardProps {
  accent: 'amber' | 'violet'
  icon: React.ReactNode
  title: string
  description: string
  chips: string[]
  href: string
  mockup: React.ReactNode
}

function LabCard({ accent, icon, title, description, chips, href, mockup }: LabCardProps) {
  return (
    <RevealItem>
      <motion.div
        whileHover={{ y: -4 }}
        transition={{ type: 'spring', stiffness: 300, damping: 22 }}
        className={cn(
          'group flex h-full flex-col rounded-xl border-2 bg-card p-5 shadow-sm transition-colors sm:p-6',
          accent === 'amber' ? 'border-border hover:border-amber-400' : 'border-border hover:border-violet-400',
        )}
      >
        <div
          className={cn(
            'flex h-10 w-10 items-center justify-center rounded-lg text-white shadow-md',
            accent === 'amber' ? 'bg-linear-to-br from-amber-500 to-orange-600' : 'bg-linear-to-br from-violet-500 to-fuchsia-600',
          )}
        >
          {icon}
        </div>
        <h3 className="mt-4 text-lg font-bold">{title}</h3>
        <p className="mt-1.5 text-sm leading-relaxed text-muted-foreground">{description}</p>

        <div className="mt-4 flex flex-wrap gap-1.5">
          {chips.map((chip) => (
            <Badge key={chip} variant="secondary" className="font-normal">
              {chip}
            </Badge>
          ))}
        </div>

        {mockup}

        <Button asChild variant="outline" className="mt-5 w-full justify-between">
          <Link href={href}>
            Open {title}
            <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
          </Link>
        </Button>
      </motion.div>
    </RevealItem>
  )
}

export function LabsShowcase() {
  return (
    <section id="labs" className="mx-auto max-w-6xl px-4 py-16 sm:px-6 sm:py-24">
      <Reveal className="text-center">
        <h2 className="text-2xl font-bold sm:text-3xl">Two labs. One goal: make it click.</h2>
        <p className="mx-auto mt-2 max-w-xl text-sm text-muted-foreground sm:text-base">
          Every concept here is something you run, watch, or say — not just something you read.
        </p>
      </Reveal>

      <Reveal stagger className="mt-10 grid grid-cols-1 gap-5 lg:grid-cols-2">
        <LabCard
          accent="amber"
          icon={<Cpu className="h-5 w-5" />}
          title="Js Motion Lab"
          description="A step-by-step JavaScript visualizer. Press run and watch every variable, stack frame, and heap object move."
          chips={JS_MOTION_CHIPS}
          href="/labs/js-motion"
          mockup={<JsMotionMockup />}
        />
        <LabCard
          accent="violet"
          icon={<Mic className="h-5 w-5" />}
          title="Interview Lab"
          description="A live AI voice interview. Pick a topic and difficulty, speak for two minutes, get a scored report with per-question feedback."
          chips={INTERVIEW_CHIPS}
          href="/labs/interview"
          mockup={<InterviewMockup />}
        />
      </Reveal>
    </section>
  )
}
