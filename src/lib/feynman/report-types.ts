// Shared shape of the teach-back report. Kept in lib so Server Components, the
// history pages, and the client hook can all import it without depending on a
// route handler module.

export interface FeynmanReport {
  /** Would a real beginner have understood you? 0–100. */
  clarityScore: number
  verdict: string
  scores: {
    clarity: number // 0–10: how understandable the explanation was
    completeness: number // 0–10: how much of the concept was covered
    correctness: number // 0–10: how accurate it was
  }
  /** What you explained well. */
  nailed: string[]
  /** What to revisit next time. */
  revisit: string[]
  /** Technical terms you used without explaining them. */
  jargon: string[]
  /** Things you said that were inaccurate. */
  misconceptions: string[]
  /** Parts of the concept you skipped. */
  gaps: string[]
  /** Short note on how concrete/effective your analogies were. */
  analogyQuality: string
  /** What the AI "student" ended up understanding — the mirror test. */
  juniorLearned: string
  summary: string
}
