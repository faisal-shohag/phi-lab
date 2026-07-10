'use client'

// The mentor's escalation queue. Each row shows why the post escalated and the
// AI's full attempt log, so the mentor starts warm — they can see exactly what
// was already tried and never repeat it.
import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import { toast } from 'sonner'
import { Loader2, ChevronDown, ExternalLink, ShieldAlert } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { cn } from '@/lib/utils'
import { HiveMarkdown } from './markdown'
import { TagBadge, timeAgo } from './bits'

interface QueueItem {
  id: string
  title: string
  body: string
  tags: string[]
  topic: string | null
  severity: string | null
  sensitive: boolean
  author: { id: string | null; name: string; image: string | null }
  assignedMentor: { id: string; name: string } | null
  aiAttempts: { id: string; attempt: number | null; kind: string; body: string }[]
  escalationReason: string
  escalatedAt: string
}

export function MentorQueue({ mentorId }: { mentorId: string }) {
  const [items, setItems] = useState<QueueItem[]>([])
  const [loading, setLoading] = useState(true)
  const [claiming, setClaiming] = useState<string | null>(null)
  const [expanded, setExpanded] = useState<string | null>(null)

  const load = useCallback(async () => {
    const res = await fetch('/api/hive/mentor/queue')
    if (res.ok) setItems((await res.json()).posts)
    setLoading(false)
  }, [])

  // State only moves after the await, never synchronously in the effect body.
  useEffect(() => {
    let cancelled = false
    void (async () => {
      const res = await fetch('/api/hive/mentor/queue')
      if (cancelled || !res.ok) return
      const data = await res.json()
      if (cancelled) return
      setItems(data.posts)
      setLoading(false)
    })()
    return () => {
      cancelled = true
    }
  }, [])

  async function claim(postId: string) {
    setClaiming(postId)
    try {
      const res = await fetch('/api/hive/mentor/claim', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ postId }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        toast.error(data?.message ?? 'Could not claim this post.')
        await load()
        return
      }
      toast.success('Claimed. The student has been notified.')
      await load()
    } finally {
      setClaiming(null)
    }
  }

  if (loading) {
    return (
      <div className="flex justify-center py-16">
        <Loader2 className="size-6 animate-spin text-muted-foreground" />
      </div>
    )
  }

  if (items.length === 0) {
    return (
      <div className="hive-hex-bg hive-glass rounded-2xl py-20 text-center">
        <p className="text-4xl">✨</p>
        <p className="mt-2 font-semibold">Queue is clear</p>
        <p className="text-sm text-muted-foreground">The Hive is handling everything right now.</p>
      </div>
    )
  }

  return (
    <div className="space-y-3">
      {items.map((item) => {
        const mine = item.assignedMentor?.id === mentorId
        const open = expanded === item.id
        return (
          <Card key={item.id} className="hive-glass gap-0 rounded-xl p-4">
            <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
              <span className="font-medium text-foreground">{item.author.name}</span>
              <span>·</span>
              <span>waiting {timeAgo(item.escalatedAt)}</span>
              {item.sensitive && (
                <span className="inline-flex items-center gap-1 rounded-full bg-rose-100 px-2 py-0.5 text-[11px] font-medium text-rose-700 dark:bg-rose-950/40 dark:text-rose-200">
                  <ShieldAlert className="size-3" /> Sensitive
                </span>
              )}
              {item.severity === 'high' && (
                <span className="rounded-full bg-orange-100 px-2 py-0.5 text-[11px] font-medium text-orange-700 dark:bg-orange-950/40 dark:text-orange-200">
                  High severity
                </span>
              )}
            </div>

            <h3 className="mt-1 font-semibold leading-snug">{item.title}</h3>
            <p className="mt-1 text-xs text-muted-foreground">
              Escalated because: {item.escalationReason}
            </p>

            <div className="mt-2 flex flex-wrap gap-1.5">
              {item.tags.map((t) => (
                <TagBadge key={t} tag={t} />
              ))}
            </div>

            <button
              onClick={() => setExpanded(open ? null : item.id)}
              className="mt-3 flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
            >
              <ChevronDown className={cn('size-4 transition', open && 'rotate-180')} />
              {item.aiAttempts.length} AI {item.aiAttempts.length === 1 ? 'attempt' : 'attempts'} already made
            </button>

            {open && (
              <div className="mt-3 space-y-3 border-t pt-3">
                <div>
                  <p className="mb-1 text-xs font-medium text-muted-foreground">The question</p>
                  <HiveMarkdown>{item.body}</HiveMarkdown>
                </div>
                {item.aiAttempts.map((a) => (
                  <div key={a.id} className="rounded-md border border-amber-300/60 bg-amber-50/50 p-3 dark:border-amber-800/50 dark:bg-amber-950/20">
                    <p className="mb-1 text-xs font-medium text-amber-800 dark:text-amber-200">
                      AI attempt {a.attempt}
                      {a.kind === 'CLARIFYING_QUESTION' && ' — asked for more detail'}
                    </p>
                    <HiveMarkdown>{a.body}</HiveMarkdown>
                  </div>
                ))}
              </div>
            )}

            <div className="mt-3 flex items-center gap-2">
              {item.assignedMentor && !mine ? (
                <span className="text-sm text-muted-foreground">
                  Claimed by {item.assignedMentor.name}
                </span>
              ) : mine ? (
                <span className="text-sm font-medium text-primary">You claimed this</span>
              ) : (
                <Button size="sm" className="hive-cta rounded-full px-4" onClick={() => claim(item.id)} disabled={claiming === item.id}>
                  {claiming === item.id && <Loader2 className="size-4 animate-spin" />}
                  Claim
                </Button>
              )}
              <Button size="sm" variant="outline" className="hive-btn-soft rounded-full" asChild>
                <Link href={`/hive/${item.id}`}>
                  Open thread <ExternalLink className="size-3.5" />
                </Link>
              </Button>
            </div>
          </Card>
        )
      })}
    </div>
  )
}
