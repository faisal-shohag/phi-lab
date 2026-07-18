import type { NextRequest } from 'next/server'
import { requireUser } from '@/lib/auth-server'
import { hiveError } from '@/lib/hive/errors'
import { contestStandingsBySlug } from '@/lib/code-lab/contests'

export const runtime = 'nodejs'

export async function GET(_req: NextRequest, { params }: { params: Promise<{ slug: string }> }) {
  const user = await requireUser()
  if (!user) return hiveError('AUTH_REQUIRED')
  const { slug } = await params
  const standings = await contestStandingsBySlug(slug, user.id)
  if (!standings) return hiveError('NOT_FOUND', 'Contest not found.')
  return Response.json(standings)
}
