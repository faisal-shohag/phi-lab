// Runtime resolution of the admin-tunable knobs. Server-only.
//
// Every value falls back to SETTING_DEFAULTS, so an empty `admin_setting` table
// behaves exactly like the hardcoded constants these replaced. Only overrides
// are stored — we never seed the table.
//
// Cached because the lab token routes read these on every mint, and a Prisma
// round-trip per mint is pure waste for values that change once a month. The
// cache is per-instance and TTL'd, in the same spirit as the in-memory counters
// in src/lib/hive/rate-limit.ts: a second serverless instance can serve a stale
// value for up to CACHE_TTL_MS after a write. That is an acceptable trade for a
// round length; it would not be for anything security-bearing, which is why
// suspension is a direct DB read and not a setting.
import { prisma } from '@/lib/prisma'
import { writeAudit } from './audit'
import { AdminActionError } from './errors'
import {
  SETTING_DEFAULTS,
  coerceSetting,
  type SettingKey,
  type Settings,
} from './settings-defaults'

const CACHE_TTL_MS = 30_000

let cache: { at: number; values: Settings } | null = null

/** Drop the cache so the next read hits the database. */
export function invalidateSettingsCache(): void {
  cache = null
}

async function load(): Promise<Settings> {
  if (cache && Date.now() - cache.at < CACHE_TTL_MS) return cache.values

  const values = { ...SETTING_DEFAULTS } as Settings
  try {
    const rows = await prisma.adminSetting.findMany()
    for (const row of rows) {
      // A key that no longer exists in code (renamed knob, stale row) is ignored
      // rather than trusted — code owns the key list.
      if (!(row.key in SETTING_DEFAULTS)) continue
      const key = row.key as SettingKey
      const coerced = coerceSetting(key, row.value)
      if (coerced !== null) (values as Record<string, unknown>)[key] = coerced
    }
    cache = { at: Date.now(), values }
  } catch {
    // A settings-table outage must not take the labs down. Serve the defaults
    // and don't cache the failure.
  }
  return values
}

export async function getSettings(): Promise<Settings> {
  return load()
}

export async function getSetting<K extends SettingKey>(key: K): Promise<Settings[K]> {
  const values = await load()
  return values[key]
}

/**
 * Persist one override and record who did it. Rejects a value that can't be
 * coerced to the type its default declares. Busts the in-process cache.
 */
export async function setSetting(key: SettingKey, value: unknown, actorId: string): Promise<void> {
  const coerced = coerceSetting(key, value)
  if (coerced === null) {
    throw new AdminActionError(`Invalid value for ${key}.`, 'VALIDATION')
  }

  const before = await getSetting(key)
  if (before === coerced) return

  await prisma.adminSetting.upsert({
    where: { key },
    create: { key, value: coerced, updatedBy: actorId },
    update: { value: coerced, updatedBy: actorId },
  })

  await writeAudit({
    actorId,
    action: 'setting.update',
    targetType: 'setting',
    targetId: key,
    before: { [key]: before },
    after: { [key]: coerced },
  })

  invalidateSettingsCache()
}
