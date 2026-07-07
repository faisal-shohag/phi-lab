'use client'

import { useMemo, useState } from 'react'
import { CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { topicById } from '@/lib/interview/topics'
import { cn } from '@/lib/utils'

export interface TrendPoint {
  date: string // ISO
  score: number
  topic: string
}

export function ScoreTrendChart({ data }: { data: TrendPoint[] }) {
  const topics = useMemo(() => Array.from(new Set(data.map((d) => d.topic))), [data])
  const [topic, setTopic] = useState<string>('all')

  const points = useMemo(() => {
    const filtered = topic === 'all' ? data : data.filter((d) => d.topic === topic)
    return filtered
      .slice()
      .sort((a, b) => a.date.localeCompare(b.date))
      .map((d, i) => ({
        i: i + 1,
        score: d.score,
        label: new Date(d.date).toLocaleDateString(undefined, { month: 'short', day: 'numeric' }),
      }))
  }, [data, topic])

  if (data.length < 2) {
    return (
      <div className="flex h-48 items-center justify-center rounded-2xl border-2 border-border bg-card text-sm text-muted-foreground">
        Complete a couple of interviews to see your score trend.
      </div>
    )
  }

  return (
    <div className="rounded-2xl border-2 border-border bg-card p-4 shadow-sm sm:p-5">
      <div className="mb-3 flex items-center justify-between gap-2">
        <h3 className="text-sm font-semibold">Score trend</h3>
        <div className="flex flex-wrap gap-1">
          <FilterChip active={topic === 'all'} onClick={() => setTopic('all')}>All</FilterChip>
          {topics.map((t) => (
            <FilterChip key={t} active={topic === t} onClick={() => setTopic(t)}>
              {topicById(t)?.label ?? t}
            </FilterChip>
          ))}
        </div>
      </div>
      <div className="h-56 w-full">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={points} margin={{ top: 8, right: 8, bottom: 4, left: -20 }}>
            <CartesianGrid strokeDasharray="3 3" className="stroke-border" vertical={false} />
            <XAxis dataKey="label" tick={{ fontSize: 11 }} className="text-muted-foreground" tickLine={false} axisLine={false} />
            <YAxis domain={[0, 100]} tick={{ fontSize: 11 }} className="text-muted-foreground" tickLine={false} axisLine={false} width={40} />
            <Tooltip
              contentStyle={{ borderRadius: 12, border: '2px solid var(--border)', background: 'var(--card)', fontSize: 12 }}
              labelStyle={{ color: 'var(--muted-foreground)' }}
            />
            <Line type="monotone" dataKey="score" stroke="var(--color-amber-500, #f59e0b)" strokeWidth={2.5} dot={{ r: 3 }} activeDot={{ r: 5 }} />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  )
}

function FilterChip({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      onClick={onClick}
      className={cn(
        'rounded-full border px-2.5 py-0.5 text-xs font-medium transition-colors',
        active ? 'border-foreground bg-foreground text-background' : 'border-border bg-card text-muted-foreground hover:text-foreground',
      )}
    >
      {children}
    </button>
  )
}
