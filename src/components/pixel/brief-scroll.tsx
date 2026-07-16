'use client'

// The brief, as a scroll that unrolls from the bottom of the arena.
//
// It used to be 11px grey text wedged above the editor, which is where you put
// something you have decided nobody will read. This is the same words given the
// room to be read once and then rolled away — the brief matters most in the
// first ten seconds of a challenge and almost never after, and a panel that
// takes space forever to serve ten seconds is the wrong trade.
//
// ── Why height and not scaleY ──
// `scaleY` is the obvious way to unroll something and it is wrong: it stretches
// the glyphs as it goes, so the text squashes and springs rather than being
// revealed, which reads as a UI panel doing an effect. Animating `height` with
// `overflow: hidden` reveals full-size text a sliver at a time, which is what
// unrolling actually looks like. The container is anchored `bottom-0`, so a
// growing height pushes the top edge *up* off the roller rather than pushing the
// page down.

import { useEffect, useMemo, useState } from 'react'
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion'
import { ChevronDown, ScrollText } from 'lucide-react'

import { tokenizeBrief, type BriefToken } from '@/lib/pixel/brief-tokens'
import { cn } from '@/lib/utils'

// ── Why this uses theme tokens and not a palette of its own ──
// It had one: colours sampled off the map backdrop, pine and moss and sage.
// That was the wrong instinct twice over. It ignored light mode entirely, so a
// dark green slab sat in a white arena; and it made the roller a different
// material from every other surface around it, which is what made the closed
// state read as a foreign object stuck to the bottom of the page rather than
// part of the lab.
//
// The board can afford its own palette — it is a full-screen dialog over
// terrain, a place you go. The scroll lives *in* the arena, inches from the
// editor and the score panel, so it has to be made of the same stuff they are:
// `bg-card`, `border-border`, `text-foreground`, and the same
// `rounded-xl border-2` the panels use. The brand pink is the only accent, and
// it goes on the measurements, where it means "this is a number you must hit".

function Token({ token }: { token: BriefToken }) {
  if (token.kind === 'colour') {
    return (
      <span className="mx-0.5 inline-flex items-center gap-1.5 rounded-md border bg-background px-1.5 py-0.5 align-middle font-mono text-[11px] font-semibold">
        <span
          aria-hidden
          className="size-2.5 shrink-0 rounded-[3px] ring-1 ring-foreground/20"
          style={{ background: token.value }}
        />
        {token.value}
      </span>
    )
  }
  if (token.kind === 'measure') {
    return (
      <span className="mx-0.5 inline-block rounded-md border border-pink-500/40 bg-pink-500/10 px-1.5 py-0.5 align-middle font-mono text-[11px] font-semibold text-pink-600 dark:text-pink-400">
        {token.value}
      </span>
    )
  }
  return <span>{token.value}</span>
}

export function BriefScroll({
  challengeTitle,
  brief,
  isSpec,
}: {
  challengeTitle: string
  brief: string
  /** `brief` challenges: the words are the target, not a hint. Say so. */
  isSpec: boolean
}) {
  const reduce = useReducedMotion()
  const [open, setOpen] = useState(false)
  const tokens = useMemo(() => tokenizeBrief(brief, true), [brief])

  // Unrolls itself every time you arrive or switch challenges — the page keys
  // this component by challenge id, so a switch is a fresh mount and this fires
  // again.
  //
  // It used to remember which briefs you had read and stay rolled up for those.
  // That was over-thought: the brief is the first thing you need on every
  // challenge, including ones you have seen, and a learner who does not want it
  // rolls it up in one click. Guessing wrong on their behalf cost more than the
  // gesture does.
  //
  // The beat first: mounting straight into an animation makes the arena look
  // like it is still loading.
  useEffect(() => {
    const t = window.setTimeout(() => setOpen(true), 550)
    return () => window.clearTimeout(t)
  }, [])

  return (
    <div className="pointer-events-none absolute inset-x-0 bottom-0 z-30 flex flex-col items-center">
      <div className="pointer-events-auto flex w-full max-w-2xl flex-col px-4">
        <motion.div
          initial={false}
          animate={{ height: open ? 'auto' : 0 }}
          transition={reduce ? { duration: 0 } : { type: 'spring', stiffness: 210, damping: 26 }}
          className="overflow-hidden"
        >
          {/* The same material as every other panel in the arena:
              `rounded-xl border-2 border-border bg-card`. It is inches from the
              editor, so anything else reads as a foreign object taped to the
              page. */}
          <div className="relative rounded-t-xl border-2 border-b-0 border-border bg-card/95 px-6 pb-5 pt-4 shadow-[0_-10px_40px_rgba(0,0,0,0.18)] backdrop-blur-md">
            {/* The one flourish: a lit seam where the paper leaves the roller. */}
            <div
              aria-hidden
              className="pointer-events-none absolute inset-x-6 top-0 h-px bg-linear-to-r from-transparent via-pink-500/40 to-transparent"
            />

            <p className="mb-2 flex items-center gap-1.5 font-mono text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
              <ScrollText className="size-3 text-pink-500" />
              {isSpec ? 'The spec — there is no picture for this one' : 'The brief'}
              <span className="ml-auto normal-case tracking-normal opacity-70">{challengeTitle}</span>
            </p>

            <p className="text-[15px] leading-relaxed text-foreground">
              {tokens.map((token, i) => (
                <motion.span
                  key={i}
                  className="inline"
                  initial={reduce ? false : { opacity: 0, y: 6 }}
                  animate={open ? { opacity: 1, y: 0 } : { opacity: 0, y: 6 }}
                  transition={
                    reduce
                      ? { duration: 0 }
                      : // Ink appearing as the paper passes it, not a typewriter:
                        // a per-character reveal on a 200-character brief is four
                        // seconds of watching a machine type, every time.
                        { delay: open ? 0.22 + i * 0.018 : 0, duration: 0.22 }
                  }
                >
                  <Token token={token} />
                </motion.span>
              ))}
            </p>

            {isSpec && (
              <p className="mt-3 border-t pt-2 font-mono text-[10px] text-muted-foreground">
                Hit every number exactly — there is nothing to compare against but this.
              </p>
            )}
          </div>
        </motion.div>

        {/* The roller. Always on screen: it is the handle, the affordance, and
            the thing that makes the closed state read as "rolled up" rather than
            "gone". A slim lit bar now instead of a turned wooden rod with end
            caps — the unrolling is what sells the scroll, and the woodgrain was
            doing that job a second time and worse. */}
        {/* Made of the same card as the panel above it, so open reads as one
            object and closed reads as a tab of it. It was a pine-green bar with
            a wood gradient — a different material from everything around it,
            which is exactly what made it read as junk stuck to the bottom of the
            screen. When open it also loses its top corners and border, so the
            seam between panel and handle disappears. */}
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          aria-expanded={open}
          aria-label={open ? 'Roll up the brief' : 'Unroll the brief'}
          className={cn(
            'group relative mx-auto flex h-7 items-center justify-center gap-1.5 border-2 border-b-0 border-border bg-card text-muted-foreground shadow-[0_-4px_18px_rgba(0,0,0,0.12)] backdrop-blur-md transition-colors hover:bg-accent hover:text-foreground',
            open ? 'w-full rounded-none border-t-0' : 'w-44 rounded-t-xl',
          )}
        >
          {/* The grab line — the bit you aim at, and the only thing that says
              "pull me". Hidden when open: there is a whole panel to grab then. */}
          {!open && (
            <span
              aria-hidden
              className="absolute left-1/2 top-1 h-0.5 w-8 -translate-x-1/2 rounded-full bg-muted-foreground/30 transition-colors group-hover:bg-pink-500/60"
            />
          )}
          <span className={cn('font-mono text-[10px] font-bold uppercase tracking-widest', !open && 'mt-1.5')}>
            {open ? 'Roll up' : 'The brief'}
          </span>
          <AnimatePresence initial={false}>
            <motion.span
              key={open ? 'up' : 'down'}
              initial={reduce ? false : { rotate: open ? 180 : 0 }}
              animate={{ rotate: open ? 0 : 180 }}
              transition={reduce ? { duration: 0 } : { duration: 0.2 }}
              className={cn(!open && 'mt-1.5')}
            >
              <ChevronDown className="size-3" />
            </motion.span>
          </AnimatePresence>
        </button>
      </div>
    </div>
  )
}
