// GET /api/labs/round-lengths — the current admin-configured round/session
// lengths, in seconds, for the four live-voice labs.
//
// Public and unauthenticated on purpose: the setup screens show "one 3-minute
// round" copy before a session exists (and before any token is minted), so
// there is nothing to gate this behind. Deliberately narrow — it returns only
// what the UI displays, not the daily limits or kill switches that the rest of
// /api/admin/settings exposes to admins only.
//
// Backed by the same cached resolver the token routes use (getSettings(), ~30s
// in-process TTL), so this never adds a fresh DB round-trip on top of that.
import { getSettings } from '@/lib/admin/settings'

export async function GET() {
  const settings = await getSettings()
  return Response.json({
    interview: settings['lab.interview.roundSeconds'],
    feynman: settings['lab.feynman.roundSeconds'],
    english: settings['lab.english.roundSeconds'],
    support: settings['lab.support.roundSeconds'],
  })
}
