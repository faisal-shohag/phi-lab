import { hiveAnalytics } from '@/lib/hive/analytics'
import { compactNumber, duration, fullNumber, percent, relativeTime } from '@/lib/admin/format'
import { RangePicker } from '@/components/admin/range-picker'
import { StatCard } from '@/components/admin/stat-card'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Badge } from '@/components/ui/badge'
import { Progress } from '@/components/ui/progress'

const RANGES = [7, 30, 90] as const

function parseDays(value: string | undefined): number {
  const n = Number(value)
  return RANGES.includes(n as (typeof RANGES)[number]) ? n : 30
}

// Consumes the pre-existing hiveAnalytics() aggregator unchanged. It was written
// for this dashboard and shipped without one.
export default async function AdminHivePage({
  searchParams,
}: {
  searchParams: Promise<{ days?: string }>
}) {
  const days = parseDays((await searchParams).days)
  const hive = await hiveAnalytics(days)

  const { resolutions, handovers } = hive
  const resolvedTotal =
    resolutions.resolvedByAi + resolutions.resolvedByPeer + resolutions.resolvedByMentor
  const answered = resolvedTotal + resolutions.unresolved
  const aiShare = resolvedTotal ? Math.round((resolutions.resolvedByAi / resolvedTotal) * 100) : 0

  return (
    <>
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Hive</h1>
          <p className="text-muted-foreground text-sm">
            Did the AI carry its weight, or did a human have to?
          </p>
        </div>
        <RangePicker basePath="/admin/hive" current={days} options={[...RANGES]} />
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          label="Questions"
          value={fullNumber(hive.totals.questionsCreated)}
          hint={`${fullNumber(answered)} answered all time`}
        />
        <StatCard
          label="AI calls"
          value={fullNumber(hive.totals.aiCalls)}
          hint={`${compactNumber(hive.totals.totalTokens)} tokens`}
        />
        <StatCard
          label="AI failures"
          value={fullNumber(hive.totals.aiFailures)}
          hint="Includes failovers"
          tone="warning"
        />
        <StatCard
          label="Open escalations"
          value={fullNumber(handovers.openEscalations)}
          hint="Sitting with a mentor now"
          tone="warning"
        />
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Who resolved it</CardTitle>
            <CardDescription>
              The AI wrote the accepted answer on {percent(aiShare)} of resolved questions.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {resolvedTotal === 0 ? (
              <p className="text-muted-foreground py-4 text-center text-sm">Nothing resolved yet.</p>
            ) : (
              [
                { label: 'AI', value: resolutions.resolvedByAi },
                { label: 'Peer', value: resolutions.resolvedByPeer },
                { label: 'Mentor', value: resolutions.resolvedByMentor },
              ].map((row) => (
                <div key={row.label} className="space-y-1.5">
                  <div className="flex items-center justify-between text-sm">
                    <span className="font-medium">{row.label}</span>
                    <span className="text-muted-foreground tabular-nums">
                      {fullNumber(row.value)} ·{' '}
                      {percent(Math.round((row.value / resolvedTotal) * 100))}
                    </span>
                  </div>
                  <Progress value={(row.value / resolvedTotal) * 100} />
                </div>
              ))
            )}
            <p className="text-muted-foreground pt-2 text-xs">
              {fullNumber(resolutions.unresolved)} questions still unresolved.
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Hand-offs to humans</CardTitle>
            <CardDescription>
              A direct hand-off means the AI never got to try — a sensitive topic, an explicit
              request for a human, or every provider failing on the first attempt.
            </CardDescription>
          </CardHeader>
          <CardContent className="grid grid-cols-2 gap-4">
            <div>
              <div className="text-2xl font-semibold tabular-nums">
                {fullNumber(handovers.partialHandovers)}
              </div>
              <p className="text-muted-foreground text-xs">After the AI answered</p>
            </div>
            <div>
              <div className="text-2xl font-semibold tabular-nums">
                {fullNumber(handovers.directHandovers)}
              </div>
              <p className="text-muted-foreground text-xs">Without the AI trying</p>
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Providers</CardTitle>
            <CardDescription>
              A rescue is a call this provider picked up after another one failed.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Provider</TableHead>
                    <TableHead className="text-right">Calls</TableHead>
                    <TableHead className="text-right">Success</TableHead>
                    <TableHead className="text-right">Rescues</TableHead>
                    <TableHead className="text-right">Latency</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {hive.providers.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={5} className="text-muted-foreground text-center">
                        No provider calls in this window.
                      </TableCell>
                    </TableRow>
                  ) : (
                    hive.providers.map((p) => (
                      <TableRow key={p.provider}>
                        <TableCell className="font-medium capitalize">
                          {p.provider.toLowerCase()}
                        </TableCell>
                        <TableCell className="text-right tabular-nums">{fullNumber(p.calls)}</TableCell>
                        <TableCell className="text-right tabular-nums">
                          {percent(p.successRate)}
                        </TableCell>
                        <TableCell className="text-right tabular-nums">{fullNumber(p.rescues)}</TableCell>
                        <TableCell className="text-right tabular-nums">
                          {duration(p.avgLatencyMs)}
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Failures by kind</CardTitle>
          </CardHeader>
          <CardContent>
            {hive.errorsByKind.length === 0 ? (
              <p className="text-muted-foreground py-6 text-center text-sm">
                No failures in this window.
              </p>
            ) : (
              <div className="flex flex-wrap gap-2">
                {hive.errorsByKind.map((e) => (
                  <Badge key={e.errorKind} variant="secondary" className="font-normal">
                    {e.errorKind.replace(/_/g, ' ').toLowerCase()} · {fullNumber(e.count)}
                  </Badge>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Recent AI errors</CardTitle>
        </CardHeader>
        <CardContent>
          {hive.recentErrors.length === 0 ? (
            <p className="text-muted-foreground py-6 text-center text-sm">Nothing to report.</p>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>When</TableHead>
                    <TableHead>Provider</TableHead>
                    <TableHead>Task</TableHead>
                    <TableHead>Kind</TableHead>
                    <TableHead>Message</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {hive.recentErrors.map((e, i) => (
                    <TableRow key={`${e.createdAt}-${i}`}>
                      <TableCell className="whitespace-nowrap">{relativeTime(e.createdAt)}</TableCell>
                      <TableCell className="capitalize">{e.provider.toLowerCase()}</TableCell>
                      <TableCell className="lowercase">{e.task.replace(/_/g, ' ')}</TableCell>
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
