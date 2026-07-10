'use client'

// This week's top helpers. Compact enough to sit above the feed without
// stealing attention from the questions themselves.
import { useEffect, useState } from 'react'
import { Crown } from 'lucide-react'
import { Card } from '@/components/ui/card'
import { cn } from '@/lib/utils'
import { HiveAvatar } from './bits'

interface Row {
  userId: string
  name: string
  image: string | null
  nectar: number
  approved: number
  accepted: number
  score: number
}

export function LeaderboardPanel() {
  const [rows, setRows] = useState<Row[]>([])

  useEffect(() => {
    fetch('/api/hive/leaderboard')
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => d && setRows(d.rows))
      .catch(() => {})
  }, [])

  if (rows.length === 0) return null

  return (
    <Card className="hive-glass gap-2 rounded-xl p-4">
      <div className="flex items-center gap-1.5 text-sm font-semibold">
        <Crown className="size-4 text-primary" />
        Top helpers this week
      </div>
      <ol className="mt-1 space-y-2">
        {rows.slice(0, 5).map((r, i) => (
          <li key={r.userId} className="flex items-center gap-2.5 text-sm">
            <span
              className={cn(
                'w-5 text-center text-xs font-semibold',
                i === 0 ? 'text-amber-500' : 'text-muted-foreground',
              )}
            >
              {i + 1}
            </span>
            <HiveAvatar author={{ id: r.userId, name: r.name, image: r.image, isAI: false, role: null }} size="sm" />
            <span className="min-w-0 flex-1 truncate">{r.name}</span>
            <span className="text-xs text-muted-foreground">
              {r.accepted > 0 && `${r.accepted} accepted · `}
              {r.nectar} 🍯
            </span>
          </li>
        ))}
      </ol>
    </Card>
  )
}
