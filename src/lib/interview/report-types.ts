// Shared shape of the post-interview report. Kept in lib (not the route file)
// so Server Components, the history pages, and the client hook can all import
// it without depending on a route handler module.

export interface SubtopicCoverage {
  /** Subtopic ID (matches the IDs in questions.ts). */
  id: string
  /** Human-readable label, e.g. "Closures & Scope". */
  label: string
  /** Whether the interviewer touched on this area during the round. */
  covered: boolean
  /** Per-subtopic rating 0-10 if covered, otherwise 0. */
  rating: number
}

export interface InterviewReport {
  overallScore: number
  verdict: string
  scores: {
    communication: number
    technicalDepth: number
    accuracy: number
  }
  strengths: string[]
  improvements: string[]
  perQuestion: { question: string; feedback: string; rating: number }[]
  suggestions: string[]
  summary: string
  /** Which sub-topics were covered and how well. */
  subtopicCoverage: SubtopicCoverage[]
}
