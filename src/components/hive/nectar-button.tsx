'use client'

// 🍯 Nectar: a thank-you, not a vote. Optimistic toggle — the server's unique
// constraint keeps the true state, so a failed request just reverts the pill.
import { useState } from 'react'
import { cn } from '@/lib/utils'

export function NectarButton({
  targetType,
  targetId,
  initialCount,
  initialReacted,
}: {
  targetType: 'post' | 'reply'
  targetId: string
  initialCount: number
  initialReacted: boolean
}) {
  const [count, setCount] = useState(initialCount)
  const [reacted, setReacted] = useState(initialReacted)
  const [busy, setBusy] = useState(false)

  async function toggle() {
    if (busy) return
    setBusy(true)
    const prev = { count, reacted }
    setReacted(!reacted)
    setCount((c) => c + (reacted ? -1 : 1))
    try {
      const res = await fetch('/api/hive/reactions', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ targetType, targetId }),
      })
      if (!res.ok) throw new Error()
      const data = await res.json()
      setReacted(data.reacted)
    } catch {
      setCount(prev.count)
      setReacted(prev.reacted)
    } finally {
      setBusy(false)
    }
  }

  return (
    <button
      type="button"
      onClick={toggle}
      aria-pressed={reacted}
      title="Give nectar"
      className={cn(
        'inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-xs transition',
        reacted
          ? 'border-amber-400 bg-amber-100 text-amber-800 dark:border-amber-700 dark:bg-amber-900/40 dark:text-amber-200'
          : 'border-border text-muted-foreground hover:bg-muted',
      )}
    >
      <span aria-hidden>🍯</span>
      {count > 0 && <span>{count}</span>}
    </button>
  )
}
