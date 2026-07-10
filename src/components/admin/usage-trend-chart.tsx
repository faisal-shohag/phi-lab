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
import type { TrendPoint } from '@/lib/admin/ai-usage'

// Stacked area: the job is change-over-time AND composition — "how many calls,
// and which feature spent them". The stack total is the platform total.
//
// Colour is bound to the FEATURE, never to its rank in the data. A quiet
// feature keeps its hue when a busy one is filtered out; if slots were assigned
// by sort order the whole chart would repaint on every range change.
//
// Slots are the validated categorical order from globals.css [data-viz=admin].
const FEATURE_SLOT: Record<string, string> = {
  HIVE: 'var(--series-1)',
  INTERVIEW: 'var(--series-2)',
  FEYNMAN: 'var(--series-3)',
  ENGLISH: 'var(--series-4)',
  SUPPORT: 'var(--series-5)',
  ANALOGIES: 'var(--series-6)',
}

const LABEL: Record<string, string> = {
  HIVE: 'Hive',
  INTERVIEW: 'Interview',
  FEYNMAN: 'Feynman',
  ENGLISH: 'English',
  SUPPORT: 'Support',
  ANALOGIES: 'Analogies',
}

interface UsageTrendChartProps {
  trend: TrendPoint[]
}

export function UsageTrendChart({ trend }: UsageTrendChartProps) {
  const { rows, features, config } = useMemo(() => {
    // Pivot [{date, feature, calls}] into one row per date, one key per feature.
    const present = [...new Set(trend.map((t) => t.feature))]
    // Keep the canonical slot order, not first-seen order.
    const ordered = Object.keys(FEATURE_SLOT).filter((f) => present.includes(f as TrendPoint['feature']))

    const byDate = new Map<string, Record<string, string | number>>()
    for (const point of trend) {
      const row = byDate.get(point.date) ?? { date: point.date }
      row[point.feature] = point.calls
      byDate.set(point.date, row)
    }
    // Zero-fill so a gap in one feature doesn't break its stacked band.
    const rows = [...byDate.values()]
      .map((row) => {
        for (const f of ordered) if (row[f] === undefined) row[f] = 0
        return row
      })
      .sort((a, b) => String(a.date).localeCompare(String(b.date)))

    const config: ChartConfig = Object.fromEntries(
      ordered.map((f) => [f, { label: LABEL[f] ?? f, color: FEATURE_SLOT[f] }]),
    )

    return { rows, features: ordered, config }
  }, [trend])

  return (
    <Card data-viz="admin">
      <CardHeader>
        <CardTitle>AI calls over time</CardTitle>
        <CardDescription>Daily calls, stacked by feature.</CardDescription>
      </CardHeader>
      <CardContent>
        {rows.length === 0 ? (
          <p className="text-muted-foreground py-12 text-center text-sm">
            No AI calls recorded in this window.
          </p>
        ) : (
          <ChartContainer config={config} className="aspect-auto h-[280px] w-full">
            <AreaChart data={rows} margin={{ left: 4, right: 8, top: 8 }}>
              {/* Recessive chrome: horizontal rules only, no vertical clutter. */}
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
              {features.map((f) => (
                <Area
                  key={f}
                  dataKey={f}
                  type="monotone"
                  stackId="calls"
                  stroke={`var(--color-${f})`}
                  fill={`var(--color-${f})`}
                  fillOpacity={0.24}
                  strokeWidth={2}
                  // 2px surface gap between stacked bands, per the mark spec.
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
