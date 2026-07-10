import Link from 'next/link'
import { requireAdmin } from '@/lib/hive/roles'
import { listUsers } from '@/lib/admin/users'
import { fullNumber, relativeTime } from '@/lib/admin/format'
import { UserRowActions } from '@/components/admin/user-row-actions'
import { UserFilters } from '@/components/admin/user-filters'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import type { Role } from '@/generated/prisma/client'

const ROLES: Role[] = ['STUDENT', 'MENTOR', 'ADMIN']
const PAGE_SIZE = 25

// Server-paginated through searchParams rather than a client cursor: admin lists
// have stable ordering, need a total count, and benefit from a shareable URL.
// (The public Hive feed uses cursors because it is an infinite feed.)
export default async function AdminUsersPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; role?: string; page?: string }>
}) {
  const sp = await searchParams
  // The layout already gated this, so requireAdmin cannot fail here — we call it
  // for the actor id, which the row actions need to disable self-actions.
  const { user: actor } = await requireAdmin()

  const page = Number(sp.page) > 0 ? Math.floor(Number(sp.page)) : 1
  const role = sp.role && ROLES.includes(sp.role as Role) ? (sp.role as Role) : undefined

  const { rows, total, pages } = await listUsers({ q: sp.q, role, page, take: PAGE_SIZE })

  const pageHref = (n: number) => {
    const params = new URLSearchParams()
    if (sp.q) params.set('q', sp.q)
    if (role) params.set('role', role)
    params.set('page', String(n))
    return `/admin/users?${params}`
  }

  return (
    <>
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Users</h1>
        <p className="text-muted-foreground text-sm">Manage roles, access and suspension.</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>{fullNumber(total)} users</CardTitle>
          <CardDescription>
            Changing a role or suspending an account is recorded in the audit log.
          </CardDescription>
          <div className="pt-2">
            <UserFilters initialQuery={sp.q ?? ''} initialRole={role ?? 'ALL'} />
          </div>
        </CardHeader>
        <CardContent>
          {rows.length === 0 ? (
            <p className="text-muted-foreground py-10 text-center text-sm">
              No users match those filters.
            </p>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>User</TableHead>
                    <TableHead>Role</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">XP</TableHead>
                    <TableHead>Joined</TableHead>
                    <TableHead className="w-12" />
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {rows.map((u) => (
                    <TableRow key={u.id}>
                      <TableCell>
                        <div className="flex items-center gap-3">
                          <Avatar className="size-8">
                            {u.image ? <AvatarImage src={u.image} alt={u.name} /> : null}
                            <AvatarFallback>{u.name.slice(0, 2).toUpperCase()}</AvatarFallback>
                          </Avatar>
                          <div className="min-w-0">
                            <div className="truncate font-medium">{u.name}</div>
                            <div className="text-muted-foreground truncate text-xs">{u.email}</div>
                          </div>
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge
                          variant={u.role === 'ADMIN' ? 'default' : u.role === 'MENTOR' ? 'secondary' : 'outline'}
                          className="capitalize"
                        >
                          {u.role.toLowerCase()}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        {u.suspendedAt ? (
                          <Badge variant="destructive" className="font-normal" title={u.suspendedReason ?? ''}>
                            suspended
                          </Badge>
                        ) : (
                          <span className="text-muted-foreground text-xs">active</span>
                        )}
                      </TableCell>
                      <TableCell className="text-right tabular-nums">{fullNumber(u.xp)}</TableCell>
                      <TableCell className="text-muted-foreground whitespace-nowrap text-xs">
                        {relativeTime(u.createdAt)}
                      </TableCell>
                      <TableCell>
                        <UserRowActions
                          actorId={actor?.id ?? ''}
                          user={{
                            id: u.id,
                            name: u.name,
                            role: u.role,
                            suspendedAt: u.suspendedAt ? u.suspendedAt.toISOString() : null,
                          }}
                        />
                      </TableCell>
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
                  <Link href={pageHref(Math.max(1, page - 1))}>Previous</Link>
                </Button>
                <Button variant="outline" size="sm" asChild disabled={page >= pages}>
                  <Link href={pageHref(Math.min(pages, page + 1))}>Next</Link>
                </Button>
              </div>
            </div>
          ) : null}
        </CardContent>
      </Card>
    </>
  )
}
