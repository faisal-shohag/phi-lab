// Pure contest-window logic. No DB, no server-only marker — safe on client and
// server, and unit-tested. Status is always derived from the clock, never stored,
// so a contest flips upcoming -> running -> finished without any write.

export type ContestStatus = 'UPCOMING' | 'RUNNING' | 'FINISHED'

/**
 * Where `now` falls relative to the window. The window is [startsAt, endsAt):
 * a submit landing exactly on endsAt is already FINISHED (closed), and exactly
 * on startsAt is RUNNING (open).
 */
export function contestStatus(now: Date, startsAt: Date, endsAt: Date): ContestStatus {
  const t = now.getTime()
  if (t < startsAt.getTime()) return 'UPCOMING'
  if (t >= endsAt.getTime()) return 'FINISHED'
  return 'RUNNING'
}

export function isRunning(now: Date, startsAt: Date, endsAt: Date): boolean {
  return contestStatus(now, startsAt, endsAt) === 'RUNNING'
}

/** Seconds until the next transition (start if upcoming, end if running), or 0. */
export function secondsToTransition(now: Date, startsAt: Date, endsAt: Date): number {
  const status = contestStatus(now, startsAt, endsAt)
  const target = status === 'UPCOMING' ? startsAt.getTime() : status === 'RUNNING' ? endsAt.getTime() : 0
  if (!target) return 0
  return Math.max(0, Math.round((target - now.getTime()) / 1000))
}
