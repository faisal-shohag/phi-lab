// GET /api/admin/settings        -> the resolved settings (defaults + overrides)
// PUT /api/admin/settings  { updates: { key: value, ... } }
//
// Each write is coerced and clamped against SETTING_BOUNDS and audited
// individually, so the log says which knob moved rather than "settings changed".
import { withAdmin } from '@/lib/admin/guard'
import { getSettings, setSetting } from '@/lib/admin/settings'
import { SETTING_DEFAULTS, type SettingKey } from '@/lib/admin/settings-defaults'
import { hiveError } from '@/lib/hive/errors'

export async function GET() {
  return withAdmin(async () => Response.json(await getSettings()))
}

export async function PUT(request: Request) {
  return withAdmin(async (actor) => {
    let updates: unknown
    try {
      updates = (await request.json())?.updates
    } catch {
      return hiveError('VALIDATION', 'Invalid JSON body.')
    }

    if (!updates || typeof updates !== 'object' || Array.isArray(updates)) {
      return hiveError('VALIDATION', 'Expected an `updates` object.')
    }

    const entries = Object.entries(updates as Record<string, unknown>)
    const unknownKeys = entries.filter(([key]) => !(key in SETTING_DEFAULTS)).map(([key]) => key)
    if (unknownKeys.length) {
      return hiveError('VALIDATION', `Unknown setting(s): ${unknownKeys.join(', ')}.`)
    }

    // Sequential rather than Promise.all: each setSetting reads the current
    // value to write a before/after audit pair, and racing them would interleave
    // those reads.
    for (const [key, value] of entries) {
      await setSetting(key as SettingKey, value, actor.id)
    }

    return Response.json(await getSettings())
  })
}
