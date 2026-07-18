'use client'

import Link from 'next/link'
import { motion } from 'framer-motion'
import { Eye, HelpCircle, Mic, LineChart } from 'lucide-react'
import { Reveal, RevealItem } from './reveal'
import { SectionHeading } from './section-heading'
import { cn } from '@/lib/utils'

const STEPS = [
  {
    icon: Eye,
    title: 'Learn by seeing',
    body: 'Run real JavaScript in Js Motion Lab and watch memory move instead of guessing what happens.',
    href: '/labs/js-motion',
    accent: 'text-amber-500 bg-amber-500/10',
  },
  {
    icon: HelpCircle,
    title: 'Test your intuition',
    body: 'Quiz mode pauses mid-execution and asks "what happens next?" — before you see the answer.',
    href: '/labs/js-motion',
    accent: 'text-rose-500 bg-rose-500/10',
  },
  {
    icon: Mic,
    title: 'Practice speaking',
    body: 'Interview Lab drills you out loud on the topics companies actually ask about.',
    href: '/labs/interview',
    accent: 'text-violet-500 bg-violet-500/10',
  },
  {
    icon: LineChart,
    title: 'Measure & improve',
    body: 'Scored reports break down communication, depth, and accuracy — so you know exactly what to fix.',
    href: '/labs/interview',
    accent: 'text-emerald-500 bg-emerald-500/10',
  },
]

export function Journey() {
  return (
    <section id="journey" className="mx-auto max-w-6xl px-4 py-16 sm:px-6 sm:py-24">
      <SectionHeading
        eyebrow="How it works"
        title="From first console.log to job-ready"
        subtitle="A guided path for beginner-to-advanced learners — one loop of see, test, speak, and measure."
      />

      <Reveal stagger className="relative mt-16">
        {/* Connector line */}
        <motion.div
          className="absolute top-5 left-5 hidden h-0.5 w-[calc(100%-2.5rem)] origin-left bg-linear-to-r from-amber-400 via-violet-400 to-emerald-400 lg:block"
          initial={{ scaleX: 0 }}
          whileInView={{ scaleX: 1 }}
          viewport={{ once: true }}
          transition={{ duration: 0.8, ease: 'easeOut' }}
        />
        <motion.div
          className="absolute top-5 left-5 hidden h-8 w-0.5 origin-top bg-border lg:hidden"
          initial={{ scaleY: 0 }}
          whileInView={{ scaleY: 1 }}
          viewport={{ once: true }}
          transition={{ duration: 0.8, ease: 'easeOut' }}
        />

        <div className="grid grid-cols-1 gap-8 lg:grid-cols-4 lg:gap-6">
          {STEPS.map((step, i) => (
            <RevealItem key={step.title} className="relative">
              <Link href={step.href} className="group block">
                <motion.div
                  className={cn(
                    'flex h-10 w-10 items-center justify-center rounded-full border-2 border-background text-sm font-bold shadow-md',
                    step.accent,
                  )}
                  initial={{ scale: 0 }}
                  whileInView={{ scale: 1 }}
                  viewport={{ once: true }}
                  transition={{ type: 'spring', stiffness: 260, damping: 18, delay: i * 0.1 }}
                >
                  {i + 1}
                </motion.div>
                <div className={cn('mb-2 mt-3 inline-flex h-8 w-8 items-center justify-center rounded-lg', step.accent)}>
                  <step.icon className="h-4 w-4" />
                </div>
                <h3 className="font-semibold group-hover:underline">{step.title}</h3>
                <p className="mt-1 text-sm leading-relaxed text-muted-foreground">{step.body}</p>
              </Link>
            </RevealItem>
          ))}
        </div>
      </Reveal>
    </section>
  )
}
