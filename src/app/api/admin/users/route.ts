// GET /api/admin/users?q=&role=&page=
//
// The /admin/users page renders server-side and calls listUsers() directly; this
// route exists for client-side refreshes after a mutation.
import { withAdmin } from '@/lib/admin/guard'
import { listUsers } from '@/lib/admin/users'
import type { Role } from '@/generated/prisma/client'

const ROLES: Role[] = ['STUDENT', 'MENTOR', 'ADMIN']

export async function GET(request: Request) {
  return withAdmin(async () => {
    const params = new URL(request.url).searchParams
    const roleParam = params.get('role')
    const page = Number(params.get('page'))

    return Response.json(
      await listUsers({
        q: params.get('q') ?? undefined,
        role: roleParam && ROLES.includes(roleParam as Role) ? (roleParam as Role) : undefined,
        page: Number.isFinite(page) && page > 0 ? Math.floor(page) : 1,
      }),
    )
  })
}
