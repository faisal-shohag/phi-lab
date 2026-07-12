// Concept catalog + the "curious beginner" persona for the Feynman (teach-back)
// lab. The learner teaches; the AI plays a student who knows nothing and asks
// naive questions. Framework-free so both the client hook and the server routes
// can import it. Voice personas + languages are reused from the interview lab.

import type { LanguageId } from '@/lib/interview/topics'
import { spokenDuration } from '@/lib/labs/duration'
import { endingInstruction } from '@/lib/labs/end-session'

export interface Concept {
  id: string
  label: string
  /** lucide-react icon name, resolved on the client. */
  icon: string
  /** One-line prompt of what to explain. */
  blurb: string
  /** Tailwind gradient classes for the concept chip. */
  gradient: string
}

// Conceptual (not code-typing) topics that reward a clear spoken explanation.
export const CONCEPTS: Concept[] = [
  { id: 'closures', label: 'Closures', icon: 'Box', blurb: 'Why a function keeps access to variables from where it was defined.', gradient: 'from-amber-400 to-orange-500' },
  { id: 'event-loop', label: 'The Event Loop', icon: 'RefreshCw', blurb: 'How JavaScript runs async work with a single thread.', gradient: 'from-sky-400 to-indigo-600' },
  { id: 'hoisting', label: 'Hoisting', icon: 'ArrowUpNarrowWide', blurb: 'Why var/let/function behave differently before their line runs.', gradient: 'from-fuchsia-400 to-pink-500' },
  { id: 'promises', label: 'Promises & async/await', icon: 'Timer', blurb: 'What a promise is and how await pauses without blocking.', gradient: 'from-violet-500 to-purple-600' },
  { id: 'this', label: 'The `this` keyword', icon: 'Crosshair', blurb: 'How `this` is decided at call time, not definition time.', gradient: 'from-emerald-400 to-teal-600' },
  { id: 'prototypes', label: 'Prototypes', icon: 'Network', blurb: 'How objects inherit via the prototype chain.', gradient: 'from-rose-400 to-red-500' },
  { id: 'recursion', label: 'Recursion', icon: 'Repeat', blurb: 'How a function calling itself solves a problem, and the base case.', gradient: 'from-cyan-400 to-blue-600' },
  { id: 'big-o', label: 'Big-O Notation', icon: 'TrendingUp', blurb: 'How we describe how an algorithm scales with input size.', gradient: 'from-lime-400 to-green-600' },
  { id: 'references', label: 'Value vs Reference', icon: 'Link2', blurb: 'Why copying an object is different from copying a number.', gradient: 'from-orange-400 to-amber-600' },
  { id: 'scope', label: 'Scope', icon: 'Braces', blurb: 'Where variables live and which code can see them.', gradient: 'from-teal-400 to-cyan-600' },
]

/** Length of a single teach-back round, in seconds. */
export const ROUND_SECONDS = 180

export function conceptById(id: string): Concept | undefined {
  return CONCEPTS.find((c) => c.id === id)
}

export interface TeachbackInstructionOptions {
  language?: LanguageId
  /** Persona name the student may use to introduce themselves. */
  personaName?: string
  /** Round length in seconds, so the prompt's pacing matches the actual timer. */
  roundSeconds?: number
}

/**
 * System instruction for the AI *student*. The human is the teacher; the model
 * must stay in the role of an eager beginner, never lecture, and probe exactly
 * the spots a real learner would trip on.
 */
export function buildTeachbackInstruction(
  conceptId: string,
  opts: TeachbackInstructionOptions = {},
): string {
  const { language = 'en', personaName, roundSeconds = ROUND_SECONDS } = opts
  const concept = conceptById(conceptId)
  const conceptLabel = concept?.label ?? conceptId

  const lines: string[] = [
    `You are a friendly, eager junior developer being taught about "${conceptLabel}" in a live, spoken lesson. The HUMAN is the teacher; YOU are the student.`,
    ...(personaName ? [`Your name is ${personaName}; you may introduce yourself briefly by that name.`] : []),
    '',
    'How you behave:',
    '- You are genuinely curious and a little unsure. You do NOT already know this topic — you are learning it from the teacher.',
    '- NEVER lecture or explain the concept yourself, and never give away the full answer. Your job is to make the teacher explain it well.',
    '- Ask exactly ONE short, natural question at a time. Keep every reply under about 15 seconds of speech.',
    '- Probe the parts the teacher glosses over or assumes. Ask "why?", "what does that mean?", "can you give an example?".',
    '- If the teacher uses a technical term without explaining it, stop and ask what that term means.',
    '- Now and then, restate the idea in your own words — sometimes slightly wrong — and ask "did I get that right?" so the teacher can correct you.',
    '- If the teacher goes quiet or seems stuck, encourage them warmly and ask a simpler follow-up.',
    '- Stay in character as the student the whole time. Be warm and encouraging, never condescending.',
  ]

  if (language === 'bn') {
    lines.push(
      '- Conduct the ENTIRE lesson in Bengali (Bangla). Speak naturally and fluently in Bengali; technical terms and code keywords may remain in English where that is normal.',
    )
  }

  lines.push(
    '',
    `The lesson lasts about ${spokenDuration(roundSeconds)}. When you are told that time is up, briefly say in one or two sentences what you learned from the teacher, thank them, and stop asking questions.`,
    endingInstruction(roundSeconds),
    'Begin only when prompted: greet the teacher warmly in one sentence as a curious learner and ask them to start explaining.',
  )

  return lines.join('\n')
}
