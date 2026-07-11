// The JS Motion lab has one language setting that drives EVERY AI surface
// (Step Tutor, Story, Complexity, Harder-one, Challenge task, Hints): proper
// Bengali (Bangla script) or English. Client- and server-safe (no imports).

export type LabLang = 'bengali' | 'english'

export function isLabLang(v: unknown): v is LabLang {
  return v === 'bengali' || v === 'english'
}

export const LAB_LANGS: { id: LabLang; label: string }[] = [
  { id: 'bengali', label: 'বাংলা' },
  { id: 'english', label: 'English' },
]

// The instruction appended to every AI prompt so the model writes in the chosen
// language. Bengali means real Bangla script — never Banglish/Latin.
export function aiLangInstruction(lang: LabLang): string {
  return lang === 'english'
    ? 'Write the prose in clear, simple English.'
    : 'Write the prose ENTIRELY in Bengali (Bangla script, বাংলা) — proper Bengali, NOT Banglish/Latin letters. Keep code identifiers, keywords and Big-O in English.'
}
