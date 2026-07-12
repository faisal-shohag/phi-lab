import { aiUsageSummary, type KeySlice } from '@/lib/admin/ai-usage'
import { keyLimits } from '@/lib/admin/provider-limits'
import { dailyCaps } from '@/lib/admin/daily-caps'
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

/**
 * Per-key burn for one lane. Live and text get their own table rather than one
 * merged one: a live "call" is a whole voice round with browser-reported tokens,
 * a text call is a single request the server watched itself. Same key, two very
 * different units.
 */
function KeyUsageTable({ keys, lane }: { keys: KeySlice[]; lane: 'live' | 'text' }) {
  if (keys.length === 0) {
    return (
      <p className="text-muted-foreground py-6 text-center text-sm">
        No {lane === 'live' ? 'live voice rounds' : 'text calls'} in this window.
      </p>
    )
  }
  return (
    <div className="overflow-x-auto">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Key</TableHead>
            <TableHead className="text-right">{lane === 'live' ? 'Rounds' : 'Calls'}</TableHead>
            <TableHead className="text-right">Failed</TableHead>
            <TableHead className="text-right">{lane === 'live' ? 'Minutes' : 'Tokens'}</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {keys.map((k) => (
            <TableRow key={`${k.provider}-${k.keyId ?? 'unattributed'}`}>
              <TableCell className="font-mono text-xs">
                {k.keyId ?? <span className="text-muted-foreground italic">unattributed</span>}
                <Badge variant="outline" className="ml-2 font-normal capitalize">
                  {k.provider.toLowerCase()}
                </Badge>
              </TableCell>
              <TableCell className="text-right tabular-nums">{fullNumber(k.calls)}</TableCell>
              <TableCell className="text-right tabular-nums">
                {k.failures ? <span className="text-destructive">{fullNumber(k.failures)}</span> : '0'}
              </TableCell>
              <TableCell className="text-right tabular-nums">
                {lane === 'live' ? fullNumber(k.liveMinutes) : compactNumber(k.totalTokens)}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  )
}

export default async function AiUsagePage({
  searchParams,
}: {
  searchParams: Promise<{ days?: string }>
}) {
  // searchParams is async in this Next version.
  const days = parseDays((await searchParams).days)
  const [usage, limits, caps] = await Promise.all([
    aiUsageSummary(days),
    keyLimits(),
    dailyCaps(),
  ])

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

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              Text &amp; evaluation keys
              <Tooltip>
                <TooltipTrigger>
                  <Info className="text-muted-foreground size-3.5" />
                </TooltipTrigger>
                <TooltipContent className="max-w-72">
                  Everything except live voice: Hive answers, the JS Motion tutor, and the lab report
                  graders. These rotate across every key of every provider, so an even spread here is
                  the rotation working.
                </TooltipContent>
              </Tooltip>
            </CardTitle>
            <CardDescription>Which key served each structured-generation call.</CardDescription>
          </CardHeader>
          <CardContent>
            <KeyUsageTable keys={usage.textKeys} lane="text" />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              Live voice keys
              <Tooltip>
                <TooltipTrigger>
                  <Info className="text-muted-foreground size-3.5" />
                </TooltipTrigger>
                <TooltipContent className="max-w-72">
                  Gemini Live rounds only, counted separately: one &quot;round&quot; is a whole
                  conversation, and its tokens are reported by the browser rather than observed here.
                  The key is the one that minted the round&apos;s ephemeral token.
                </TooltipContent>
              </Tooltip>
            </CardTitle>
            <CardDescription>Which key minted each voice round&apos;s token.</CardDescription>
          </CardHeader>
          <CardContent>
            <KeyUsageTable keys={usage.liveKeys} lane="live" />
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              Key health
              <Tooltip>
                <TooltipTrigger>
                  <Info className="text-muted-foreground size-3.5" />
                </TooltipTrigger>
                <TooltipContent className="max-w-72">
                  Live rate-limit state per key, not windowed by the range above. Keys are discovered
                  from the environment by name, so a new one appears here as soon as it is deployed.
                  Only Groq reports a remaining-requests count; Gemini and Ollama send no such header.
                  Every value is last-observed — it moves only when the key is used or rate limited.
                </TooltipContent>
              </Tooltip>
            </CardTitle>
            <CardDescription>Every API key the environment offers, and its state.</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Key</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Remaining</TableHead>
                    <TableHead className="text-right">Updated</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {limits.map((k) => (
                    <TableRow key={k.keyId}>
                      <TableCell className="font-mono text-xs">
                        {k.keyId}
                        <Badge variant="outline" className="ml-2 font-normal capitalize">
                          {k.provider}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        {k.parked ? (
                          <Badge variant="destructive" className="font-normal">
                            parked ({k.providerParked ? 'provider' : 'key'})
                          </Badge>
                        ) : k.cooldownMsLeft > 0 ? (
                          <Badge variant="destructive" className="font-normal">
                            cooling down · {duration(k.cooldownMsLeft)}
                          </Badge>
                        ) : k.updatedAt === null ? (
                          <span className="text-muted-foreground text-xs">never used</span>
                        ) : (
                          <Badge variant="outline" className="font-normal">
                            available
                          </Badge>
                        )}
                        {k.lastError ? (
                          <span className="text-muted-foreground ml-2 text-xs">{k.lastError}</span>
                        ) : null}
                      </TableCell>
                      <TableCell className="text-right tabular-nums">
                        {k.reportsRemaining
                          ? k.remaining !== null
                            ? fullNumber(k.remaining)
                            : '—'
                          : 'n/a'}
                      </TableCell>
                      <TableCell className="text-muted-foreground text-right whitespace-nowrap text-xs">
                        {k.updatedAt ? relativeTime(k.updatedAt) : 'never'}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              Daily caps
              <Tooltip>
                <TooltipTrigger>
                  <Info className="text-muted-foreground size-3.5" />
                </TooltipTrigger>
                <TooltipContent className="max-w-72">
                  Caps are per user per UTC day, set in Settings. &quot;Today&quot; is sessions started
                  across all users since 00:00 UTC. Hive coach is throttled by an in-memory
                  per-instance bucket, so it has no reliable platform count.
                </TooltipContent>
              </Tooltip>
            </CardTitle>
            <CardDescription>Per-user daily limits and today&apos;s platform load.</CardDescription>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Feature</TableHead>
                  <TableHead className="text-right">Cap / user / day</TableHead>
                  <TableHead className="text-right">Today (all users)</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {caps.map((c) => (
                  <TableRow key={c.feature}>
                    <TableCell className="font-medium">{c.feature}</TableCell>
                    <TableCell className="text-right tabular-nums">{fullNumber(c.cap)}</TableCell>
                    <TableCell className="text-right tabular-nums">
                      {c.usedToday !== null ? fullNumber(c.usedToday) : '—'}
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
