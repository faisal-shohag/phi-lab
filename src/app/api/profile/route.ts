import { requireUser } from '@/lib/auth-server'
import { errorResponse } from '@/lib/interview/errors'
import { prisma } from '@/lib/prisma'
import { getProfileInfo, parseProfileInput, ProfileInputError } from '@/lib/profile/info'

// GET the caller's own career/profile info (used to hydrate the edit dialog).
export async function GET() {
  const user = await requireUser()
  if (!user) return errorResponse('AUTH_REQUIRED')
  return Response.json(await getProfileInfo(user.id))
}

// PATCH the caller's own career/profile info. Every field is optional; the body
// is fully re-validated server-side so a client can never write an unsafe value.
export async function PATCH(request: Request) {
  const user = await requireUser()
  if (!user) return errorResponse('AUTH_REQUIRED')

  let data
  try {
    const body = await request.json()
    data = parseProfileInput(body)
  } catch (err) {
    if (err instanceof ProfileInputError) return errorResponse('SERVER_ERROR', err.message)
    return errorResponse('SERVER_ERROR', 'Invalid request body.')
  }

  await prisma.user.update({ where: { id: user.id }, data })
  return Response.json(await getProfileInfo(user.id))
}
