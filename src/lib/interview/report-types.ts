// Shared shape of the post-interview report. Kept in lib (not the route file)
// so Server Components, the history pages, and the client hook can all import
// it without depending on a route handler module.

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
}
