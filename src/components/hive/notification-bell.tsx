'use client'

// The bell. Polls every 30s — a helpdesk doesn't need a websocket, and polling
// survives serverless cold starts without extra infrastructure.
import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import { Bell } from 'lucide-react'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { timeAgo } from './bits'

interface Notification {
  id: string
  type: string
  postId: string | null
  title: string
  body: string | null
  read: boolean
  createdAt: string
}

const POLL_MS = 30_000

export function NotificationBell() {
  const [items, setItems] = useState<Notification[]>([])
  const [unread, setUnread] = useState(0)
  const [open, setOpen] = useState(false)

  const load = useCallback(async () => {
    try {
      const res = await fetch('/api/hive/notifications')
      if (!res.ok) return
      const data = await res.json()
      setItems(data.notifications)
      setUnread(data.unread)
    } catch {
      // offline — try again next tick
    }
  }, [])

  // Fetch once on mount, then poll. The initial fetch lives inside an async
  // continuation so no setState runs synchronously in the effect body.
  useEffect(() => {
    let cancelled = false
    void (async () => {
      await Promise.resolve()
      if (!cancelled) await load()
    })()
    const t = setInterval(load, POLL_MS)
    return () => {
      cancelled = true
      clearInterval(t)
    }
  }, [load])

  async function markAllRead() {
    setUnread(0)
    setItems((prev) => prev.map((n) => ({ ...n, read: true })))
    await fetch('/api/hive/notifications', { method: 'PATCH' }).catch(() => {})
  }

  return (
    <Popover
      open={open}
      onOpenChange={(o) => {
        setOpen(o)
        if (o) load()
      }}
    >
      <PopoverTrigger asChild>
        <Button variant="ghost" size="icon" className="relative" aria-label="Notifications">
          <Bell className="size-4" />
          {unread > 0 && (
            <span className="absolute -right-0.5 -top-0.5 flex size-4 items-center justify-center rounded-full bg-primary text-[10px] font-semibold text-primary-foreground">
              {unread > 9 ? '9+' : unread}
            </span>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-80 p-0">
        <div className="flex items-center justify-between border-b px-3 py-2">
          <span className="text-sm font-medium">Notifications</span>
          {unread > 0 && (
            <button onClick={markAllRead} className="text-xs text-primary hover:underline">
              Mark all read
            </button>
          )}
        </div>

        {items.length === 0 ? (
          <p className="px-3 py-8 text-center text-sm text-muted-foreground">Nothing yet.</p>
        ) : (
          <ul className="max-h-80 overflow-y-auto">
            {items.map((n) => {
              const inner = (
                <div className={cn('px-3 py-2.5 hover:bg-muted/60', !n.read && 'bg-primary/5')}>
                  <p className="text-sm font-medium leading-snug">{n.title}</p>
                  {n.body && <p className="line-clamp-1 text-xs text-muted-foreground">{n.body}</p>}
                  <p className="mt-0.5 text-[11px] text-muted-foreground">{timeAgo(n.createdAt)}</p>
                </div>
              )
              return (
                <li key={n.id} className="border-b last:border-0">
                  {n.postId ? (
                    <Link href={`/hive/${n.postId}`} onClick={() => setOpen(false)}>
                      {inner}
                    </Link>
                  ) : (
                    inner
                  )}
                </li>
              )
            })}
          </ul>
        )}
      </PopoverContent>
    </Popover>
  )
}
