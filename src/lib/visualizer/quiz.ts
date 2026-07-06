// Predict-the-output quiz. Given the step the player is ABOUT to reveal, build
// a question (if that step is a good teaching moment) with plausible wrong
// answers drawn from the rest of the trace.

import type { Step, Trace } from './types'

export interface QuizQuestion {
  stepIndex: number
  kind: 'boolean' | 'output'
  prompt: string
  options: string[]
  answer: string
  line: number
}

// Which steps are worth quizzing on.
export function isQuizzable(step: Step): boolean {
  if (step.kind === 'condition' || step.kind === 'loop-check') return step.conditionResult !== undefined
  if (step.kind === 'output') return step.output != null
  return false
}

function shuffle<T>(arr: T[]): T[] {
  const a = [...arr]
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[a[i], a[j]] = [a[j], a[i]]
  }
  return a
}

function outputDistractors(correct: string, trace: Trace): string[] {
  const pool = new Set<string>()
  for (const s of trace.steps) {
    if (s.kind === 'output' && s.output != null && s.output !== correct) pool.add(s.output)
  }
  // Numeric nudges: if the output ends in a number, offer ±1 / ±2 variants.
  const m = correct.match(/-?\d+(\.\d+)?$/)
  if (m) {
    const base = parseFloat(m[0])
    const prefix = correct.slice(0, m.index)
    for (const d of [1, -1, 2]) {
      const alt = `${prefix}${base + d}`
      if (alt !== correct) pool.add(alt)
    }
  }
  const distractors = shuffle([...pool]).slice(0, 3)
  // Guarantee at least one distractor so the question is answerable.
  if (distractors.length === 0) distractors.push(correct + ' ')
  return distractors
}

export function buildQuestion(stepIndex: number, trace: Trace): QuizQuestion | null {
  const step = trace.steps[stepIndex]
  if (!step || !isQuizzable(step)) return null

  if (step.kind === 'output') {
    const correct = step.output as string
    const options = shuffle([correct, ...outputDistractors(correct, trace)])
    return {
      stepIndex,
      kind: 'output',
      prompt: 'What will this line print?',
      options,
      answer: correct,
      line: step.line,
    }
  }

  const answer = step.conditionResult ? 'true' : 'false'
  return {
    stepIndex,
    kind: 'boolean',
    prompt: 'Will this condition be true or false?',
    options: ['true', 'false'],
    answer,
    line: step.line,
  }
}
