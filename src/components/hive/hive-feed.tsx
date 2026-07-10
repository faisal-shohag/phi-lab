'use client'

// The Hive feed: a filterable, cursor-paginated list of posts. Fetches the
// first page on mount and appends on "Load more".
import { useCallback, useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import Image from 'next/image'
import { motion, useReducedMotion } from 'framer-motion'
import { PenSquare, Loader2, Search } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { cn } from '@/lib/utils'
import { PostCard } from './post-card'
import { LeaderboardPanel } from './leaderboard-panel'
import type { HivePostCardDTO } from '@/lib/hive/types'

const FILTERS = [
  { key: 'all', label: 'All' },
  { key: 'QUESTION', label: 'Questions' },
  { key: 'ANNOUNCEMENT', label: 'Announcements' },
] as const

export function HiveFeed() {
  const [posts, setPosts] = useState<HivePostCardDTO[]>([])
  const [cursor, setCursor] = useState<string | null>(null)
  const [hasMore, setHasMore] = useState(false)
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState<(typeof FILTERS)[number]['key']>('all')
  const [q, setQ] = useState('')
  const reqId = useRef(0)
  const reduced = useReducedMotion()

  const load = useCallback(
    async (reset: boolean) => {
      const id = ++reqId.current
      const params = new URLSearchParams()
      if (filter !== 'all') params.set('type', filter)
      if (q.trim()) params.set('q', q.trim())
      if (!reset && cursor) params.set('cursor', cursor)
      const res = await fetch(`/api/hive/posts?${params}`)
      if (id !== reqId.current) return // a newer request superseded this one
      if (res.ok) {
        const data = await res.json()
        setPosts((prev) => (reset ? data.posts : [...prev, ...data.posts]))
        setCursor(data.nextCursor)
        setHasMore(Boolean(data.nextCursor))
      }
      setLoading(false)
    },
    [filter, q, cursor],
  )

  // Reload from scratch when the filter changes. State only moves inside the
  // async continuation — a synchronous setState here would cascade renders.
  useEffect(() => {
    let cancelled = false
    void (async () => {
      const params = new URLSearchParams()
      if (filter !== 'all') params.set('type', filter)
      const res = await fetch(`/api/hive/posts?${params}`)
      if (cancelled || !res.ok) return
      const data = await res.json()
      if (cancelled) return
      setPosts(data.posts)
      setCursor(data.nextCursor)
      setHasMore(Boolean(data.nextCursor))
      setLoading(false)
    })()
    return () => {
      cancelled = true
    }
  }, [filter])

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <div className="relative flex-1">
          <Search className="pointer-events-none absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            onKeyDown={(e) => {
              if (e.key !== 'Enter') return
              setLoading(true)
              void load(true)
            }}
            placeholder="Search the Hive…"
            className="hive-glass h-10 rounded-full pl-8"
          />
        </div>
        <Button asChild size="lg" className="hive-cta rounded-full">
          <Link href="/hive/new">
            <PenSquare className="size-4" /> Ask the Hive
          </Link>
        </Button>
      </div>

      <LeaderboardPanel />

      {/* The active pill is one shared element: framer-motion's `layoutId` glides
          it between tabs instead of popping. Reduced motion swaps it instantly. */}
      <div className="flex gap-1.5">
        {FILTERS.map((f) => {
          const active = filter === f.key
          return (
            <button
              key={f.key}
              onClick={() => {
                if (active) return
                setLoading(true)
                setFilter(f.key)
              }}
              className={cn(
                'relative rounded-full px-3.5 py-1.5 text-sm font-medium transition-colors',
                active
                  ? 'text-[oklch(0.22_0.05_55)]'
                  : 'hive-btn-soft text-muted-foreground hover:text-foreground',
              )}
            >
              {active && (
                <motion.span
                  aria-hidden
                  layoutId="hive-filter-pill"
                  className="hive-honey-fill absolute inset-0 rounded-full"
                  transition={
                    reduced
                      ? { duration: 0 }
                      : { type: 'spring', stiffness: 420, damping: 34, mass: 0.7 }
                  }
                />
              )}
              <span className="relative z-10">{f.label}</span>
            </button>
          )
        })}
      </div>

      {loading && posts.length === 0 ? (
        <div className="flex justify-center py-16">
          <Loader2 className="size-6 animate-spin text-muted-foreground" />
        </div>
      ) : posts.length === 0 ? (
        <div className="hive-hex-bg hive-glass rounded-2xl py-16 text-center">
          <Image
            src="/hive/honeycomb.png"
            alt=""
            aria-hidden
            width={140}
            height={140}
            className="mx-auto size-24 select-none drop-shadow-md"
          />
          <p className="mt-3 font-semibold">The Hive is quiet</p>
          <p className="text-sm text-muted-foreground">Be the first to ask a question.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {posts.map((p) => (
            <PostCard key={p.id} post={p} />
          ))}
        </div>
      )}

      {hasMore && (
        <div className="flex justify-center pt-2">
          <Button
            variant="outline"
            className="hive-btn-soft rounded-full"
            onClick={() => {
              setLoading(true)
              void load(false)
            }}
            disabled={loading}
          >
            {loading && <Loader2 className="size-4 animate-spin" />}
            Load more
          </Button>
        </div>
      )}
    </div>
  )
}
