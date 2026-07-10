'use client'

import { useEffect, useState } from 'react'

type Lab = 'interview' | 'feynman' | 'english' | 'support'

/**
 * The admin-configured round length for a lab, in seconds. Falls back to
 * `defaultSeconds` (the module constant each lab already ships) until the fetch
 * resolves, so the setup screen never shows a blank or a layout jump — just the
 * old static copy for a moment, then the real number silently swaps in.
 */
export function useRoundLength(lab: Lab, defaultSeconds: number): number {
  const [seconds, setSeconds] = useState(defaultSeconds)

  useEffect(() => {
    let active = true
    fetch('/api/labs/round-lengths')
      .then((res) => (res.ok ? res.json() : null))
      .then((body) => {
        const value = body?.[lab]
        if (active && typeof value === 'number' && value > 0) setSeconds(value)
      })
      .catch(() => {
        // Falls back to the static default — a wrong-but-plausible number
        // beats a broken setup screen.
      })
    return () => {
      active = false
    }
  }, [lab])

  return seconds
}
