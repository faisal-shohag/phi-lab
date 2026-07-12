// The labs, from the operator's side: what has been used, and what is running now.
//
// A Server Component that calls the libs directly (no API round-trip), like every
// other admin page. The live section is a snapshot, refreshed on demand rather
// than polled — see RefreshButton for why — so the page stamps the time it was
// taken.
import Link from 'next/link'
import { labsUsage, liveLabSessions } from '@/lib/admin/labs'
import { dailyCaps } from '@/lib/admin/daily-caps'
import { getSettings } from '@/lib/admin/settings'
import { compactNumber, duration, fullNumber, percent, relativeTime } from '@/lib/admin/format'
import { LabsTrendChart } from '@/components/admin/labs-trend-chart'
import { RangePicker } from '@/components/admin/range-picker'
import { RefreshButton } from '@/components/admin/refresh-button'
import { ForceEndButton } from '@/components/admin/force-end-button'
import { StatCard } from '@/components/admin/stat-card'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Badge } from '@/components/ui/badge'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import { Info, Radio, Swords, Trophy, Lightbulb } from 'lucide-react'

const RANGES = [7, 30, 90] as const

function parseDays(value: string | undefined): number {
  const n = Number(value)
  return RANGES.includes(n as (typeof RANGES)[number]) ? n : 30
}

/** Which kill switch and daily cap govern each lab. JS Motion has neither. */
const CONTROLS: { lab: string; flag: string | null; cap: string | null }[] = [
  { lab: 'Interview', flag: 'flag.lab.interview.enabled', cap: 'Interview' },
  { lab: 'Feynman', flag: 'flag.lab.feynman.enabled', cap: 'Feynman' },
  { lab: 'English', flag: 'flag.lab.english.enabled', cap: 'English' },
  { lab: 'Support', flag: 'flag.lab.support.enabled', cap: null },
  { lab: 'Analogies', flag: 'flag.lab.analogies.enabled', cap: 'Analogies' },
  { lab: 'JS Motion', flag: null, cap: null },
]

export default async function LabsPage({
  searchParams,
}: {
  searchParams: Promise<{ days?: string }>
}) {
  // searchParams is async in this Next version.
  const days = parseDays((await searchParams).days)
  const [usage, live, caps, settings] = await Promise.all([
    labsUsage(days),
    liveLabSessions(),
    dailyCaps(),
    getSettings(),
  ])

  const takenAt = new Date()
  const inCall = live.filter((s) => !s.waiting).length
  const queued = live.filter((s) => s.waiting).length
  const staleCount = live.filter((s) => s.stale).length
  const totalSessions = usage.labs.reduce((n, l) => n + l.sessions, 0)
  const totalAbandoned = usage.labs.reduce((n, l) => n + l.abandoned, 0)

  return (
    <>
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Labs</h1>
          <p className="text-muted-foreground text-sm">
            How the labs are used, and what is running right now.
          </p>
        </div>
        <RangePicker basePath="/admin/labs" current={days} options={[...RANGES]} />
      </div>

      {/* ── Live now ─────────────────────────────────────────────────────── */}
      <Card>
        <CardHeader>
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <CardTitle className="flex items-center gap-2">
                <Radio className="size-4" />
                Live now
                <Tooltip>
                  <TooltipTrigger>
                    <Info className="text-muted-foreground size-3.5" />
                  </TooltipTrigger>
                  <TooltipContent className="max-w-72">
                    Sessions still running, capped at two hours old — past that a round is not a
                    learner, it is a row the cron sweep has not reaped yet. &quot;Stale&quot; means it
                    has outlived its own round length (Support: missed its heartbeat), so the tab is
                    almost certainly gone.
                  </TooltipContent>
                </Tooltip>
              </CardTitle>
              <CardDescription>
                {live.length === 0
                  ? 'Nothing running.'
                  : `${inCall} in a session${queued ? `, ${queued} queued` : ''}${staleCount ? ` · ${staleCount} stale` : ''}`}
                {' · as of '}
                {takenAt.toLocaleTimeString('en', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
              </CardDescription>
            </div>
            <RefreshButton />
          </div>
        </CardHeader>
        <CardContent>
          {live.length === 0 ? (
            <p className="text-muted-foreground py-6 text-center text-sm">
              No live sessions. Nothing to watch — that is the good outcome.
            </p>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Lab</TableHead>
                    <TableHead>Learner</TableHead>
                    <TableHead>Subject</TableHead>
                    <TableHead className="text-right">Elapsed</TableHead>
                    <TableHead>State</TableHead>
                    <TableHead className="text-right">Action</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {live.map((s) => (
                    <TableRow key={`${s.feature}-${s.id}`}>
                      <TableCell className="font-medium">{s.lab}</TableCell>
                      <TableCell>
                        <Link href={`/u/${s.userId}`} className="hover:underline">
                          {s.userName ?? s.userEmail ?? 'Unknown'}
                        </Link>
                      </TableCell>
                      <TableCell className="text-muted-foreground max-w-xs truncate text-sm">
                        {s.subject}
                      </TableCell>
                      <TableCell className="text-right tabular-nums">{duration(s.elapsedMs)}</TableCell>
                      <TableCell>
                        {s.waiting ? (
                          <Badge variant="outline" className="font-normal">
                            queued · #{s.queuePosition}
                          </Badge>
                        ) : (
                          <Badge variant="outline" className="font-normal">
                            in session
                          </Badge>
                        )}
                        {s.stale ? (
                          <Badge variant="destructive" className="ml-2 font-normal">
                            stale
                          </Badge>
                        ) : null}
                      </TableCell>
                      <TableCell className="text-right">
                        <ForceEndButton
                          sessionId={s.id}
                          feature={s.feature}
                          lab={s.lab}
                          learner={s.userName ?? s.userEmail ?? 'This learner'}
                          stale={s.stale}
                        />
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* ── Headline numbers ─────────────────────────────────────────────── */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label="Sessions" value={fullNumber(totalSessions)} hint={`Last ${days} days`} />
        <StatCard
          label="Abandoned"
          value={fullNumber(totalAbandoned)}
          hint={`${percent(totalSessions ? Math.round((totalAbandoned / totalSessions) * 100) : 0)} of all sessions`}
          tone="warning"
        />
        <StatCard label="Live now" value={fullNumber(live.length)} hint={`${staleCount} stale`} icon={Radio} />
        <StatCard
          label="Challenges"
          value={fullNumber(usage.challenges.attempts)}
          hint={`${percent(usage.challenges.winRate)} won`}
          icon={Swords}
        />
      </div>

      {/* ── Per-lab usage ────────────────────────────────────────────────── */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            By lab
            <Tooltip>
              <TooltipTrigger>
                <Info className="text-muted-foreground size-3.5" />
              </TooltipTrigger>
              <TooltipContent className="max-w-72">
                Every status, not just the happy ones. Duration is the mean wall-clock of a COMPLETED
                round — abandoned rounds are excluded, since their &quot;length&quot; is just how long
                a dead tab sat open. Analogies are one-shot, so they have no duration or score.
              </TooltipContent>
            </Tooltip>
          </CardTitle>
          <CardDescription>Sessions started in the last {days} days.</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Lab</TableHead>
                  <TableHead className="text-right">Sessions</TableHead>
                  <TableHead className="text-right">Completed</TableHead>
                  <TableHead className="text-right">Abandoned</TableHead>
                  <TableHead className="text-right">Failed</TableHead>
                  <TableHead className="text-right">Live</TableHead>
                  <TableHead className="text-right">Completion</TableHead>
                  <TableHead className="text-right">Avg score</TableHead>
                  <TableHead className="text-right">Avg length</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {usage.labs.map((l) => (
                  <TableRow key={l.lab}>
                    <TableCell className="font-medium">{l.lab}</TableCell>
                    <TableCell className="text-right tabular-nums">{fullNumber(l.sessions)}</TableCell>
                    <TableCell className="text-right tabular-nums">{fullNumber(l.completed)}</TableCell>
                    <TableCell className="text-right tabular-nums">
                      {l.abandoned ? (
                        <span className="text-destructive">
                          {fullNumber(l.abandoned)}{' '}
                          <span className="text-muted-foreground text-xs">({percent(l.abandonRate)})</span>
                        </span>
                      ) : (
                        '0'
                      )}
                    </TableCell>
                    <TableCell className="text-right tabular-nums">
                      {l.failed ? <span className="text-destructive">{fullNumber(l.failed)}</span> : '0'}
                    </TableCell>
                    <TableCell className="text-right tabular-nums">
                      {l.inProgress ? fullNumber(l.inProgress) : '—'}
                    </TableCell>
                    <TableCell className="text-right tabular-nums">{percent(l.completionRate)}</TableCell>
                    <TableCell className="text-right tabular-nums">
                      {l.avgScore === null ? '—' : l.avgScore}
                    </TableCell>
                    <TableCell className="text-right tabular-nums">
                      {l.avgDurationMs === null ? '—' : duration(l.avgDurationMs)}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      <LabsTrendChart trend={usage.trend} />

      {/* ── JS Motion + controls ─────────────────────────────────────────── */}
      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Swords className="size-4" />
              JS Motion challenges
            </CardTitle>
            <CardDescription>
              {fullNumber(usage.challenges.attempts)} attempts · {fullNumber(usage.challenges.active)}{' '}
              still open
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-3 gap-3 text-sm">
              <div>
                <p className="text-muted-foreground text-xs">Won</p>
                <p className="text-lg font-semibold tabular-nums">{fullNumber(usage.challenges.won)}</p>
              </div>
              <div>
                <p className="text-muted-foreground text-xs">Lost</p>
                <p className="text-lg font-semibold tabular-nums">{fullNumber(usage.challenges.lost)}</p>
              </div>
              <div>
                <p className="text-muted-foreground text-xs">Win rate</p>
                <p className="text-lg font-semibold tabular-nums">{percent(usage.challenges.winRate)}</p>
              </div>
              <div>
                <p className="text-muted-foreground flex items-center gap-1 text-xs">
                  <Trophy className="size-3" /> XP staked
                </p>
                <p className="tabular-nums">{compactNumber(usage.challenges.xpStaked)}</p>
              </div>
              <div>
                <p className="text-muted-foreground text-xs">XP won</p>
                <p className="tabular-nums">{compactNumber(usage.challenges.xpWon)}</p>
              </div>
              <div>
                <p className="text-muted-foreground flex items-center gap-1 text-xs">
                  <Lightbulb className="size-3" /> Hints used
                </p>
                <p className="tabular-nums">{fullNumber(usage.challenges.hintsUsed)}</p>
              </div>
            </div>

            {usage.challenges.byDifficulty.length === 0 ? (
              <p className="text-muted-foreground text-sm">No challenges in this window.</p>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Difficulty</TableHead>
                    <TableHead className="text-right">Attempts</TableHead>
                    <TableHead className="text-right">Won</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {usage.challenges.byDifficulty.map((d) => (
                    <TableRow key={d.difficulty}>
                      <TableCell className="font-medium capitalize">{d.difficulty}</TableCell>
                      <TableCell className="text-right tabular-nums">{fullNumber(d.attempts)}</TableCell>
                      <TableCell className="text-right tabular-nums">{fullNumber(d.won)}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Controls</CardTitle>
            <CardDescription>
              Kill switches and daily caps, set in{' '}
              <Link href="/admin/settings" className="underline underline-offset-4">
                Settings
              </Link>
              .
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Lab</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Cap / user / day</TableHead>
                    <TableHead className="text-right">Today</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {CONTROLS.map((c) => {
                    const cap = caps.find((x) => x.feature === c.cap)
                    const enabled = c.flag
                      ? (settings[c.flag as keyof typeof settings] as boolean)
                      : null
                    return (
                      <TableRow key={c.lab}>
                        <TableCell className="font-medium">{c.lab}</TableCell>
                        <TableCell>
                          {enabled === null ? (
                            // Stated plainly rather than shown as "on": JS Motion has no
                            // kill switch at all, and pretending otherwise would be a lie
                            // an operator might act on in an incident.
                            <span className="text-muted-foreground text-xs">no kill switch</span>
                          ) : enabled ? (
                            <Badge variant="outline" className="font-normal">
                              enabled
                            </Badge>
                          ) : (
                            <Badge variant="destructive" className="font-normal">
                              disabled
                            </Badge>
                          )}
                        </TableCell>
                        <TableCell className="text-right tabular-nums">
                          {cap ? fullNumber(cap.cap) : '—'}
                        </TableCell>
                        <TableCell className="text-right tabular-nums">
                          {cap?.usedToday != null ? fullNumber(cap.usedToday) : '—'}
                        </TableCell>
                      </TableRow>
                    )
                  })}
                </TableBody>
              </Table>
            </div>
            <p className="text-muted-foreground mt-3 text-xs">
              Support has no daily limit — it is bounded by{' '}
              {fullNumber(settings['lab.support.maxActiveSessions'])} concurrent slots instead.
            </p>
          </CardContent>
        </Card>
      </div>

      <p className="text-muted-foreground text-xs">
        Window opened {relativeTime(usage.since)}.
      </p>
    </>
  )
}
