'use client'

// Code Lab editor preferences, persisted to localStorage. Same store shape as
// pixel/settings.ts: a referentially-stable snapshot for useSyncExternalStore,
// spread over defaults so a setting added later doesn't read as undefined for
// people who saved before it existed.

const STORAGE_KEY = 'code-lab:editor-settings'

/** Coding fonts loaded via next/font in the code-lab layout. `value` is the CSS
 * font-family Monaco receives; keep in sync with layout.tsx variables. */
export const CODING_FONTS = [
  { label: 'JetBrains Mono', value: 'var(--font-jetbrains-mono), monospace' },
  { label: 'Fira Code', value: 'var(--font-fira-code), monospace' },
  { label: 'Source Code Pro', value: 'var(--font-source-code-pro), monospace' },
  { label: 'IBM Plex Mono', value: 'var(--font-ibm-plex-mono), monospace' },
  { label: 'System monospace', value: 'ui-monospace, SFMono-Regular, Menlo, monospace' },
] as const

export interface EditorSettings {
  fontFamily: string
  fontSize: number
  fontLigatures: boolean
  tabSize: number
  minimap: boolean
  wordWrap: boolean
}

export const DEFAULT_EDITOR_SETTINGS: EditorSettings = {
  fontFamily: CODING_FONTS[0].value,
  fontSize: 14,
  fontLigatures: true,
  tabSize: 2,
  minimap: false,
  wordWrap: false,
}

let cache: EditorSettings | null = null
const listeners = new Set<() => void>()

function read(): EditorSettings {
  if (typeof window === 'undefined') return DEFAULT_EDITOR_SETTINGS
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY)
    if (!raw) return DEFAULT_EDITOR_SETTINGS
    const parsed = JSON.parse(raw) as unknown
    if (!parsed || typeof parsed !== 'object') return DEFAULT_EDITOR_SETTINGS
    return { ...DEFAULT_EDITOR_SETTINGS, ...(parsed as Partial<EditorSettings>) }
  } catch {
    return DEFAULT_EDITOR_SETTINGS
  }
}

export function getEditorSettings(): EditorSettings {
  cache ??= read()
  return cache
}

export function setEditorSetting<K extends keyof EditorSettings>(key: K, value: EditorSettings[K]): void {
  cache = { ...getEditorSettings(), [key]: value }
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(cache))
  } catch {
    /* private mode — still applies this session */
  }
  for (const l of listeners) l()
}

export function subscribeEditorSettings(listener: () => void): () => void {
  listeners.add(listener)
  return () => listeners.delete(listener)
}

export function getServerEditorSettings(): EditorSettings {
  return DEFAULT_EDITOR_SETTINGS
}
