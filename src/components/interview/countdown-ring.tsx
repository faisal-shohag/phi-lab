'use client'

import { cn } from '@/lib/utils'

interface CountdownRingProps {
  secondsLeft: number
  total: number
  className?: string
  children?: React.ReactNode
}

function fmt(seconds: number): string {
  const m = Math.floor(seconds / 60)
  const s = seconds % 60
  return `${m}:${s.toString().padStart(2, '0')}`
}

/**
 * SVG progress ring that empties as the round elapses and turns rose in the
 * final 15 seconds. Renders `children` (or the mm:ss label) at its centre.
 */
export function CountdownRing({ secondsLeft, total, className, children }: CountdownRingProps) {
  const size = 132
  const stroke = 8
  const r = (size - stroke) / 2
  const circumference = 2 * Math.PI * r
  const progress = Math.max(0, Math.min(1, secondsLeft / total))
  const offset = circumference * (1 - progress)
  const urgent = secondsLeft <= 15

  return (
    <div className={cn('relative', className)} style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90">
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          strokeWidth={stroke}
          className="stroke-muted"
        />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          className={cn(
            'transition-[stroke-dashoffset] duration-1000 ease-linear',
            urgent ? 'stroke-rose-500' : 'stroke-amber-500',
          )}
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        {children ?? (
          <span
            className={cn(
              'font-mono text-2xl font-bold tabular-nums',
              urgent ? 'text-rose-500' : 'text-foreground',
            )}
          >
            {fmt(secondsLeft)}
          </span>
        )}
      </div>
    </div>
  )
}
