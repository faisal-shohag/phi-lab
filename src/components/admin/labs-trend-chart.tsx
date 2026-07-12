'use client'

import { useMemo } from 'react'
import { Area, AreaChart, CartesianGrid, XAxis, YAxis } from 'recharts'
import {
  ChartContainer,
  ChartLegend,
  ChartLegendContent,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from '@/components/ui/chart'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { compactNumber } from '@/lib/admin/format'
import type { LabTrendPoint } from '@/lib/admin/labs'

// Stacked area, same reasoning as the AI usage chart: the question is change over
// time AND composition — "how many sessions, and which lab ran them". The stack
// total is the platform total.
//
// Colour is bound to the LAB, never to its rank in the data, so a quiet lab keeps
// its hue when a busy one drops out of the range. Slots are the validated
// categorical order from globals.css [data-viz=admin], which defines exactly six —
// and there are exactly six labs, JS Motion included. (The AI-usage chart's map
// has no slot for JS_MOTION, which is why JS Motion silently vanishes from that
// chart; here it is a first-class series.)
//
// Keyed by SLUG, not by display name: ChartContainer emits one CSS custom property
// per config key as `--color-${key}`, and "JS Motion" would produce an invalid
// variable name. The human-readable name rides along as the label.
const LABS: { key: string; label: string; color: string }[] = [
  { key: 'interview', label: 'Interview', color: 'var(--series-1)' },
  { key: 'feynman', label: 'Feynman', color: 'var(--series-2)' },
  { key: 'english', label: 'English', color: 'var(--series-3)' },
  { key: 'support', label: 'Support', color: 'var(--series-4)' },
  { key: 'analogies', label: 'Analogies', color: 'var(--series-5)' },
  { key: 'jsmotion', label: 'JS Motion', color: 'var(--series-6)' },
]

const slugOf = (lab: string) => lab.toLowerCase().replace(/[^a-z0-9]/g, '')

export function LabsTrendChart({ trend }: { trend: LabTrendPoint[] }) {
  const { rows, labs, config } = useMemo(() => {
    const present = new Set(trend.map((t) => slugOf(t.lab)))
    // Canonical slot order, not first-seen order.
    const ordered = LABS.filter((lab) => present.has(lab.key))

    const byDate = new Map<string, Record<string, string | number>>()
    for (const point of trend) {
      const row = byDate.get(point.date) ?? { date: point.date }
      row[slugOf(point.lab)] = point.sessions
      byDate.set(point.date, row)
    }
    // Zero-fill so a gap in one lab doesn't break its stacked band.
    const rows = [...byDate.values()]
      .map((row) => {
        for (const lab of ordered) if (row[lab.key] === undefined) row[lab.key] = 0
        return row
      })
      .sort((a, b) => String(a.date).localeCompare(String(b.date)))

    const config: ChartConfig = Object.fromEntries(
      ordered.map((lab) => [lab.key, { label: lab.label, color: lab.color }]),
    )

    return { rows, labs: ordered, config }
  }, [trend])

  return (
    <Card data-viz="admin">
      <CardHeader>
        <CardTitle>Sessions over time</CardTitle>
        <CardDescription>Sessions started per day, stacked by lab.</CardDescription>
      </CardHeader>
      <CardContent>
        {rows.length === 0 ? (
          <p className="text-muted-foreground py-12 text-center text-sm">
            No lab sessions in this window.
          </p>
        ) : (
          <ChartContainer config={config} className="aspect-auto h-[280px] w-full">
            <AreaChart data={rows} margin={{ left: 4, right: 8, top: 8 }}>
              <CartesianGrid vertical={false} strokeOpacity={0.4} />
              <XAxis
                dataKey="date"
                tickLine={false}
                axisLine={false}
                tickMargin={8}
                minTickGap={24}
                tickFormatter={(v: string) =>
                  new Date(v).toLocaleDateString('en', { month: 'short', day: 'numeric' })
                }
              />
              <YAxis
                tickLine={false}
                axisLine={false}
                tickMargin={8}
                width={40}
                allowDecimals={false}
                tickFormatter={(v: number) => compactNumber(v)}
              />
              <ChartTooltip content={<ChartTooltipContent indicator="dot" />} />
              {labs.map((lab) => (
                <Area
                  key={lab.key}
                  dataKey={lab.key}
                  type="monotone"
                  stackId="sessions"
                  stroke={`var(--color-${lab.key})`}
                  fill={`var(--color-${lab.key})`}
                  fillOpacity={0.24}
                  strokeWidth={2}
                  activeDot={{ r: 4, strokeWidth: 2 }}
                />
              ))}
              {/* Legend is mandatory at >= 2 series: identity must never be colour alone. */}
              <ChartLegend content={<ChartLegendContent />} />
            </AreaChart>
          </ChartContainer>
        )}
      </CardContent>
    </Card>
  )
}
