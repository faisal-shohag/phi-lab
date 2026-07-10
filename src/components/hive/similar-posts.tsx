'use client'

// Duplicate detection. As the student types a title, quietly look for already
// solved questions that match. Shown as a hint, never a blocker — sometimes the
// "duplicate" isn't one.
import { useEffect, useState } from 'react'
import Link from 'next/link'
import { Lightbulb } from 'lucide-react'

interface Similar {
  id: string
  title: string
  tags: string[]
  status: string
}

const MIN_TITLE = 8

export function SimilarPosts({ title, body }: { title: string; body: string }) {
  const [similar, setSimilar] = useState<Similar[]>([])

  const enabled = title.trim().length >= MIN_TITLE

  useEffect(() => {
    if (!enabled) return
    const controller = new AbortController()
    const t = setTimeout(async () => {
      try {
        const res = await fetch('/api/hive/posts/similar', {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ title, body }),
          signal: controller.signal,
        })
        if (res.ok) setSimilar((await res.json()).similar)
      } catch {
        // aborted or offline — the hint is optional
      }
    }, 700)
    return () => {
      clearTimeout(t)
      controller.abort()
    }
  }, [enabled, title, body])

  // Derived rather than cleared in the effect: a too-short title simply hides
  // any stale results instead of triggering a cascading render.
  if (!enabled || similar.length === 0) return null

  return (
    <div className="rounded-lg border border-amber-300/60 bg-amber-50/60 p-3 dark:border-amber-800/50 dark:bg-amber-950/20">
      <p className="flex items-center gap-1.5 text-sm font-medium text-amber-900 dark:text-amber-100">
        <Lightbulb className="size-4" />
        The Hive may have solved this already
      </p>
      <ul className="mt-2 space-y-1">
        {similar.map((s) => (
          <li key={s.id}>
            <Link
              href={`/hive/${s.id}`}
              target="_blank"
              className="text-sm text-amber-900 underline underline-offset-2 hover:opacity-80 dark:text-amber-100"
            >
              {s.title}
            </Link>
          </li>
        ))}
      </ul>
    </div>
  )
}
