'use client'

// Client-side XP store. A tiny module-level store (no provider needed) so the
// nav badge, the quiz page, and the achievements page all share one snapshot.
// `award()` posts to the server and fires level-up / badge celebrations.
import { useSyncExternalStore, useCallback } from 'react'
import { toast } from 'sonner'
import confetti from 'canvas-confetti'
import { levelInfo, titleForLevel, type LevelInfo } from './levels'
import { badgeById } from './badges'

export interface XpSnapshot {
  xp: number
  badgeIds: string[]
  loaded: boolean
}

let snapshot: XpSnapshot = { xp: 0, badgeIds: [], loaded: false }
const listeners = new Set<() => void>()
let inflight: Promise<void> | null = null

function emit() {
  for (const l of listeners) l()
}

function setSnapshot(next: Partial<XpSnapshot>) {
  snapshot = { ...snapshot, ...next }
  emit()
}

function subscribe(cb: () => void): () => void {
  listeners.add(cb)
  return () => listeners.delete(cb)
}

/** Load (or reload) the profile from the server. Deduped while in flight. */
export function refreshXp(): Promise<void> {
  if (inflight) return inflight
  inflight = fetch('/api/xp/me')
    .then((r) => (r.ok ? r.json() : null))
    .then((data) => {
      if (data && typeof data.xp === 'number') {
        setSnapshot({ xp: data.xp, badgeIds: data.badgeIds ?? [], loaded: true })
      } else {
        setSnapshot({ loaded: true })
      }
    })
    .catch(() => setSnapshot({ loaded: true }))
    .finally(() => {
      inflight = null
    })
  return inflight
}

function celebrateLevelUp(level: number) {
  confetti({ particleCount: 120, spread: 80, origin: { y: 0.6 }, startVelocity: 45 })
  toast.success(`Level ${level} — ${titleForLevel(level)}!`, {
    description: 'You leveled up. Keep the streak going.',
  })
}

function celebrateBadge(badgeId: string) {
  const badge = badgeById(badgeId)
  if (!badge) return
  toast(`🏅 Badge unlocked: ${badge.label}`, { description: badge.description })
}

export interface AwardResponse {
  awarded: boolean
  xpGained: number
  totalXp: number
  level: number
  leveledUp: boolean
  newBadges: string[]
}

/**
 * Grant a client-triggered award. Updates the shared snapshot optimistically
 * from the server response and fires celebrations for level-ups / new badges.
 */
export async function award(reason: string, sourceId: string, extra?: { streak?: number; concept?: string }): Promise<AwardResponse | null> {
  try {
    const res = await fetch('/api/xp/award', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ reason, sourceId, ...extra }),
    })
    if (!res.ok) return null
    const data = (await res.json()) as AwardResponse
    if (data.awarded) {
      setSnapshot({ xp: data.totalXp, badgeIds: [...new Set([...snapshot.badgeIds, ...data.newBadges])] })
      if (data.leveledUp) celebrateLevelUp(data.level)
      for (const b of data.newBadges) celebrateBadge(b)
    }
    return data
  } catch {
    return null
  }
}

export interface UseXp extends XpSnapshot {
  info: LevelInfo
  refresh: () => Promise<void>
}

/** Subscribe a component to the shared XP snapshot. */
export function useXp(): UseXp {
  const snap = useSyncExternalStore(subscribe, () => snapshot, () => snapshot)
  const refresh = useCallback(() => refreshXp(), [])
  return { ...snap, info: levelInfo(snap.xp), refresh }
}
