'use client'

import Link from 'next/link'
import { motion } from 'framer-motion'
import { Cpu, Mic, GraduationCap, Grid2x2Check, Languages, LifeBuoy, Code2, Brain, ArrowRight } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Reveal, RevealItem } from './reveal'
import { useAmbientMotion } from './reveal'
import { SectionHeading } from './section-heading'
import { cn } from '@/lib/utils'

// Per-accent styling: the icon-tile gradient, the hover ring, and the ambient
// glow that fades in behind the card on hover. One source of truth so the card
// body stays free of nested ternaries.
type Accent = 'amber' | 'violet' | 'indigo' | 'cyan' | 'rose' | 'pink' | 'emerald'

const ACCENTS: Record<Accent, { tile: string; ring: string; glow: string }> = {
  amber: {
    tile: 'from-amber-500 to-orange-600',
    ring: 'group-hover:border-amber-400/70',
    glow: 'from-amber-400/25 to-orange-500/10',
  },
  violet: {
    tile: 'from-violet-500 to-fuchsia-600',
    ring: 'group-hover:border-violet-400/70',
    glow: 'from-violet-400/25 to-fuchsia-500/10',
  },
  indigo: {
    tile: 'from-indigo-500 to-emerald-500',
    ring: 'group-hover:border-indigo-400/70',
    glow: 'from-indigo-400/25 to-emerald-500/10',
  },
  cyan: {
    tile: 'from-sky-500 to-teal-500',
    ring: 'group-hover:border-sky-400/70',
    glow: 'from-sky-400/25 to-teal-500/10',
  },
  rose: {
    tile: 'from-rose-500 to-pink-600',
    ring: 'group-hover:border-rose-400/70',
    glow: 'from-rose-400/25 to-pink-500/10',
  },
  pink: {
    // The lab's own logo gradient, so the card and the header agree.
    tile: 'from-pink-500 via-fuchsia-500 to-violet-600',
    ring: 'group-hover:border-pink-400/70',
    glow: 'from-pink-400/25 to-violet-500/10',
  },
  emerald: {
    tile: 'from-emerald-500 to-teal-600',
    ring: 'group-hover:border-emerald-400/70',
    glow: 'from-emerald-400/25 to-teal-500/10',
  },
}

const JS_MOTION_CHIPS = ['Memory & call stack', 'Heap graph', 'Timeline & breakpoints', 'Quiz mode', 'Shareable links']
const INTERVIEW_CHIPS = ['10 topics · HTML → MongoDB', 'Live transcript', 'Gemini-powered', 'Score ring + sub-scores']
const FEYNMAN_CHIPS = ['Teach it out loud', 'AI asks the naive questions', 'Clarity score', 'Mirror test']
const ENGLISH_CHIPS = ['5 work scenarios', 'Voice roleplay', 'Say-it-better fixes', 'Fluency score']
const SUPPORT_CHIPS = ['Live voice help', 'Coding · mental · guidance', 'Share your screen', '10-minute sessions']
const PIXEL_CHIPS = ['27 challenges · navbars → whole pages', 'Scored in a real browser', 'Diff & slide compare', 'Unlock the run']
const CODE_CHIPS = ['JS & TS problems', 'Server-graded in QuickJS', 'Timed contests + leaderboard', 'XP & badges']
const QUIZ_CHIPS = ['9 topics · HTML → MongoDB', 'Gemini-powered', '3 difficulty levels', 'XP rewards']

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

function FeynmanMockup() {
  const animated = useAmbientMotion()
  return (
    <div className="mt-5 flex items-center gap-4 rounded-lg border border-border bg-muted/40 p-3">
      <div className="relative flex h-16 w-16 shrink-0 items-center justify-center">
        <div className="absolute h-12 w-12 rounded-full bg-linear-to-br from-indigo-500 to-emerald-500 shadow-lg" />
        {animated && (
          <motion.div
            className="absolute h-14 w-14 rounded-full border-2 border-indigo-400/40"
            animate={{ scale: [1, 1.3, 1], opacity: [0.3, 0, 0.3] }}
            transition={{ duration: 2.4, repeat: Infinity, ease: 'easeInOut' }}
          />
        )}
      </div>
      <div className="flex-1 space-y-1.5">
        <div className="ml-auto max-w-[85%] rounded-xl rounded-br-sm bg-sky-100 px-2.5 py-1.5 text-[11px] text-sky-950 dark:bg-sky-950/50 dark:text-sky-100">
          A closure remembers its outer variables…
        </div>
        <div className="max-w-[85%] rounded-xl rounded-bl-sm bg-violet-100 px-2.5 py-1.5 text-[11px] text-violet-950 dark:bg-violet-950/50 dark:text-violet-100">
          Wait — remembers them how? Can you show me?
        </div>
      </div>
    </div>
  )
}

function EnglishMockup() {
  const animated = useAmbientMotion()
  return (
    <div className="mt-5 flex items-center gap-4 rounded-lg border border-border bg-muted/40 p-3">
      <div className="relative flex h-16 w-16 shrink-0 items-center justify-center">
        <div className="absolute h-12 w-12 rounded-full bg-linear-to-br from-sky-500 to-teal-500 shadow-lg" />
        {animated && (
          <motion.div
            className="absolute h-14 w-14 rounded-full border-2 border-sky-400/40"
            animate={{ scale: [1, 1.3, 1], opacity: [0.3, 0, 0.3] }}
            transition={{ duration: 2.4, repeat: Infinity, ease: 'easeInOut' }}
          />
        )}
      </div>
      <div className="flex-1 space-y-1.5">
        <div className="ml-auto max-w-[90%] rounded-xl rounded-br-sm bg-cyan-100 px-2.5 py-1.5 text-[11px] text-cyan-950 line-through decoration-rose-400/60 dark:bg-cyan-950/50 dark:text-cyan-100">
          I am agree with this approach.
        </div>
        <div className="ml-auto max-w-[90%] rounded-xl rounded-br-sm bg-emerald-100 px-2.5 py-1.5 text-[11px] font-medium text-emerald-950 dark:bg-emerald-950/50 dark:text-emerald-100">
          I agree with this approach.
        </div>
      </div>
    </div>
  )
}

function SupportMockup() {
  const animated = useAmbientMotion()
  return (
    <div className="mt-5 flex items-center gap-4 rounded-lg border border-border bg-muted/40 p-3">
      <div className="relative flex h-16 w-16 shrink-0 items-center justify-center">
        <div className="absolute h-12 w-12 rounded-full bg-linear-to-br from-rose-500 to-pink-600 shadow-lg" />
        {animated && (
          <motion.div
            className="absolute h-14 w-14 rounded-full border-2 border-rose-400/40"
            animate={{ scale: [1, 1.3, 1], opacity: [0.3, 0, 0.3] }}
            transition={{ duration: 2.4, repeat: Infinity, ease: 'easeInOut' }}
          />
        )}
      </div>
      <div className="flex-1 space-y-1.5">
        <div className="max-w-[85%] rounded-xl rounded-bl-sm bg-rose-100 px-2.5 py-1.5 text-[11px] text-rose-950 dark:bg-rose-950/50 dark:text-rose-100">
          I&apos;m stuck and a bit burnt out…
        </div>
        <div className="ml-auto max-w-[85%] rounded-xl rounded-br-sm bg-violet-100 px-2.5 py-1.5 text-[11px] text-violet-950 dark:bg-violet-950/50 dark:text-violet-100">
          Let&apos;s slow down. Want to share your screen?
        </div>
      </div>
    </div>
  )
}

/**
 * A navbar being matched: the target above, your build below, closing on it.
 *
 * The other mockups show the lab's *surface* — code, a transcript, a score ring.
 * This one shows the loop, because the loop is the whole idea: there is a thing,
 * you rebuild the thing, a number says how close. The bar sliding to 100% is the
 * only honest way to say that in a card.
 */
function PixelMockup() {
  const animated = useAmbientMotion()
  return (
    <div className="mt-5 space-y-2 rounded-lg border border-border bg-slate-950 p-3 shadow-inner">
      <p className="font-mono text-[9px] uppercase tracking-widest text-slate-500">target</p>
      <div className="flex items-center gap-2 rounded bg-white px-2 py-1.5">
        <span className="text-[9px] font-bold text-slate-900">phi</span>
        <span className="ml-auto flex gap-1.5">
          {['Labs', 'Hive'].map((t) => (
            <span key={t} className="text-[8px] text-slate-500">
              {t}
            </span>
          ))}
        </span>
      </div>

      <p className="font-mono text-[9px] uppercase tracking-widest text-slate-500">yours</p>
      <div className="relative flex items-center gap-2 overflow-hidden rounded bg-white px-2 py-1.5">
        <span className="text-[9px] font-bold text-slate-900">phi</span>
        <span className="ml-auto flex gap-1.5">
          {['Labs', 'Hive'].map((t) => (
            <span key={t} className="text-[8px] text-slate-500">
              {t}
            </span>
          ))}
        </span>
        {animated && (
          // The wipe: your build resolving onto the target, over and over.
          <motion.div
            className="absolute inset-y-0 right-0 bg-pink-500/20"
            animate={{ width: ['70%', '0%', '70%'] }}
            transition={{ duration: 4, repeat: Infinity, ease: 'easeInOut' }}
          />
        )}
      </div>

      <div className="flex items-center gap-2 pt-1">
        <div className="h-1 flex-1 overflow-hidden rounded-full bg-slate-800">
          <motion.div
            className="h-full rounded-full bg-linear-to-r from-pink-500 to-emerald-400"
            animate={animated ? { width: ['30%', '100%', '30%'] } : { width: '100%' }}
            transition={{ duration: 4, repeat: Infinity, ease: 'easeInOut' }}
          />
        </div>
        <span className="font-mono text-[9px] font-bold text-emerald-400 tabular-nums">100%</span>
      </div>
    </div>
  )
}

const SOLUTION_LINES = ['function twoSum(nums, t) {', '  const seen = new Map()', '  // …', '}']

/**
 * The Code Lab card shows the loop that defines it: you write a solution, the
 * server runs every hidden case, a verdict comes back. The test bar filling to
 * "Accepted · 12/12" is that verdict landing.
 */
function CodeMockup() {
  const animated = useAmbientMotion()
  return (
    <div className="mt-5 space-y-2 rounded-lg border border-border bg-slate-950 p-3 shadow-inner">
      <div className="font-mono text-[11px] leading-6 text-slate-300">
        {SOLUTION_LINES.map((line, i) => (
          <div key={i} className="pl-1">
            <span className="text-slate-600">{i + 1}</span> <span className="ml-2">{line}</span>
          </div>
        ))}
      </div>
      <div className="flex items-center gap-2 pt-1">
        <div className="h-1 flex-1 overflow-hidden rounded-full bg-slate-800">
          <motion.div
            className="h-full rounded-full bg-linear-to-r from-emerald-500 to-teal-400"
            animate={animated ? { width: ['15%', '100%', '15%'] } : { width: '100%' }}
            transition={{ duration: 4, repeat: Infinity, ease: 'easeInOut' }}
          />
        </div>
        <span className="font-mono text-[9px] font-bold text-emerald-400 tabular-nums">Accepted · 12/12</span>
      </div>
    </div>
  )
}

function QuizMockup() {
  const animated = useAmbientMotion()
  const options = ['A. var', 'B. let', 'C. const', 'D. function']
  return (
    <div className="mt-5 space-y-2 rounded-lg border border-border bg-muted/40 p-3">
      <p className="text-[11px] font-medium text-muted-foreground">Which keyword creates a block-scoped variable?</p>
      <div className="grid grid-cols-2 gap-1.5">
        {options.map((opt, i) => (
          <div
            key={opt}
            className={`rounded-md border px-2 py-1.5 text-[10px] font-medium ${
              i === 1
                ? 'border-emerald-400 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400'
                : 'border-border text-muted-foreground'
            }`}
          >
            {opt}
          </div>
        ))}
      </div>
      {animated && (
        <motion.div
          className="flex items-center gap-1.5 pt-1"
          animate={{ opacity: [0.4, 1, 0.4] }}
          transition={{ duration: 2, repeat: Infinity, ease: 'easeInOut' }}
        >
          <span className="text-[10px] font-bold text-emerald-500">✓ Correct</span>
          <span className="text-[10px] text-muted-foreground">— 5 XP earned</span>
        </motion.div>
      )}
    </div>
  )
}

interface LabCardProps {
  accent: Accent
  icon: React.ReactNode
  title: string
  description: string
  chips: string[]
  href: string
  mockup: React.ReactNode
}

function LabCard({ accent, icon, title, description, chips, href, mockup }: LabCardProps) {
  const a = ACCENTS[accent]
  return (
    <RevealItem>
      <motion.div
        whileHover={{ y: -4 }}
        transition={{ type: 'spring', stiffness: 300, damping: 22 }}
        className={cn(
          'group relative flex h-full flex-col rounded-2xl border border-border bg-card p-5 shadow-sm transition-colors duration-300 sm:p-6',
          a.ring,
        )}
      >
        {/* Ambient accent glow, revealed on hover. */}
        <div
          aria-hidden
          className={cn(
            'pointer-events-none absolute -inset-px -z-10 rounded-2xl bg-linear-to-br opacity-0 blur-xl transition-opacity duration-300 group-hover:opacity-100',
            a.glow,
          )}
        />
        {/* Subtle top-light so the card reads as a raised surface. */}
        <div
          aria-hidden
          className="pointer-events-none absolute inset-x-0 top-0 -z-10 h-px rounded-t-2xl bg-linear-to-r from-transparent via-foreground/10 to-transparent"
        />

        <div
          className={cn(
            'flex h-11 w-11 items-center justify-center rounded-xl text-white shadow-md bg-linear-to-br',
            a.tile,
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

        <Button asChild variant="outline" className="mt-5 w-full justify-between rounded-lg">
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
      <SectionHeading
        eyebrow="The Labs"
        title="Eight labs. One goal: make it click."
        subtitle="Every concept here is something you run, watch, or say — not just something you read."
      />

      <Reveal stagger className="mt-12 grid grid-cols-1 gap-5 lg:grid-cols-3">
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
          accent="pink"
          icon={<Grid2x2Check className="h-5 w-5" />}
          title="Pixel Lab"
          description="Rebuild a UI from a picture in HTML and CSS. Your code renders in a real browser on our side and gets diffed against the target, pixel by pixel."
          chips={PIXEL_CHIPS}
          href="/labs/pixel-lab"
          mockup={<PixelMockup />}
        />

        <LabCard
          accent="emerald"
          icon={<Code2 className="h-5 w-5" />}
          title="Code Lab"
          description="Solve JavaScript and TypeScript problems in a real editor. Your code is graded on the server against hidden cases — then enter timed contests and climb the leaderboard."
          chips={CODE_CHIPS}
          href="/labs/code-lab"
          mockup={<CodeMockup />}
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

        <LabCard
          accent="rose"
          icon={<LifeBuoy className="h-5 w-5" />}
          title="Support Session"
          description="A live voice call with a supportive AI — about a bug, something on your mind, or where to go next. Share your screen so it can see the error, and rate the help afterwards."
          chips={SUPPORT_CHIPS}
          href="/labs/support"
          mockup={<SupportMockup />}
        />

        <LabCard
          accent="indigo"
          icon={<GraduationCap className="h-5 w-5" />}
          title="Feynman Lab"
          description="Learn by teaching. Explain a concept out loud to a curious AI beginner that asks the naive questions — then get a clarity score on your explanation."
          chips={FEYNMAN_CHIPS}
          href="/labs/feynman"
          mockup={<FeynmanMockup />}
        />
        <LabCard
          accent="cyan"
          icon={<Languages className="h-5 w-5" />}
          title="English Lab"
          description="Spoken technical English for developers. Roleplay a standup, code review or salary talk with an AI partner, then get a fluency score and say-it-better fixes."
          chips={ENGLISH_CHIPS}
          href="/labs/english"
          mockup={<EnglishMockup />}
        />
        <LabCard
          accent="emerald"
          icon={<Brain className="h-5 w-5" />}
          title="Quiz Lab"
          description="Test your knowledge with AI-generated quizzes. Pick topics from HTML to MongoDB, choose your difficulty, and earn XP for every correct answer."
          chips={QUIZ_CHIPS}
          href="/labs/quiz"
          mockup={<QuizMockup />}
        />
      </Reveal>
    </section>
  )
}
