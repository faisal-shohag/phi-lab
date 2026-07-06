'use client'

import { motion } from 'framer-motion'
import { cn } from '@/lib/utils'

interface SpeakingOrbView {
  /** 0..1 audio level driving the pulse. */
  level: number
  /** Who's currently the loudest source, tints the orb. */
  speaker: 'interviewer' | 'candidate' | 'idle'
  className?: string
}

/**
 * A soft, breathing orb that scales and glows with the current audio level.
 * Amber/violet when the interviewer speaks, emerald when the candidate does.
 */
export function SpeakingOrb({ level, speaker, className }: SpeakingOrbView) {
  const scale = 1 + level * 0.35
  const glow = 0.35 + level * 0.55

  const palette =
    speaker === 'candidate'
      ? { from: 'var(--color-emerald-400)', to: 'var(--color-teal-600)', ring: 'rgba(16,185,129,' }
      : { from: 'var(--color-amber-400)', to: 'var(--color-violet-600)', ring: 'rgba(168,85,247,' }

  return (
    <div className={cn('relative flex items-center justify-center', className)}>
      {/* Outer halo */}
      <motion.div
        className="absolute rounded-full blur-2xl"
        style={{
          width: 220,
          height: 220,
          background: `radial-gradient(circle, ${palette.ring}${glow}) 0%, ${palette.ring}0) 70%)`,
        }}
        animate={{ scale: 1 + level * 0.5, opacity: 0.6 + level * 0.4 }}
        transition={{ type: 'spring', stiffness: 120, damping: 18 }}
      />
      {/* Pulsing rings */}
      {[0, 1].map((i) => (
        <motion.div
          key={i}
          className="absolute rounded-full border-2"
          style={{ width: 160, height: 160, borderColor: palette.from, opacity: 0.25 }}
          animate={{ scale: [1, 1.35, 1], opacity: [0.3, 0, 0.3] }}
          transition={{ duration: 2.4, delay: i * 1.2, repeat: Infinity, ease: 'easeInOut' }}
        />
      ))}
      {/* Core */}
      <motion.div
        className="relative rounded-full shadow-xl"
        style={{
          width: 150,
          height: 150,
          background: `linear-gradient(135deg, ${palette.from}, ${palette.to})`,
        }}
        animate={{ scale }}
        transition={{ type: 'spring', stiffness: 260, damping: 16 }}
      >
        <div className="absolute inset-2 rounded-full bg-white/20 backdrop-blur-sm" />
        <div className="absolute inset-0 rounded-full ring-1 ring-white/40" />
      </motion.div>
    </div>
  )
}
