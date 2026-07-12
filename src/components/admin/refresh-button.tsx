'use client'

import { useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { RefreshCw } from 'lucide-react'
import { Button } from '@/components/ui/button'

// The labs monitor is a snapshot of live state, and every other admin page is a
// plain Server Component rendered on request. Rather than introduce polling (and
// with it a background query every few seconds against the session tables, for
// every admin who leaves the tab open), the page is refreshed on demand and
// stamped with the time it was taken — so a stale screen looks stale.
//
// router.refresh() re-runs the Server Component and streams the new markup in
// place; useTransition keeps the current numbers on screen while it does, instead
// of flashing the skeleton.
export function RefreshButton({ label = 'Refresh' }: { label?: string }) {
  const router = useRouter()
  const [pending, startTransition] = useTransition()

  return (
    <Button
      variant="outline"
      size="sm"
      onClick={() => startTransition(() => router.refresh())}
      disabled={pending}
    >
      <RefreshCw className={`size-3.5 ${pending ? 'animate-spin' : ''}`} />
      {pending ? 'Refreshing…' : label}
    </Button>
  )
}
