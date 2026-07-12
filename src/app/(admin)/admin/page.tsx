import Link from 'next/link'
import { Activity, AlertTriangle, Coins, LifeBuoy, Sparkles, Users } from 'lucide-react'
import { aiUsageSummary } from '@/lib/admin/ai-usage'
import { platformMetrics } from '@/lib/admin/metrics'
import { compactNumber, duration, fullNumber, percent } from '@/lib/admin/format'
import { StatCard } from '@/components/admin/stat-card'
import { UsageTrendChart } from '@/components/admin/usage-trend-chart'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Badge } from '@/components/ui/badge'

// Server Component: the admin layout already gated on requireAdmin(), so the
// lib functions are called directly rather than through an API round-trip.
export default async function AdminOverviewPage() {
  const [usage, metrics] = await Promise.all([aiUsageSummary(30), platformMetrics(30)])

  const failureRate = usage.totals.calls
    ? Math.round((usage.totals.failures / usage.totals.calls) * 100)
    : 0

  return (
    <>
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Overview</h1>
        <p className="text-muted-foreground text-sm">Last 30 days across every feature.</p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          label="Users"
          value={fullNumber(metrics.users.total)}
          hint={`${metrics.users.newInWindow} new · ${metrics.users.suspended} suspended`}
          icon={Users}
        />
        <StatCard
          label="Active"
          value={fullNumber(metrics.active.daily)}
          hint={`${fullNumber(metrics.active.weekly)} in the last 7 days`}
          icon={Activity}
        />
        <StatCard
          label="AI calls"
          value={compactNumber(usage.totals.calls)}
          hint={`${duration(usage.totals.avgLatencyMs)} average latency`}
          icon={Sparkles}
        />
        <StatCard
          label="Tokens"
          value={compactNumber(usage.totals.totalTokens)}
          hint={`${compactNumber(usage.totals.trustedTokens)} server-observed`}
          icon={Coins}
        />
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          label="AI failures"
          value={fullNumber(usage.totals.failures)}
          hint={`${percent(failureRate)} of all calls`}
          icon={AlertTriangle}
          tone="warning"
        />
        <StatCard
          label="Open escalations"
          value={fullNumber(metrics.hive.openEscalations)}
          hint={`${metrics.hive.questions} questions in window`}
          icon={LifeBuoy}
          tone="warning"
        />
        <StatCard
          label="Support queue"
          value={fullNumber(metrics.support.queueDepth)}
          hint={`${metrics.support.activeNow} in a live session`}
        />
        <StatCard
          label="Support rating"
          value={metrics.support.avgRating ? `${metrics.support.avgRating} / 5` : '—'}
          hint="Learner-reported, all time"
        />
      </div>

      <UsageTrendChart trend={usage.trend} />

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>AI usage by feature</CardTitle>
            <CardDescription>Calls, reliability and token spend.</CardDescription>
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
                      <TableHead className="text-right">Success</TableHead>
                      <TableHead className="text-right">Tokens</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {usage.features.map((f) => (
                      <TableRow key={f.feature}>
                        <TableCell className="font-medium capitalize">{f.feature.toLowerCase()}</TableCell>
                        <TableCell className="text-right tabular-nums">{fullNumber(f.calls)}</TableCell>
                        <TableCell className="text-right tabular-nums">{percent(f.successRate)}</TableCell>
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

        <Card>
          <CardHeader>
            <CardTitle>
              <Link href="/admin/labs" className="hover:underline underline-offset-4">
                Lab engagement
              </Link>
            </CardTitle>
            <CardDescription>
              Sessions started and how many finished.{' '}
              <Link href="/admin/labs" className="underline underline-offset-4">
                Full breakdown
              </Link>{' '}
              — abandonment, scores, live sessions.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Lab</TableHead>
                    <TableHead className="text-right">Sessions</TableHead>
                    <TableHead className="text-right">Completed</TableHead>
                    <TableHead className="text-right">Rate</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {metrics.labs.map((l) => (
                    <TableRow key={l.lab}>
                      <TableCell className="font-medium">{l.lab}</TableCell>
                      <TableCell className="text-right tabular-nums">{fullNumber(l.sessions)}</TableCell>
                      <TableCell className="text-right tabular-nums">{fullNumber(l.completed)}</TableCell>
                      <TableCell className="text-right tabular-nums">
                        {l.sessions ? percent(l.completionRate) : '—'}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Roles</CardTitle>
          <CardDescription>Who can do what on the platform.</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-wrap gap-2">
          {metrics.users.byRole.map((r) => (
            <Badge key={r.role} variant={r.role === 'ADMIN' ? 'default' : 'secondary'}>
              {r.role.toLowerCase()} · {fullNumber(r.count)}
            </Badge>
          ))}
        </CardContent>
      </Card>
    </>
  )
}
