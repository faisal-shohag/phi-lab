'use client'

import { motion } from 'framer-motion'
import { Mic, Cpu, LineChart } from 'lucide-react'
import { Logo } from '@/components/brand/logo'

const FEATURES = [
  { icon: Mic, title: 'Live AI interviews', body: 'Speak through real technical rounds with an AI interviewer.' },
  { icon: Cpu, title: 'See code think', body: 'Step through JavaScript execution, memory, and the call stack.' },
  { icon: LineChart, title: 'Track your growth', body: 'Scored reports and a progress trend across every topic.' },
]

/**
 * Left-hand branded showcase for the auth split layout. Hidden on small screens.
 * Purely decorative — the form on the right does the work.
 */
export function BrandPanel() {
  return (
    <div className="relative hidden overflow-hidden bg-linear-to-br from-slate-950 via-slate-900 to-slate-950 lg:flex lg:flex-col lg:justify-between lg:p-12">
      {/* Ambient gradient orbs */}
      <div className="pointer-events-none absolute -left-24 -top-24 h-96 w-96 rounded-full bg-linear-to-br from-amber-500/30 via-fuchsia-500/20 to-transparent blur-3xl" />
      <div className="pointer-events-none absolute -bottom-32 -right-16 h-96 w-96 rounded-full bg-linear-to-br from-violet-600/30 via-fuchsia-500/20 to-transparent blur-3xl" />
      {/* Dotted grid */}
      <div
        className="pointer-events-none absolute inset-0 opacity-[0.15]"
        style={{
          backgroundImage: 'radial-gradient(circle at 1px 1px, white 1px, transparent 0)',
          backgroundSize: '32px 32px',
          maskImage: 'radial-gradient(ellipse 80% 80% at 50% 40%, black 40%, transparent 100%)',
        }}
      />

      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className="relative flex items-center gap-3"
      >
        <Logo className="h-11 w-11" />
        <div>
          <div className="text-base font-bold text-white">Phi Lab</div>
          <div className="text-xs text-white/60">Programming Hero Instructor Lab</div>
        </div>
      </motion.div>

      <div className="relative">
        <motion.h2
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.1 }}
          className="max-w-md text-3xl font-bold leading-tight text-white"
        >
          The first step from{' '}
          <span className="bg-linear-to-r from-amber-400 via-fuchsia-400 to-violet-400 bg-clip-text text-transparent">
            beginner to job-ready
          </span>
          .
        </motion.h2>

        <div className="mt-8 space-y-5">
          {FEATURES.map((f, i) => (
            <motion.div
              key={f.title}
              initial={{ opacity: 0, x: -12 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.4, delay: 0.2 + i * 0.1 }}
              className="flex items-start gap-3.5"
            >
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-white/10 bg-white/5 text-white backdrop-blur-sm">
                <f.icon className="h-4 w-4" />
              </div>
              <div>
                <div className="text-sm font-semibold text-white">{f.title}</div>
                <div className="text-sm text-white/60">{f.body}</div>
              </div>
            </motion.div>
          ))}
        </div>
      </div>

      <motion.p
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.5, delay: 0.5 }}
        className="relative text-xs text-white/40"
      >
        Free · No credit card · Runs in your browser
      </motion.p>
    </div>
  )
}
