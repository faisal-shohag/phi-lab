// Topic + level catalog and interviewer persona for the live technical
// interview lab. Kept framework-free so both the client page and the server
// report route can import it.
import { spokenDuration } from '@/lib/labs/duration'
import { endingInstruction } from '@/lib/labs/end-session'
import { subtopicLabels, subtopicsForTopic } from '@/lib/interview/questions'

export type LevelId = 'easy' | 'medium' | 'expert'

export interface Topic {
  id: string
  label: string
  /** lucide-react icon name, resolved on the client. */
  icon: string
  blurb: string
}

export interface Level {
  id: LevelId
  label: string
  description: string
}

export type LanguageId = 'en' | 'bn'

/**
 * Interview pressure / demeanor — the "Anxiety Trainer" dimension. Same topic
 * and difficulty, but the interviewer's temperament ramps from supportive to a
 * stress panel that interrupts. Graded exposure: practise composure, not just
 * correctness.
 */
export type PressureId = 'supportive' | 'neutral' | 'stern' | 'panel'

export interface Pressure {
  id: PressureId
  label: string
  /** One-line description shown in the picker. */
  description: string
  /** lucide-react icon name, resolved on the client. */
  icon: string
  /** Tailwind gradient classes for the selected chip. */
  tint: string
}

export const PRESSURES: Pressure[] = [
  {
    id: 'supportive',
    label: 'Supportive',
    description: 'Warm and patient. Lots of encouragement and hints. A gentle warm-up.',
    icon: 'HeartHandshake',
    tint: 'from-emerald-400 to-teal-600',
  },
  {
    id: 'neutral',
    label: 'Professional',
    description: 'Calm and businesslike — a realistic, fair interview.',
    icon: 'Briefcase',
    tint: 'from-sky-400 to-indigo-600',
  },
  {
    id: 'stern',
    label: 'Stern',
    description: 'Terse and skeptical. Pushes back on vague answers and asks you to justify.',
    icon: 'Gavel',
    tint: 'from-amber-500 to-orange-600',
  },
  {
    id: 'panel',
    label: 'Stress Panel',
    description: 'A tough panel that interrupts, switches topics abruptly and piles on time pressure.',
    icon: 'Flame',
    tint: 'from-rose-500 to-red-600',
  },
]

export function pressureById(id: string): Pressure | undefined {
  return PRESSURES.find((p) => p.id === id)
}

export interface Language {
  id: LanguageId
  label: string
  /** BCP-47 code passed to Gemini speechConfig.languageCode. */
  speechCode: string
}

export interface Character {
  id: string
  /** Prebuilt Gemini voice name. */
  voiceName: string
  name: string
  description: string
  /** Tailwind gradient classes for the avatar. */
  gradient: string
}

export const TOPICS: Topic[] = [
  { id: 'html', label: 'HTML', icon: 'FileCode2', blurb: 'Semantics, forms, accessibility, the document outline.' },
  { id: 'css', label: 'CSS', icon: 'Palette', blurb: 'Layout, specificity, flexbox & grid, responsive design.' },
  { id: 'javascript', label: 'JavaScript', icon: 'Braces', blurb: 'Closures, the event loop, prototypes, async patterns.' },
  { id: 'typescript', label: 'TypeScript', icon: 'FileType2', blurb: 'Types, generics, narrowing, utility types.' },
  { id: 'react', label: 'React', icon: 'Atom', blurb: 'Hooks, rendering, state, effects, composition.' },
  { id: 'nextjs', label: 'Next.js', icon: 'PanelsTopLeft', blurb: 'App Router, server components, data fetching, caching.' },
  { id: 'nodejs', label: 'Node.js', icon: 'Hexagon', blurb: 'Runtime, streams, the event loop, modules.' },
  { id: 'express', label: 'Express', icon: 'Server', blurb: 'Routing, middleware, error handling, REST design.' },
  { id: 'jwt', label: 'JWT & Auth', icon: 'KeyRound', blurb: 'Tokens, sessions, signing, refresh flows, security.' },
  { id: 'mongodb', label: 'MongoDB', icon: 'Database', blurb: 'Documents, indexes, aggregation, schema design.' },
]

export const LEVELS: Level[] = [
  { id: 'easy', label: 'Easy', description: 'Fundamentals and definitions — warm-up questions.' },
  { id: 'medium', label: 'Medium', description: 'Applied reasoning and common real-world scenarios.' },
  { id: 'expert', label: 'Expert', description: 'Edge cases, trade-offs, and deep internals.' },
]

export const LANGUAGES: Language[] = [
  { id: 'en', label: 'English', speechCode: 'en-US' },
  { id: 'bn', label: 'Bengali', speechCode: 'bn-IN' },
]

/**
 * Interviewer personas, each mapped to a prebuilt Gemini voice. Voice choice is
 * independent of language — any character can conduct the round in English or
 * Bengali.
 */
export const CHARACTERS: Character[] = [
  { id: 'nova', voiceName: 'Kore', name: 'Nova', description: 'Warm and encouraging', gradient: 'from-amber-400 to-orange-500' },
  { id: 'atlas', voiceName: 'Charon', name: 'Atlas', description: 'Calm and measured', gradient: 'from-sky-500 to-indigo-600' },
  { id: 'pixel', voiceName: 'Puck', name: 'Pixel', description: 'Upbeat and quick', gradient: 'from-fuchsia-500 to-pink-500' },
  { id: 'sage', voiceName: 'Orus', name: 'Sage', description: 'Thoughtful and precise', gradient: 'from-emerald-500 to-teal-600' },
  { id: 'lyra', voiceName: 'Aoede', name: 'Lyra', description: 'Bright and friendly', gradient: 'from-violet-500 to-purple-600' },
]

/**
 * Default length of a single interview round, in seconds. The live value is
 * admin-tunable (`lab.interview.roundSeconds`) and reaches the browser on the
 * token response; this constant is the pre-connect placeholder and the value
 * SETTING_DEFAULTS mirrors.
 */
export const ROUND_SECONDS = 180

export function topicById(id: string): Topic | undefined {
  return TOPICS.find((t) => t.id === id)
}

export function levelById(id: string): Level | undefined {
  return LEVELS.find((l) => l.id === id)
}

export function languageById(id: string): Language | undefined {
  return LANGUAGES.find((l) => l.id === id)
}

export function characterById(id: string): Character | undefined {
  return CHARACTERS.find((c) => c.id === id)
}

export interface SystemInstructionOptions {
  language?: LanguageId
  /** When true, open with a brief "tell me about yourself" icebreaker. */
  includeIntro?: boolean
  /** Round length in seconds, so the prompt's pacing matches the actual timer. */
  roundSeconds?: number
  /** Persona name the interviewer may use to introduce themselves. */
  personaName?: string
  /** Interviewer demeanor / stress level. Defaults to 'neutral'. */
  pressure?: PressureId
  /** Selected subtopic IDs — when provided, only these subtopics are covered. */
  subtopicIds?: string[]
}

// Demeanor instructions injected per pressure level. `neutral` adds nothing —
// it is the baseline persona already described above.
const PRESSURE_INSTRUCTIONS: Record<PressureId, string[]> = {
  supportive: [
    '',
    'Demeanor: SUPPORTIVE. Be especially warm, patient and encouraging. Reassure the candidate when they hesitate, praise partial answers, and offer a hint early rather than letting them struggle. Keep the mood relaxed.',
  ],
  neutral: [],
  stern: [
    '',
    'Demeanor: STERN. Be terse, skeptical and businesslike, though never insulting. Do not offer praise. When an answer is vague or hand-wavy, push back: ask them to be specific, to justify a claim, or "are you sure about that?". Expect precise reasoning before moving on.',
  ],
  panel: [
    '',
    'Demeanor: STRESS PANEL. Simulate a demanding interview panel under time pressure. Occasionally interrupt the candidate mid-answer to redirect or to press a detail. Switch between sub-topics abruptly. Be curt, rarely acknowledge answers, and convey that time is short. Stay professional and never abusive — the goal is to train composure under pressure, not to demean.',
  ],
}

/**
 * System instruction for the live interviewer persona. Kept deliberately tight:
 * the model must ask one short question at a time and never lecture, because the
 * whole round is only three minutes of spoken conversation.
 */
export function buildSystemInstruction(
  topicId: string,
  level: LevelId,
  opts: SystemInstructionOptions = {},
): string {
  const {
    language = 'en',
    includeIntro = false,
    personaName,
    pressure = 'neutral',
    roundSeconds = ROUND_SECONDS,
    subtopicIds,
  } = opts
  const topic = topicById(topicId)
  const lvl = levelById(level)
  const topicLabel = topic?.label ?? topicId
  const levelLabel = lvl?.label ?? level

  const lines: string[] = [
    `You are a friendly but rigorous senior software engineer conducting a live, spoken technical interview about ${topicLabel}.`,
    ...(personaName ? [`Your name is ${personaName}; you may introduce yourself briefly by that name.`] : []),
    `The difficulty level is ${levelLabel}: ${lvl?.description ?? ''}`.trim(),
    '',
    'Rules for how you speak:',
    `- Ask exactly ONE short, focused question at a time about ${topicLabel}.`,
    '- Keep every reply under about 15 seconds of speech. Be conversational, not a monologue.',
    "- Briefly acknowledge or give a short follow-up on the candidate's answer, then move on. Never lecture or give long explanations.",
    '- If the candidate is stuck, offer one small hint, then continue.',
    '- Do not read out code character by character; keep it verbal and natural.',
    `- Progressively probe deeper within the ${levelLabel} level as the candidate answers.`,
  ]

  // Inject subtopic guidance so the interviewer covers breadth, not just depth.
  const allSubtopicLabels = subtopicLabels(topicId)
  if (allSubtopicLabels.length > 0) {
    // If specific subtopics were selected, only list those.
    let subtopicText: string
    if (subtopicIds && subtopicIds.length > 0) {
      const topicData = subtopicsForTopic(topicId)
      const selectedLabels = topicData
        ? topicData.subtopics.filter((s) => subtopicIds.includes(s.id)).map((s) => s.label)
        : subtopicIds
      subtopicText = selectedLabels.length > 0
        ? selectedLabels.join(', ')
        : allSubtopicLabels.join(', ')
    } else {
      subtopicText = allSubtopicLabels.join(', ')
    }
    lines.push(
      '',
      `The key sub-topics within ${topicLabel} are: ${subtopicText}.`,
      'Aim to touch on as many of these areas as the round allows. After the candidate answers a question on one area, shift to a different sub-topic for the next question unless a follow-up is clearly needed.',
    )
  }

  lines.push(...PRESSURE_INSTRUCTIONS[pressure])

  if (language === 'bn') {
    lines.push(
      '- Conduct the ENTIRE interview in Bengali (Bangla). Speak naturally and fluently in Bengali; technical terms and code keywords may remain in English where that is normal.',
    )
  }

  if (includeIntro) {
    lines.push(
      '',
      "Start with a brief icebreaker: ask the candidate to introduce themselves in about twenty seconds (a quick 'tell me about yourself'). Acknowledge their answer in one sentence, then move on to technical questions.",
    )
  }

  lines.push(
    '',
    `The entire round lasts about ${spokenDuration(roundSeconds)}. When you are told that time is up, thank the candidate warmly in one sentence and stop asking questions.`,
    endingInstruction(roundSeconds),
    'Begin only when the candidate speaks or when prompted to start.',
  )

  return lines.join('\n')
}
