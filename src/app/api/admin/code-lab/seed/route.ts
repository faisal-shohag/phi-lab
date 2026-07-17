import { withAdmin } from '@/lib/admin/guard'
import { seedDemoProblems } from '@/lib/code-lab/admin'

// Idempotent: upserts the demo problem set by slug. Safe to run repeatedly.
export async function POST() {
  return withAdmin(async (actor) => {
    const count = await seedDemoProblems(actor.id)
    return Response.json({ seeded: count })
  })
}
