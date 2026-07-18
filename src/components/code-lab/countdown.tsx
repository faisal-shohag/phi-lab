'use client'

import { useEffect, useState } from 'react'
import { contestStatus, secondsToTransition, type ContestStatus } from '@/lib/code-lab/contest-status'

/**
 * Live contest clock. Ticks every second and re-derives status from the wall
 * clock, so a card flips UPCOMING -> RUNNING -> FINISHED on its own with no
 * reload. `secondsLeft` counts down to the next transition (start, then end).
 */
export function useContestClock(startsAt: Date, endsAt: Date): { status: ContestStatus; secondsLeft: number } {
  const [now, setNow] = useState(() => new Date())
  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 1000)
    return () => clearInterval(id)
  }, [])
  return {
    status: contestStatus(now, startsAt, endsAt),
    secondsLeft: secondsToTransition(now, startsAt, endsAt),
  }
}

/** Formats a duration as `2d 03:14:22` / `03:14:22` / `14:22`. */
export function formatDuration(totalSeconds: number): string {
  const s = Math.max(0, totalSeconds)
  const days = Math.floor(s / 86400)
  const hours = Math.floor((s % 86400) / 3600)
  const mins = Math.floor((s % 3600) / 60)
  const secs = s % 60
  const pad = (n: number) => n.toString().padStart(2, '0')
  if (days > 0) return `${days}d ${pad(hours)}:${pad(mins)}:${pad(secs)}`
  if (hours > 0) return `${pad(hours)}:${pad(mins)}:${pad(secs)}`
  return `${pad(mins)}:${pad(secs)}`
}

/** Just the ticking number, for inline use. */
export function Countdown({ secondsLeft }: { secondsLeft: number }) {
  return <span className="font-mono tabular-nums">{formatDuration(secondsLeft)}</span>
}
