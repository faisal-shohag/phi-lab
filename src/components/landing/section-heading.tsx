import type { ReactNode } from 'react'
import { Reveal } from './reveal'
import { cn } from '@/lib/utils'

interface SectionHeadingProps {
  /** Small mono, uppercase label above the title — sets the section rhythm. */
  eyebrow: string
  title: ReactNode
  subtitle?: ReactNode
  className?: string
  /** Left-align instead of the default centered layout. */
  align?: 'center' | 'left'
}

/**
 * Shared section header used across the landing page so every section announces
 * itself the same way: a tracked mono eyebrow, a bold title, an optional lead.
 */
export function SectionHeading({ eyebrow, title, subtitle, className, align = 'center' }: SectionHeadingProps) {
  const centered = align === 'center'
  return (
    <Reveal className={cn(centered && 'text-center', className)}>
      <span
        className={cn(
          'inline-flex items-center gap-2 font-mono text-[11px] font-semibold uppercase tracking-[0.2em] text-muted-foreground',
          centered && 'justify-center',
        )}
      >
        <span className="h-1.5 w-1.5 rounded-full bg-linear-to-br from-amber-500 via-fuchsia-500 to-violet-600" />
        {eyebrow}
      </span>
      <h2 className="mt-3 text-2xl font-bold tracking-tight sm:text-3xl">{title}</h2>
      {subtitle && (
        <p
          className={cn(
            'mt-3 text-sm leading-relaxed text-muted-foreground sm:text-base',
            centered && 'mx-auto max-w-xl',
          )}
        >
          {subtitle}
        </p>
      )}
    </Reveal>
  )
}
