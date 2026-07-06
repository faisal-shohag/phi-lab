'use client'

import type { ReactNode } from 'react'
import { motion, useReducedMotion, type Variants } from 'framer-motion'

// Scroll-triggered fade-up used by every landing section. Centralizing this
// keeps the reduced-motion gate in one place instead of duplicated per section.
export const fadeUp: Variants = {
  hidden: { opacity: 0, y: 16 },
  show: { opacity: 1, y: 0, transition: { duration: 0.5, ease: 'easeOut' } },
}

export const staggerContainer: Variants = {
  hidden: {},
  show: { transition: { staggerChildren: 0.12 } },
}

interface RevealProps {
  children: ReactNode
  className?: string
  /** Use the staggered container variant instead of the plain fade-up. */
  stagger?: boolean
  as?: 'div' | 'section'
}

export function Reveal({ children, className, stagger, as = 'div' }: RevealProps) {
  const reduced = useReducedMotion()
  const Comp = as === 'section' ? motion.section : motion.div

  if (reduced) {
    const Static = as === 'section' ? 'section' : 'div'
    return <Static className={className}>{children}</Static>
  }

  return (
    <Comp
      className={className}
      initial="hidden"
      whileInView="show"
      viewport={{ once: true, amount: 0.25 }}
      variants={stagger ? staggerContainer : fadeUp}
    >
      {children}
    </Comp>
  )
}

/** Item to use inside a `<Reveal stagger>` container. */
export function RevealItem({ children, className }: { children: ReactNode; className?: string }) {
  const reduced = useReducedMotion()
  if (reduced) return <div className={className}>{children}</div>
  return (
    <motion.div className={className} variants={fadeUp}>
      {children}
    </motion.div>
  )
}

/** Hook other landing components use to disable infinite ambient loops. */
export function useAmbientMotion() {
  const reduced = useReducedMotion()
  return !reduced
}
