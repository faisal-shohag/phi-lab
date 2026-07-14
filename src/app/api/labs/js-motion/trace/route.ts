// Experimental: produce a visualization trace by running the user's program on
// the REAL JS engine (QuickJS-wasm) instead of the teaching interpreter, so the
// full JS language works. Flag-gated on the client; the legacy interpreter stays
// the default. Grading is unaffected (separate path).
//
// The code runs in a hard sandbox (no host access) with a wall-clock + memory
// cap, so this is safe to expose to guests. We still bound the input size.

import { traceQjs } from '@/lib/visualizer/trace-qjs'

export const runtime = 'nodejs'

const MAX_CODE = 50_000

export async function POST(request: Request) {
  let code = ''
  try {
    const body = await request.json()
    if (typeof body?.code === 'string') code = body.code
  } catch {
    return Response.json({ error: 'Invalid JSON body.' }, { status: 400 })
  }
  if (!code) return Response.json({ error: 'Missing code.' }, { status: 400 })
  if (code.length > MAX_CODE) return Response.json({ error: 'Program too large.' }, { status: 413 })

  const { trace, error } = await traceQjs(code)
  return Response.json({ trace, error })
}
