// Seed concepts + shared types for the Rickshaw Analogies engine. The AI turns a
// concept into a culturally-native everyday analogy rendered as a shareable card.

export type AnalogyLanguage = 'en' | 'bn' | 'both'

export interface AnalogyLanguageOption {
  id: AnalogyLanguage
  label: string
}

export const ANALOGY_LANGUAGES: AnalogyLanguageOption[] = [
  { id: 'en', label: 'English' },
  { id: 'bn', label: 'বাংলা' },
  { id: 'both', label: 'Both' },
]

export interface MappingRow {
  /** The technical part. */
  concept: string
  /** The everyday counterpart. */
  everyday: string
}

export interface AnalogyCardData {
  id?: string
  concept: string
  language: AnalogyLanguage
  /** Punchy name for the analogy, e.g. "The Rickshaw Queue". */
  title: string
  /** 2–3 sentence everyday scene. */
  scene: string
  /** Concept-part ↔ everyday-part rows. */
  mapping: MappingRow[]
  /** One-line takeaway. */
  soBasically: string
  /** Short, accurate technical note so it stays honest. */
  techNote: string
  /** A single emoji for the card. */
  emoji: string
}

/** One-tap suggestions shown in the generator. */
export const SUGGESTED_CONCEPTS: string[] = [
  'Closures',
  'The event loop',
  'Promises & async/await',
  'Recursion',
  'The call stack',
  'APIs',
  'Databases & indexes',
  'Caching',
  'Git branches',
  'Big-O notation',
  'Hoisting',
  'The DOM',
]

export function languageLabel(id: string): string {
  return ANALOGY_LANGUAGES.find((l) => l.id === id)?.label ?? id
}
