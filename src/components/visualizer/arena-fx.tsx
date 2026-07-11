'use client'

import { useEffect, useState, type RefObject } from 'react'
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion'
import { playCountdownBeat, playGoSting, playMote } from '@/lib/visualizer/sound'

// Whether to play the full juicy motion, or collapse to a quiet fade. Honors the
// OS reduced-motion preference and the lab's calm-mode flag.
export function useArenaJuice(calm?: boolean): boolean {
  const reduce = useReducedMotion()
  return !reduce && !calm
}

// ── Arena entry: flame wipe → 3 · 2 · 1 · GO! ────────────────────────────────
// Renders a full-screen overlay that plays once when a round starts, then calls
// onDone. Under reduced-motion / calm it resolves almost immediately with a
// simple fade so the round still starts promptly.
export function ArenaEntry({ calm, sound, onDone }: { calm?: boolean; sound?: boolean; onDone: () => void }) {
  const juice = useArenaJuice(calm)
  // Sequence: 'wipe' → 3 → 2 → 1 → 'go' → done.
  const [phase, setPhase] = useState<'wipe' | 3 | 2 | 1 | 'go'>('wipe')

  useEffect(() => {
    if (!juice) {
      const t = setTimeout(onDone, 260)
      return () => clearTimeout(t)
    }
    const timers: ReturnType<typeof setTimeout>[] = []
    const at = (ms: number, fn: () => void) => timers.push(setTimeout(fn, ms))
    // Wipe covers the screen (~600ms), then count.
    at(560, () => { setPhase(3); if (sound) playCountdownBeat() })
    at(1160, () => { setPhase(2); if (sound) playCountdownBeat() })
    at(1760, () => { setPhase(1); if (sound) playCountdownBeat() })
    at(2360, () => { setPhase('go'); if (sound) playGoSting() })
    at(3060, onDone)
    return () => timers.forEach(clearTimeout)
    // onDone/sound are stable enough for a one-shot sequence.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [juice])

  if (!juice) {
    return (
      <motion.div
        initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
        className="pointer-events-none fixed inset-0 z-[60] bg-rose-950/60"
      />
    )
  }

  return (
    <div className="pointer-events-none fixed inset-0 z-[60] overflow-hidden">
      {/* Flame wipe — a crimson disc growing from the screen centre-bottom. */}
      <motion.div
        initial={{ clipPath: 'circle(0% at 50% 85%)' }}
        animate={{ clipPath: 'circle(150% at 50% 50%)' }}
        transition={{ duration: 0.6, ease: [0.65, 0, 0.35, 1] }}
        className="absolute inset-0 bg-[radial-gradient(circle_at_50%_45%,#7f1d1d_0%,#450a0a_45%,#0a0a0a_100%)]"
      />
      {/* Countdown numerals. */}
      <div className="absolute inset-0 flex items-center justify-center">
        <AnimatePresence mode="popLayout">
          {phase !== 'wipe' && (
            <motion.div
              key={String(phase)}
              initial={{ scale: 2.4, opacity: 0, filter: 'blur(12px)' }}
              animate={{ scale: 1, opacity: 1, filter: 'blur(0px)' }}
              exit={{ scale: 0.4, opacity: 0, filter: 'blur(8px)' }}
              transition={{ type: 'spring', stiffness: 320, damping: 20 }}
              className={
                phase === 'go'
                  ? 'bg-linear-to-b from-amber-300 to-rose-500 bg-clip-text text-8xl font-black tracking-tight text-transparent drop-shadow-[0_0_30px_rgba(244,63,94,0.6)]'
                  : 'text-9xl font-black text-white/90 drop-shadow-[0_0_24px_rgba(244,63,94,0.5)]'
              }
            >
              {phase === 'go' ? 'GO!' : phase}
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  )
}

function centerOf(el: Element | null): { x: number; y: number } | null {
  if (!el) return null
  const r = el.getBoundingClientRect()
  return { x: r.left + r.width / 2, y: r.top + r.height / 2 }
}

// ── XP motes: golden "+XP" sparks that arc from a source element to the header
// XP badge on a win, tying the reward to the persistent economy. Fires once on
// mount, then removes itself. No-op under reduced-motion / calm.
export function XpMotes({ originRef, calm, sound, count = 9 }: {
  originRef: RefObject<HTMLElement | null>
  calm?: boolean
  sound?: boolean
  count?: number
}) {
  const juice = useArenaJuice(calm)
  const [motes, setMotes] = useState<{ id: number; from: { x: number; y: number }; to: { x: number; y: number }; delay: number }[]>([])

  useEffect(() => {
    if (!juice) return
    const from = centerOf(originRef.current)
    const to = centerOf(document.getElementById('js-motion-xp-anchor'))
    if (!from || !to) return
    setMotes(Array.from({ length: count }, (_, i) => ({
      id: i,
      // Scatter the launch point a touch so they don't stack.
      from: { x: from.x + (i % 3 - 1) * 14, y: from.y + (i % 2) * 10 },
      to,
      delay: i * 0.05,
    })))
    // Chime as each mote lands.
    const timers = Array.from({ length: count }, (_, i) =>
      setTimeout(() => { if (sound) playMote() }, i * 50 + 520))
    return () => timers.forEach(clearTimeout)
    // Fire once on mount.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [juice])

  if (!juice || !motes.length) return null
  return (
    <div className="pointer-events-none fixed inset-0 z-[70]">
      {motes.map((m) => (
        <motion.span
          key={m.id}
          initial={{ x: m.from.x, y: m.from.y, scale: 0.5, opacity: 0 }}
          animate={{
            x: [m.from.x, (m.from.x + m.to.x) / 2 + 40, m.to.x],
            y: [m.from.y, m.from.y - 70, m.to.y],
            scale: [0.5, 1, 0.4],
            opacity: [0, 1, 0],
          }}
          transition={{ duration: 0.62, delay: m.delay, ease: 'easeInOut' }}
          className="absolute left-0 top-0 -ml-2 -mt-2 text-[11px] font-black text-amber-400 drop-shadow-[0_0_6px_rgba(251,191,36,0.8)]"
        >
          +
        </motion.span>
      ))}
    </div>
  )
}

// ── Stake burn: on entering the arena, an ember "−stake XP" chip peels off the
// header XP badge and floats up, so the learner *sees* what they risked. Fires
// once, then removes itself. No-op under reduced-motion / calm.
export function StakeBurn({ stake, calm }: { stake: number; calm?: boolean }) {
  const juice = useArenaJuice(calm)
  const [pos, setPos] = useState<{ x: number; y: number } | null>(null)

  useEffect(() => {
    /* eslint-disable react-hooks/set-state-in-effect */
    if (!juice) return
    setPos(centerOf(document.getElementById('js-motion-xp-anchor')))
    const t = setTimeout(() => setPos(null), 1400)
    return () => clearTimeout(t)
    /* eslint-enable react-hooks/set-state-in-effect */
  }, [juice])

  if (!juice || !pos) return null
  return (
    <div className="pointer-events-none fixed inset-0 z-[70]">
      <motion.div
        initial={{ x: pos.x, y: pos.y, opacity: 0, scale: 0.8 }}
        animate={{ x: pos.x, y: pos.y - 46, opacity: [0, 1, 1, 0], scale: 1 }}
        transition={{ duration: 1.3, ease: 'easeOut' }}
        className="absolute left-0 top-0 -ml-8 -mt-3 rounded-full bg-rose-600 px-2 py-0.5 text-[11px] font-black text-white shadow-[0_0_10px_2px_rgba(244,63,94,0.5)]"
      >
        −{stake} XP
      </motion.div>
    </div>
  )
}

// ── Ambient embers: a few sparks drifting up the screen edges. Pure CSS motion,
// no per-frame JS. Suppressed under reduced-motion / calm.
export function ArenaEmbers({ calm }: { calm?: boolean }) {
  const juice = useArenaJuice(calm)
  if (!juice) return null
  // Deterministic positions so SSR and client agree (no Math.random at render).
  const embers = [6, 16, 28, 40, 52, 63, 74, 82, 91, 96]
  return (
    <div className="pointer-events-none absolute inset-0 z-0 overflow-hidden">
      {embers.map((left, i) => (
        <span
          key={i}
          className="absolute bottom-[-12px] h-1.5 w-1.5 rounded-full bg-orange-400/70 shadow-[0_0_6px_2px_rgba(251,146,60,0.5)] animate-arena-ember"
          style={{ left: `${left}%`, animationDelay: `${(i % 5) * 0.8}s`, animationDuration: `${6 + (i % 4)}s` }}
        />
      ))}
    </div>
  )
}
