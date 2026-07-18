'use client'

import { motion } from 'framer-motion'
import { Zap, TrendingUp, Layers, Mic2, Share2, Moon, Brain } from 'lucide-react'
import { Reveal, RevealItem } from './reveal'
import { SectionHeading } from './section-heading'
import { cn } from '@/lib/utils'

const FEATURES = [
  { icon: Zap, title: 'Zero setup', body: 'Everything runs in your browser — no installs, no accounts.', accent: 'text-amber-500 bg-amber-500/10' },
  { icon: TrendingUp, title: 'Beginner → advanced', body: 'Easy, medium, and expert difficulty in every lab.', accent: 'text-emerald-500 bg-emerald-500/10' },
  { icon: Layers, title: 'Real internals', body: 'See the call stack, heap, and event loop — not a diagram of them.', accent: 'text-rose-500 bg-rose-500/10' },
  { icon: Mic2, title: 'Voice-first practice', body: 'Speak your answers out loud, the way a real interview works.', accent: 'text-violet-500 bg-violet-500/10' },
  { icon: Share2, title: 'Shareable everything', body: 'Send a link to any visualizer run and pick up right where it left off.', accent: 'text-fuchsia-500 bg-fuchsia-500/10' },
  { icon: Moon, title: 'Dark mode & keyboard friendly', body: 'Built for long study sessions, not just a demo.', accent: 'text-slate-500 bg-slate-500/10' },
  { icon: Brain, title: 'Second Brain', body: 'Save articles, videos, and notes — then chat with your knowledge using AI.', accent: 'text-indigo-500 bg-indigo-500/10' },
]

export function Features() {
  return (
    <section id="features" className="mx-auto max-w-6xl px-4 py-16 sm:px-6 sm:py-24">
      <SectionHeading
        eyebrow="Why Phi Lab"
        title="Built like a lab, not a lecture."
        subtitle="Our goal is simple: turn passive reading into active practice, and carry you from complete beginner to job-ready. Everything is voice-first where it matters, runs in the browser, and scales from easy to expert."
      />

      <Reveal stagger className="mt-12 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {FEATURES.map((f) => (
          <RevealItem key={f.title}>
            <motion.div
              whileHover={{ y: -3 }}
              transition={{ type: 'spring', stiffness: 300, damping: 22 }}
              className="h-full rounded-2xl border border-border bg-card p-5 shadow-sm transition-colors hover:border-foreground/20"
            >
              <div className={cn('flex h-9 w-9 items-center justify-center rounded-lg', f.accent)}>
                <f.icon className="h-4.5 w-4.5" />
              </div>
              <h3 className="mt-3 font-semibold">{f.title}</h3>
              <p className="mt-1 text-sm leading-relaxed text-muted-foreground">{f.body}</p>
            </motion.div>
          </RevealItem>
        ))}
      </Reveal>
    </section>
  )
}
