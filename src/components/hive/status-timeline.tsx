'use client'

// Package-tracking style history for a post, rendered from the append-only
// HivePostEvent log. Collapsed by default — it's reassurance, not the main act.
import { useState } from 'react'
import { ChevronDown } from 'lucide-react'
import { cn } from '@/lib/utils'
import { timeAgo } from './bits'
import type { HiveEventDTO } from '@/lib/hive/types'

const LABELS: Record<string, string> = {
  created: 'Question posted',
  triaged: 'Sorted and tagged by the Hive',
  ai_attempt_1: 'Hive AI answered',
  ai_attempt_2: 'Hive AI tried a different angle',
  ai_attempt_3: 'Hive AI asked for more detail',
  ai_error: 'Hive AI could not answer',
  escalated: 'Handed to a human mentor',
  mentor_assigned: 'A mentor picked this up',
  author_reply: 'You replied',
  peer_reply: 'A classmate replied',
  mentor_reply: 'A mentor replied',
  bee_approved: 'An answer was Bee-Approved',
  resolved: 'Marked as resolved',
  archived: 'Archived to Honeycomb',
}

function label(e: HiveEventDTO): string {
  return LABELS[e.type] ?? e.type.replace(/_/g, ' ')
}

export function StatusTimeline({ events }: { events: HiveEventDTO[] }) {
  const [open, setOpen] = useState(false)
  if (events.length === 0) return null

  return (
    <div className="rounded-lg border">
      <button
        onClick={() => setOpen((o) => !o)}
        className="flex w-full items-center justify-between px-4 py-2.5 text-sm text-muted-foreground hover:bg-muted/50"
      >
        <span>
          Timeline · <span className="text-foreground">{label(events[events.length - 1])}</span>
        </span>
        <ChevronDown className={cn('size-4 transition', open && 'rotate-180')} />
      </button>

      {open && (
        <ol className="space-y-3 border-t px-4 py-3">
          {events.map((e, i) => (
            <li key={e.id} className="flex gap-3 text-sm">
              <div className="flex flex-col items-center">
                <span
                  className={cn(
                    'mt-1.5 size-2 rounded-full',
                    i === events.length - 1 ? 'bg-primary' : 'bg-border',
                  )}
                />
                {i < events.length - 1 && <span className="mt-1 w-px flex-1 bg-border" />}
              </div>
              <div className="pb-1">
                <p>{label(e)}</p>
                <p className="text-xs text-muted-foreground">{timeAgo(e.createdAt)}</p>
              </div>
            </li>
          ))}
        </ol>
      )}
    </div>
  )
}
