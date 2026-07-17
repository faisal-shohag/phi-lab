'use client'

import { Clock, Zap, ChevronRight } from 'lucide-react'
import type { QuizSessionData } from '@/lib/quiz/topics'
import { topicLabel, difficultyLabel } from '@/lib/quiz/topics'
import { Badge } from '@/components/ui/badge'
import { cn } from '@/lib/utils'

interface HistoryListProps {
  sessions: QuizSessionData[]
  onSelect: (session: QuizSessionData) => void
  selectedId: string | null
}

function timeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime()
  const minutes = Math.floor(diff / 60_000)
  if (minutes < 1) return 'just now'
  if (minutes < 60) return `${minutes}m ago`
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return `${hours}h ago`
  const days = Math.floor(hours / 24)
  if (days === 1) return 'yesterday'
  return `${days}d ago`
}

export function HistoryList({ sessions, onSelect, selectedId }: HistoryListProps) {
  const completed = sessions.filter((s) => s.status === 'completed')

  if (completed.length === 0) {
    return (
      <div className="rounded-xl border-2 border-dashed border-border p-6 text-center">
        <p className="text-sm text-muted-foreground">No quiz history yet</p>
        <p className="mt-1 text-xs text-muted-foreground">Complete a quiz to see it here</p>
      </div>
    )
  }

  return (
    <div className="space-y-2">
      {completed.map((session) => {
        const pct = session.total > 0 ? Math.round(((session.score ?? 0) / session.total) * 100) : 0
        return (
          <button
            key={session.id}
            onClick={() => onSelect(session)}
            className={cn(
              'flex w-full items-center gap-3 rounded-xl border-2 p-3 text-left transition-all',
              selectedId === session.id
                ? 'border-primary bg-primary/5'
                : 'border-border bg-card hover:bg-accent',
            )}
          >
            <div
              className={cn(
                'flex h-10 w-10 shrink-0 items-center justify-center rounded-lg text-xs font-bold',
                pct >= 80
                  ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400'
                  : pct >= 50
                    ? 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400'
                    : 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400',
              )}
            >
              {session.score}/{session.total}
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap gap-1">
                {session.topics.slice(0, 3).map((t) => (
                  <Badge key={t} variant="outline" className="text-[9px]">{topicLabel(t)}</Badge>
                ))}
                {session.topics.length > 3 && (
                  <Badge variant="outline" className="text-[9px]">+{session.topics.length - 3}</Badge>
                )}
              </div>
              <div className="mt-0.5 flex items-center gap-2 text-[10px] text-muted-foreground">
                <span>{difficultyLabel(session.difficulty)}</span>
                <span>·</span>
                <Clock className="h-2.5 w-2.5" />
                <span>{timeAgo(session.createdAt)}</span>
                {session.xpAwarded > 0 && (
                  <>
                    <span>·</span>
                    <Zap className="h-2.5 w-2.5" />
                    <span>{session.xpAwarded} XP</span>
                  </>
                )}
              </div>
            </div>
            <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground" />
          </button>
        )
      })}
    </div>
  )
}
