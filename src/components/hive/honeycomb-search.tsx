'use client'

// The Honeycomb: search over archived, resolved threads. Each entry shows the
// AI-distilled summary rather than the raw thread, so it reads like a wiki.
import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import Image from 'next/image'
import { Loader2, Search } from 'lucide-react'
import { Input } from '@/components/ui/input'
import { Card } from '@/components/ui/card'
import { HiveMarkdown } from './markdown'
import { TagBadge } from './bits'

interface Entry {
  id: string
  title: string
  kbSummary: string | null
  tags: string[]
  createdAt: string
}

export function HoneycombSearch() {
  const [q, setQ] = useState('')
  const [entries, setEntries] = useState<Entry[]>([])
  const [loading, setLoading] = useState(true)

  const load = useCallback(async (query: string) => {
    const res = await fetch(`/api/hive/honeycomb?q=${encodeURIComponent(query)}`)
    if (res.ok) setEntries((await res.json()).entries)
    setLoading(false)
  }, [])

  // Initial listing. State only moves after the await.
  useEffect(() => {
    let cancelled = false
    void (async () => {
      const res = await fetch('/api/hive/honeycomb?q=')
      if (cancelled || !res.ok) return
      const data = await res.json()
      if (cancelled) return
      setEntries(data.entries)
      setLoading(false)
    })()
    return () => {
      cancelled = true
    }
  }, [])

  return (
    <div className="space-y-4">
      <div className="relative">
        <Search className="pointer-events-none absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          onKeyDown={(e) => {
            if (e.key !== 'Enter') return
            setLoading(true)
            void load(q)
          }}
          placeholder="Search solved problems… (press Enter)"
          className="hive-glass h-10 rounded-full pl-8"
        />
      </div>

      {loading ? (
        <div className="flex justify-center py-16">
          <Loader2 className="size-6 animate-spin text-muted-foreground" />
        </div>
      ) : entries.length === 0 ? (
        <div className="hive-hex-bg hive-glass rounded-2xl py-16 text-center">
          <Image
            src="/hive/honeycomb.png"
            alt=""
            aria-hidden
            width={140}
            height={140}
            className="mx-auto size-24 select-none drop-shadow-md"
          />
          <p className="mt-3 font-semibold">{q ? 'No matches yet' : 'The Honeycomb is still filling up'}</p>
          <p className="text-sm text-muted-foreground">
            Resolved questions with an accepted answer are archived here forever.
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {entries.map((e) => (
            <Card key={e.id} className="hive-glass hive-lift gap-2 rounded-xl p-4">
              <Link href={`/hive/${e.id}`} className="font-semibold hover:underline">
                {e.title}
              </Link>
              {e.kbSummary && (
                <div className="text-muted-foreground">
                  <HiveMarkdown>{e.kbSummary}</HiveMarkdown>
                </div>
              )}
              <div className="flex flex-wrap gap-1.5">
                {e.tags.map((t) => (
                  <TagBadge key={t} tag={t} />
                ))}
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  )
}
