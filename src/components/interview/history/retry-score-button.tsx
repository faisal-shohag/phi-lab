'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Loader2, Repeat } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { resolveErrorCopy } from '@/lib/interview/errors'

/** Re-runs report scoring for a FAILED session from its stored transcript. */
export function RetryScoreButton({ sessionId, size = 'sm' }: { sessionId: string; size?: 'sm' | 'default' }) {
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function retry() {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch('/api/interview/report', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sessionId }),
      })
      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        setError(resolveErrorCopy(data?.error).title)
        setLoading(false)
        return
      }
      router.refresh()
    } catch {
      setError('Try again')
      setLoading(false)
    }
  }

  return (
    <div className="flex items-center gap-2">
      <Button size={size} variant="outline" onClick={retry} disabled={loading}>
        {loading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Repeat className="h-3.5 w-3.5" />}
        Retry scoring
      </Button>
      {error && <span className="text-xs text-rose-500">{error}</span>}
    </div>
  )
}
