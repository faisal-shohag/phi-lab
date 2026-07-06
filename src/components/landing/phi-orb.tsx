'use client'

import { motion } from 'framer-motion'
import { cn } from '@/lib/utils'
import { useAmbientMotion } from './reveal'

interface PhiOrbProps {
  size?: number
  className?: string
  /** Show the 3 orbiting mono chips (heap / call stack / run). Off for small inline uses. */
  withChips?: boolean
}

const CHIPS = [
  { label: 'heap', angle: -100, radius: 1.05 },
  { label: 'call stack', angle: 30, radius: 1.15 },
  { label: '▶ run', angle: 150, radius: 1.05 },
]

/**
 * Self-driving ambient orb for the hero — a grown-up version of the brand's
 * gradient logo tile. Unlike `speaking-orb.tsx` (which needs a live audio
 * level), this one just breathes continuously on its own.
 */
export function PhiOrb({ size = 180, className, withChips = true }: PhiOrbProps) {
  const animated = useAmbientMotion()

  return (
    <div className={cn('relative flex items-center justify-center', className)} style={{ width: size * 1.6, height: size * 1.6 }}>
      {/* Halo */}
      <div
        className="absolute rounded-full blur-2xl"
        style={{
          width: size * 1.3,
          height: size * 1.3,
          background: 'radial-gradient(circle, rgba(217,119,6,0.35) 0%, rgba(168,85,247,0) 70%)',
        }}
      />

      {/* Pulse rings */}
      {animated &&
        [0, 1].map((i) => (
          <motion.div
            key={i}
            className="absolute rounded-full border-2 border-amber-400/40"
            style={{ width: size * 0.9, height: size * 0.9 }}
            animate={{ scale: [1, 1.35, 1], opacity: [0.3, 0, 0.3] }}
            transition={{ duration: 2.4, delay: i * 1.2, repeat: Infinity, ease: 'easeInOut' }}
          />
        ))}

      {/* Core */}
      <motion.div
        className="relative flex items-center justify-center rounded-full shadow-xl"
        style={{
          width: size,
          height: size,
          background: 'linear-gradient(135deg, var(--color-amber-500), var(--color-fuchsia-500), var(--color-violet-600))',
        }}
        animate={animated ? { scale: [1, 1.06, 1] } : undefined}
        transition={{ duration: 5, repeat: Infinity, ease: 'easeInOut' }}
      >
        <div className="absolute inset-2 rounded-full bg-white/15 backdrop-blur-sm" />
        <div className="absolute inset-0 rounded-full ring-1 ring-white/40" />
        <span className="relative font-mono font-bold text-white" style={{ fontSize: size * 0.34 }}>
          Φ
        </span>
      </motion.div>

      {/* Orbiting mono chips */}
      {withChips &&
        CHIPS.map((chip, i) => {
          const rad = (chip.angle * Math.PI) / 180
          const dist = (size * chip.radius) / 2
          const x = Math.cos(rad) * dist
          const y = Math.sin(rad) * dist
          return (
            <motion.span
              key={chip.label}
              className="absolute rounded-full border border-border bg-card/90 px-2 py-1 font-mono text-[10px] text-muted-foreground shadow-sm backdrop-blur-sm"
              style={{ left: `calc(50% + ${x}px)`, top: `calc(50% + ${y}px)`, translate: '-50% -50%' }}
              animate={animated ? { y: [0, -8, 0] } : undefined}
              transition={{ duration: 4 + i, repeat: Infinity, ease: 'easeInOut', delay: i * 0.6 }}
            >
              {chip.label}
            </motion.span>
          )
        })}
    </div>
  )
}
