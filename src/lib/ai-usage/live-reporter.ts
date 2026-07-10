'use client'

// Client half of live-round usage reporting. See app/api/ai-usage/live/route.ts
// for why this has to happen in the browser at all.
//
// Two things worth knowing about Gemini Live's `usageMetadata`:
//
//  1. It is CUMULATIVE. Each message carries running totals for the session, not
//     a delta. So we keep the latest value and never sum — summing would inflate
//     a 3-minute round into a five-figure token count.
//  2. The output field is `responseTokenCount`, not the `candidatesTokenCount`
//     that generateContent uses. Verified in @google/genai's genai.d.ts.
//
// Flushing happens twice over, guarded by `flushed`: once on the normal end of
// the round (keepalive fetch), and once on tab close (sendBeacon). Beacons carry
// cookies, so `requireUser()` still authenticates them; they cannot set headers,
// which is why the endpoint reads a plain JSON body. A duplicate flush is
// absorbed by the `ai_usage_live_once` partial unique index, so we can afford to
// be eager rather than lose the row when a user just closes the tab.
import { useCallback, useEffect, useMemo, useRef } from 'react'

export type LiveFeature = 'INTERVIEW' | 'FEYNMAN' | 'ENGLISH' | 'SUPPORT'

const ENDPOINT = '/api/ai-usage/live'

/** The subset of Live's usageMetadata we record. */
interface LiveUsage {
  promptTokenCount?: number
  responseTokenCount?: number
  thoughtsTokenCount?: number
  totalTokenCount?: number
}

interface Payload {
  feature: LiveFeature
  sessionId: string
  durationMs: number
  promptTokens?: number
  responseTokens?: number
  totalTokens?: number
}

export interface LiveUsageReporter {
  /** Call on every Live server message; cheap, ignores messages without usage. */
  observe: (usage: LiveUsage | undefined) => void
  /** Call when the round starts, with the session id the server just minted. */
  begin: (sessionId: string) => void
  /** Call on normal end of the round. Safe to call more than once. */
  flush: () => void
}

export function useLiveUsageReporter(feature: LiveFeature): LiveUsageReporter {
  const usageRef = useRef<LiveUsage | null>(null)
  const sessionIdRef = useRef<string | null>(null)
  const startedAtRef = useRef<number | null>(null)
  const flushedRef = useRef(false)

  const buildPayload = useCallback((): Payload | null => {
    const sessionId = sessionIdRef.current
    const startedAt = startedAtRef.current
    if (!sessionId || startedAt === null) return null

    const usage = usageRef.current
    // thoughts are billed as output but reported separately; fold them in.
    const response =
      usage?.responseTokenCount === undefined
        ? undefined
        : usage.responseTokenCount + (usage.thoughtsTokenCount ?? 0)

    return {
      feature,
      sessionId,
      durationMs: Date.now() - startedAt,
      promptTokens: usage?.promptTokenCount,
      responseTokens: response,
      totalTokens: usage?.totalTokenCount,
    }
  }, [feature])

  const begin = useCallback((sessionId: string) => {
    sessionIdRef.current = sessionId
    startedAtRef.current = Date.now()
    usageRef.current = null
    flushedRef.current = false
  }, [])

  const observe = useCallback((usage: LiveUsage | undefined) => {
    // Cumulative — keep the newest, don't accumulate.
    if (usage) usageRef.current = usage
  }, [])

  const flush = useCallback(() => {
    if (flushedRef.current) return
    const payload = buildPayload()
    if (!payload) return
    flushedRef.current = true

    // keepalive lets the request outlive the page for the normal-end case where
    // the user immediately navigates to their report.
    void fetch(ENDPOINT, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
      keepalive: true,
    }).catch(() => {
      // Telemetry. Never surface this to the learner.
    })
  }, [buildPayload])

  // Tab close. `pagehide` only — deliberately NOT `visibilitychange`.
  //
  // visibilitychange fires every time the learner switches tab or app, which
  // happens constantly mid-round. Flushing there would write the round's
  // partial totals and set `flushed`; the final, correct numbers would then be
  // rejected by the ai_usage_live_once unique index. An early flush is strictly
  // worse than a missed one, so the only unload signal we trust is pagehide,
  // which fires on real navigation away and on bfcache eviction.
  useEffect(() => {
    const beacon = () => {
      if (flushedRef.current) return
      const payload = buildPayload()
      if (!payload) return
      flushedRef.current = true
      try {
        navigator.sendBeacon(ENDPOINT, new Blob([JSON.stringify(payload)], { type: 'application/json' }))
      } catch {
        // Best effort by definition.
      }
    }

    window.addEventListener('pagehide', beacon)
    return () => window.removeEventListener('pagehide', beacon)
  }, [buildPayload])

  // Stable identity: consumers put this in useCallback dependency lists.
  return useMemo(() => ({ observe, begin, flush }), [observe, begin, flush])
}
