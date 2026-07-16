// Pixel Lab's preferences.
//
// Deliberately tiny and deliberately *not* lib/visualizer/settings.ts, which is
// a 20-key feature-flag system for a step debugger with a group taxonomy and an
// everything-off-by-default posture. This is three switches about furniture.
//
// **Every default is the behaviour that already shipped.** A settings menu that
// changes what happens the moment it lands is a settings menu that broke the
// product for everyone who never opens it.

const STORAGE_KEY = 'pixel-lab:settings'

export interface PixelSettings {
  /** Open the board when the lab loads. Currently: yes. */
  mapOnLand: boolean
  /** Keep the mini-map in the corner. Currently: yes. */
  miniMap: boolean
  /** One-shot sound effects. Currently: yes (see sound.ts for why on). */
  sound: boolean
}

export const DEFAULT_SETTINGS: PixelSettings = {
  mapOnLand: true,
  miniMap: true,
  sound: true,
}

export const SETTING_LABEL: Record<keyof PixelSettings, { title: string; hint: string }> = {
  mapOnLand: { title: 'Open the run when I arrive', hint: 'The board greets you every visit.' },
  miniMap: { title: 'Mini-map in the corner', hint: 'The run at a glance while you work.' },
  sound: { title: 'Sound effects', hint: 'A sting when you score, another when something unlocks.' },
}

let cache: PixelSettings | null = null
const listeners = new Set<() => void>()

function read(): PixelSettings {
  if (typeof window === 'undefined') return DEFAULT_SETTINGS
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY)
    if (!raw) return DEFAULT_SETTINGS
    const parsed = JSON.parse(raw) as unknown
    if (!parsed || typeof parsed !== 'object') return DEFAULT_SETTINGS
    // Spread over the defaults rather than trusting the stored shape: a setting
    // added later must not read as `undefined` for everyone who saved before it
    // existed.
    return { ...DEFAULT_SETTINGS, ...(parsed as Partial<PixelSettings>) }
  } catch {
    return DEFAULT_SETTINGS
  }
}

/** Stable snapshot — useSyncExternalStore compares by reference and will loop otherwise. */
export function getSettings(): PixelSettings {
  cache ??= read()
  return cache
}

export function setSetting<K extends keyof PixelSettings>(key: K, value: PixelSettings[K]): void {
  const next = { ...getSettings(), [key]: value }
  cache = next
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(next))
  } catch {
    // Private mode. The toggle still works for this session.
  }
  for (const listener of listeners) listener()
}

export function subscribeSettings(listener: () => void): () => void {
  listeners.add(listener)
  return () => listeners.delete(listener)
}

/** Server snapshot for useSyncExternalStore. Must be referentially stable. */
export function getServerSettings(): PixelSettings {
  return DEFAULT_SETTINGS
}
