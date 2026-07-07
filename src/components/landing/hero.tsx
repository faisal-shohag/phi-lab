'use client'

import Link from 'next/link'
import { motion } from 'framer-motion'
import { ArrowRight, Mic, Cpu, Sparkles } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { PhiOrb } from './phi-orb'
import { useAmbientMotion } from './reveal'
import { cn } from '@/lib/utils'

const ENTRANCE = {
  hidden: { opacity: 0, y: 12 },
  show: { opacity: 1, y: 0, transition: { duration: 0.5, ease: 'easeOut' as const } },
}

const TOKENS = [
  { text: 'const', top: '12%', left: '8%', duration: 7 },
  { text: 'await', top: '70%', left: '4%', duration: 8 },
  { text: 'stack.push()', top: '20%', left: '82%', duration: 9 },
  { text: 'score: 87', top: '65%', left: '85%', duration: 6.5 },
  { text: '=> {}', top: '45%', left: '90%', duration: 7.5 },
  { text: 'if (true)', top: '85%', left: '20%', duration: 6 },
]

export function Hero() {
  const animated = useAmbientMotion()

  return (
    <section className="relative overflow-hidden">
      {/* Faint dot-grid ambience */}
      <div
        className="pointer-events-none absolute inset-0 opacity-[0.35] [mask-image:radial-gradient(circle_at_center,black,transparent_70%)]"
        style={{
          backgroundImage: 'radial-gradient(currentColor 1px, transparent 1px)',
          backgroundSize: '28px 28px',
          color: 'var(--color-muted-foreground)',
        }}
      />

      {/* Floating ambient code tokens */}
      {animated &&
        TOKENS.map((t, i) => (
          <motion.span
            key={t.text}
            className="pointer-events-none absolute hidden select-none font-mono text-xs text-muted-foreground/25 sm:block"
            style={{ top: t.top, left: t.left }}
            animate={{ y: [0, -10, 0] }}
            transition={{ duration: t.duration, repeat: Infinity, ease: 'easeInOut', delay: i * 0.4 }}
          >
            {t.text}
          </motion.span>
        ))}

      <div className="relative mx-auto grid max-w-6xl grid-cols-1 items-center gap-10 px-4 py-16 sm:px-6 sm:py-24 lg:grid-cols-[1.1fr_0.9fr] lg:py-28">
        <div>
          <motion.div initial="hidden" animate="show" variants={ENTRANCE}>
            <Badge variant="outline" className="gap-1.5 font-mono">
              <Sparkles className="h-3 w-3" /> Programming Hero Instructor Lab
            </Badge>
          </motion.div>

          <motion.h1
            initial="hidden"
            animate="show"
            variants={ENTRANCE}
            transition={{ delay: 0.12 }}
            className="mt-5 text-4xl font-bold leading-[1.1] tracking-tight sm:text-5xl lg:text-6xl"
          >
            Don&apos;t just read code.
            <br />
            <span className="bg-linear-to-br from-amber-500 via-fuchsia-500 to-violet-600 bg-clip-text text-transparent">
              Watch it think. Say it out loud.
            </span>
          </motion.h1>

          <motion.p
            initial="hidden"
            animate="show"
            variants={ENTRANCE}
            transition={{ delay: 0.24 }}
            className="mt-5 max-w-xl text-base leading-relaxed text-muted-foreground sm:text-lg"
          >
            Phi Lab is the first step for beginner-to-advanced learners — interactive labs
            that turn JavaScript internals and technical interviews into something you can
            see, run, and practice.
          </motion.p>

          <motion.div
            initial="hidden"
            animate="show"
            variants={ENTRANCE}
            transition={{ delay: 0.36 }}
            className="mt-7 flex flex-col gap-3 sm:flex-row"
          >
            <Button asChild size="lg" className="h-12 text-base bg-linear-to-r from-pink-500 to-red-500">
              <Link href="/labs/js-motion">
                <Cpu className="mr-1.5" /> Step through code
              </Link>
            </Button>
            <Button asChild size="lg" variant="outline" className="h-12 text-base">
              <Link href="/labs/interview">
                <Mic className="mr-1.5" /> Take a mock interview
              </Link>
            </Button>
          </motion.div>

          <motion.p
            initial="hidden"
            animate="show"
            variants={ENTRANCE}
            transition={{ delay: 0.46 }}
            className="mt-3 text-xs text-muted-foreground"
          >
            Free · No signup · Runs in your browser
          </motion.p>

          <motion.div
            initial="hidden"
            animate="show"
            variants={ENTRANCE}
            transition={{ delay: 0.56 }}
            className={cn(
              'mt-10 flex flex-wrap items-center gap-x-6 gap-y-2 text-xs text-muted-foreground',
            )}
          >
            <span className="flex items-center gap-1.5"><ArrowRight className="h-3.5 w-3.5 text-amber-500" /> 10+ interview topics</span>
            <span className="flex items-center gap-1.5"><ArrowRight className="h-3.5 w-3.5 text-violet-500" /> Step-level JS tracing</span>
            <span className="flex items-center gap-1.5"><ArrowRight className="h-3.5 w-3.5 text-fuchsia-500" /> AI voice feedback</span>
          </motion.div>
        </div>

        <motion.div
          initial="hidden"
          animate="show"
          variants={ENTRANCE}
          transition={{ delay: 0.3 }}
          className="flex items-center justify-center"
        >
          <PhiOrb size={190} />
        </motion.div>
      </div>
    </section>
  )
}
