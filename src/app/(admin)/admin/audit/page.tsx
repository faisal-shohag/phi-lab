import Link from 'next/link'
import { listAudit } from '@/lib/admin/audit'
import { fullNumber, relativeTime } from '@/lib/admin/format'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'

const PAGE_SIZE = 50

const ACTION_LABEL: Record<string, string> = {
  'user.role.set': 'Role changed',
  'user.suspend': 'Account suspended',
  'user.unsuspend': 'Account reinstated',
  'setting.update': 'Setting updated',
}

/** Render a before/after JSON blob as `key: value` without dumping raw JSON. */
function summarize(value: unknown): string {
  if (value === null || value === undefined) return '—'
  if (typeof value !== 'object') return String(value)
  return Object.entries(value as Record<string, unknown>)
    .map(([k, v]) => `${k}: ${v === null ? 'none' : String(v)}`)
    .join(', ')
}

export default async function AdminAuditPage({
  searchParams,
}: {
  searchParams: Promise<{ page?: string }>
}) {
  const sp = await searchParams
  const page = Number(sp.page) > 0 ? Math.floor(Number(sp.page)) : 1
  const { rows, total, pages } = await listAudit({ page, take: PAGE_SIZE })

  return (
    <>
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Audit Log</h1>
        <p className="text-muted-foreground text-sm">
          Every privileged action, appended and never edited.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>{fullNumber(total)} entries</CardTitle>
          <CardDescription>Newest first.</CardDescription>
        </CardHeader>
        <CardContent>
          {rows.length === 0 ? (
            <p className="text-muted-foreground py-10 text-center text-sm">
              Nothing has been changed yet.
            </p>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>When</TableHead>
                    <TableHead>Admin</TableHead>
                    <TableHead>Action</TableHead>
                    <TableHead>Target</TableHead>
                    <TableHead>Before</TableHead>
                    <TableHead>After</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {rows.map((r) => (
                    <TableRow key={r.id}>
                      <TableCell
                        className="whitespace-nowrap text-xs"
                        title={r.createdAt.toISOString()}
                      >
                        {relativeTime(r.createdAt)}
                      </TableCell>
                      <TableCell className="text-xs">
                        {/* actorId has no FK so the trail outlives a deleted account. */}
                        {r.actorName ?? <span className="text-muted-foreground">deleted user</span>}
                      </TableCell>
                      <TableCell>
                        <Badge
                          variant={r.action === 'user.suspend' ? 'destructive' : 'secondary'}
                          className="font-normal"
                        >
                          {ACTION_LABEL[r.action] ?? r.action}
                        </Badge>
                      </TableCell>
                      <TableCell className="max-w-40 truncate font-mono text-xs">
                        {r.targetId ?? '—'}
                      </TableCell>
                      <TableCell className="text-muted-foreground max-w-48 truncate text-xs">
                        {summarize(r.before)}
                      </TableCell>
                      <TableCell className="max-w-48 truncate text-xs">{summarize(r.after)}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}

          {pages > 1 ? (
            <div className="flex items-center justify-between pt-4">
              <p className="text-muted-foreground text-sm">
                Page {page} of {pages}
              </p>
              <div className="flex gap-2">
                <Button variant="outline" size="sm" asChild disabled={page <= 1}>
                  <Link href={`/admin/audit?page=${Math.max(1, page - 1)}`}>Previous</Link>
                </Button>
                <Button variant="outline" size="sm" asChild disabled={page >= pages}>
                  <Link href={`/admin/audit?page=${Math.min(pages, page + 1)}`}>Next</Link>
                </Button>
              </div>
            </div>
          ) : null}
        </CardContent>
      </Card>
    </>
  )
}
