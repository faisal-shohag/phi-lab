// Shared shape of the English-practice report.

export interface GrammarFix {
  /** Roughly what the learner said. */
  said: string
  /** A more natural / correct way to say it. */
  better: string
}

export interface EnglishReport {
  /** Overall spoken-English readiness, 0–100. */
  overallScore: number
  verdict: string
  scores: {
    fluency: number // 0–10: smoothness, flow, few long pauses
    clarity: number // 0–10: easy to understand, well-organised
    confidence: number // 0–10: assertive, professional tone
  }
  strengths: string[]
  improvements: string[]
  /** Concrete corrections: what they said → a better phrasing. */
  grammarFixes: GrammarFix[]
  /** Stronger word/phrase choices to learn. */
  vocabBoost: string[]
  /** Note on filler words / hedging, if notable. */
  fillerNote: string
  summary: string
}
