// GET /api/admin/audit?page=
import { withAdmin } from '@/lib/admin/guard'
import { listAudit } from '@/lib/admin/audit'

export async function GET(request: Request) {
  return withAdmin(async () => {
    const page = Number(new URL(request.url).searchParams.get('page'))
    return Response.json(await listAudit({ page: Number.isFinite(page) && page > 0 ? Math.floor(page) : 1 }))
  })
}
