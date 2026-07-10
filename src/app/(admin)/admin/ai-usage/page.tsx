import { aiUsageSummary } from '@/lib/admin/ai-usage'
import { compactNumber, duration, fullNumber, percent, relativeTime } from '@/lib/admin/format'
import { UsageTrendChart } from '@/components/admin/usage-trend-chart'
import { RangePicker } from '@/components/admin/range-picker'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Badge } from '@/components/ui/badge'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import { Info } from 'lucide-react'

const RANGES = [7, 30, 90] as const

function parseDays(value: string | undefined): number {
  const n = Number(value)
  return RANGES.includes(n as (typeof RANGES)[number]) ? n : 30
}

export default async function AiUsagePage({
  searchParams,
}: {
  searchParams: Promise<{ days?: string }>
}) {
  // searchParams is async in this Next version.
  const days = parseDays((await searchParams).days)
  const usage = await aiUsageSummary(days)

  return (
    <>
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">AI Usage</h1>
          <p className="text-muted-foreground text-sm">
            Every model call the platform makes, per feature.
          </p>
        </div>
        <RangePicker basePath="/admin/ai-usage" current={days} options={[...RANGES]} />
      </div>

      <UsageTrendChart trend={usage.trend} />

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            By feature
            <Tooltip>
              <TooltipTrigger>
                <Info className="text-muted-foreground size-3.5" />
              </TooltipTrigger>
              <TooltipContent className="max-w-72">
                Live voice rounds run browser-to-Google, so their token counts are reported by the
                browser and cannot be fully trusted. They are marked below.
              </TooltipContent>
            </Tooltip>
          </CardTitle>
          <CardDescription>
            {fullNumber(usage.totals.calls)} calls · {compactNumber(usage.totals.totalTokens)} tokens
            · {compactNumber(usage.totals.trustedTokens)} of them server-observed
          </CardDescription>
        </CardHeader>
        <CardContent>
          {usage.features.length === 0 ? (
            <p className="text-muted-foreground py-6 text-center text-sm">
              No AI calls recorded in this window.
            </p>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Feature</TableHead>
                    <TableHead className="text-right">Calls</TableHead>
                    <TableHead className="text-right">Failures</TableHead>
                    <TableHead className="text-right">Success</TableHead>
                    <TableHead className="text-right">Avg latency</TableHead>
                    <TableHead className="text-right">Live minutes</TableHead>
                    <TableHead className="text-right">Tokens</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {usage.features.map((f) => (
                    <TableRow key={f.feature}>
                      <TableCell className="font-medium">
                        <span className="capitalize">{f.feature.toLowerCase()}</span>
                        {f.hasClientReportedTokens ? (
                          <Badge variant="outline" className="ml-2 font-normal">
                            client-reported
                          </Badge>
                        ) : null}
                      </TableCell>
                      <TableCell className="text-right tabular-nums">{fullNumber(f.calls)}</TableCell>
                      <TableCell className="text-right tabular-nums">
                        {f.failures ? (
                          <span className="text-destructive">{fullNumber(f.failures)}</span>
                        ) : (
                          '0'
                        )}
                      </TableCell>
                      <TableCell className="text-right tabular-nums">{percent(f.successRate)}</TableCell>
                      <TableCell className="text-right tabular-nums">{duration(f.avgLatencyMs)}</TableCell>
                      <TableCell className="text-right tabular-nums">
                        {f.liveMinutes ? fullNumber(f.liveMinutes) : '—'}
                      </TableCell>
                      <TableCell className="text-right tabular-nums">
                        {compactNumber(f.totalTokens)}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      <div className="grid gap-4 lg:grid-cols-3">
        <Card>
          <CardHeader>
            <CardTitle>By provider</CardTitle>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Provider</TableHead>
                  <TableHead className="text-right">Calls</TableHead>
                  <TableHead className="text-right">Failed</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {usage.providers.map((p) => (
                  <TableRow key={p.provider}>
                    <TableCell className="font-medium capitalize">{p.provider.toLowerCase()}</TableCell>
                    <TableCell className="text-right tabular-nums">{fullNumber(p.calls)}</TableCell>
                    <TableCell className="text-right tabular-nums">{fullNumber(p.failures)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>By task</CardTitle>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Task</TableHead>
                  <TableHead className="text-right">Calls</TableHead>
                  <TableHead className="text-right">Latency</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {usage.tasks.map((t) => (
                  <TableRow key={t.task}>
                    <TableCell className="font-medium">{t.task.replace(/_/g, ' ').toLowerCase()}</TableCell>
                    <TableCell className="text-right tabular-nums">{fullNumber(t.calls)}</TableCell>
                    <TableCell className="text-right tabular-nums">{duration(t.avgLatencyMs)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>By model</CardTitle>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Model</TableHead>
                  <TableHead className="text-right">Calls</TableHead>
                  <TableHead className="text-right">Tokens</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {usage.models.map((m) => (
                  <TableRow key={m.model}>
                    <TableCell className="font-mono text-xs">{m.model}</TableCell>
                    <TableCell className="text-right tabular-nums">{fullNumber(m.calls)}</TableCell>
                    <TableCell className="text-right tabular-nums">
                      {compactNumber(m.totalTokens)}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Recent failures</CardTitle>
          <CardDescription>
            The last 25 calls that did not succeed. A dashboard built only on successes shows a fleet
            that never has a bad day.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {usage.recentErrors.length === 0 ? (
            <p className="text-muted-foreground py-6 text-center text-sm">
              No failures in this window.
            </p>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>When</TableHead>
                    <TableHead>Feature</TableHead>
                    <TableHead>Provider</TableHead>
                    <TableHead>Kind</TableHead>
                    <TableHead>Message</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {usage.recentErrors.map((e, i) => (
                    <TableRow key={`${e.createdAt}-${i}`}>
                      <TableCell className="whitespace-nowrap">{relativeTime(e.createdAt)}</TableCell>
                      <TableCell className="capitalize">{e.feature.toLowerCase()}</TableCell>
                      <TableCell className="capitalize">{e.provider.toLowerCase()}</TableCell>
                      <TableCell>
                        <Badge variant="destructive" className="font-normal">
                          {e.errorKind?.replace(/_/g, ' ').toLowerCase() ?? 'unknown'}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-muted-foreground max-w-md truncate text-xs">
                        {e.errorMessage ?? '—'}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </>
  )
}
