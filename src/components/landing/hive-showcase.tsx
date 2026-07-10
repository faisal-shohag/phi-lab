'use client'

// Landing section for Hive. The video autoplays muted and loops — it's
// decoration, so it's `aria-hidden`, carries a poster for first paint, and
// stops animating for anyone who asked for reduced motion.
import Link from 'next/link'
import { motion } from 'framer-motion'
import { ArrowRight, Bot, ShieldCheck, Clock, Hexagon } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Reveal } from './reveal'
import { useAmbientMotion } from './reveal'

const POINTS = [
  {
    icon: Bot,
    title: 'The AI answers first',
    body: 'Post a problem and get a worked answer in seconds — with the corrected code, not just a hint.',
  },
  {
    icon: ShieldCheck,
    title: 'A human when it matters',
    body: "Three failed attempts, or anything sensitive, and a mentor takes over — holding everything the AI already tried.",
  },
  {
    icon: Hexagon,
    title: 'Answers become the Honeycomb',
    body: 'Solved threads are distilled into a searchable knowledge base. Everything else expires in three days.',
  },
]

export function HiveShowcase() {
  const animated = useAmbientMotion()

  return (
    <section
      id="hive"
      className="relative overflow-hidden border-y border-amber-200/50 bg-linear-to-b from-amber-50/70 via-orange-50/40 to-transparent dark:border-amber-900/30 dark:from-amber-950/25 dark:via-orange-950/10"
    >
      <div className="mx-auto max-w-6xl px-4 py-16 sm:px-6 sm:py-24">
        <div className="grid items-center gap-10 lg:grid-cols-2 lg:gap-14">
          <Reveal>
            <Badge className="bg-linear-to-br from-amber-500 to-orange-600 text-white">New</Badge>
            <h2 className="mt-3 text-2xl font-bold sm:text-3xl">
              Hive — the helpdesk that answers itself
            </h2>
            <p className="mt-2 max-w-lg text-sm leading-relaxed text-muted-foreground sm:text-base">
              A social feed for the questions that stall you. The Hive AI replies instantly, tries a
              different angle when you&apos;re still stuck, and hands you to a mentor when it runs out of
              ideas.
            </p>

            <ul className="mt-7 space-y-5">
              {POINTS.map(({ icon: Icon, title, body }) => (
                <li key={title} className="flex gap-3.5">
                  <span className="mt-0.5 flex size-9 shrink-0 items-center justify-center rounded-lg bg-linear-to-br from-amber-500 to-orange-600 text-white shadow-md">
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
              className="group mt-8 rounded-full bg-linear-to-br from-amber-500 to-orange-600 text-white shadow-lg shadow-amber-500/25 hover:from-amber-500 hover:to-orange-500"
            >
              <Link href="/hive">
                Enter the Hive
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
              {/* Ambient honey glow behind the frame. */}
              <div
                aria-hidden
                className="absolute -inset-6 -z-10 rounded-[2rem] bg-linear-to-br from-amber-300/40 via-orange-300/25 to-transparent blur-2xl dark:from-amber-500/15 dark:via-orange-500/10"
              />
              <div className="overflow-hidden rounded-2xl border border-amber-200/70 bg-white/60 p-2 shadow-2xl shadow-amber-900/10 backdrop-blur-sm dark:border-amber-900/40 dark:bg-white/5">
                <video
                  className="aspect-4/3 w-full rounded-xl object-cover"
                  src="/hive/hive-showcase.mp4"
                  poster="/hive/hive-showcase-poster.jpg"
                  autoPlay={animated}
                  loop
                  muted
                  playsInline
                  preload="metadata"
                  aria-hidden
                />
              </div>

              <div className="pointer-events-none absolute -bottom-4 -left-4 flex items-center gap-2 rounded-xl border border-amber-200/70 bg-white/80 px-3 py-2 shadow-lg backdrop-blur-md dark:border-amber-900/40 dark:bg-zinc-900/80">
                <Clock className="size-4 text-amber-600 dark:text-amber-400" />
                <span className="text-xs font-medium">First answer in seconds, not hours</span>
              </div>
            </motion.div>
          </Reveal>
        </div>
      </div>
    </section>
  )
}
