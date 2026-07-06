// Topic + level catalog and interviewer persona for the live technical
// interview lab. Kept framework-free so both the client page and the server
// report route can import it.

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

/** Length of a single interview round, in seconds. */
export const ROUND_SECONDS = 120

export function topicById(id: string): Topic | undefined {
  return TOPICS.find((t) => t.id === id)
}

export function levelById(id: string): Level | undefined {
  return LEVELS.find((l) => l.id === id)
}

/**
 * System instruction for the live interviewer persona. Kept deliberately tight:
 * the model must ask one short question at a time and never lecture, because the
 * whole round is only two minutes of spoken conversation.
 */
export function buildSystemInstruction(topicId: string, level: LevelId): string {
  const topic = topicById(topicId)
  const lvl = levelById(level)
  const topicLabel = topic?.label ?? topicId
  const levelLabel = lvl?.label ?? level

  return [
    `You are a friendly but rigorous senior software engineer conducting a live, spoken technical interview about ${topicLabel}.`,
    `The difficulty level is ${levelLabel}: ${lvl?.description ?? ''}`.trim(),
    '',
    'Rules for how you speak:',
    `- Ask exactly ONE short, focused question at a time about ${topicLabel}.`,
    '- Keep every reply under about 15 seconds of speech. Be conversational, not a monologue.',
    "- Briefly acknowledge or give a short follow-up on the candidate's answer, then move on. Never lecture or give long explanations.",
    '- If the candidate is stuck, offer one small hint, then continue.',
    '- Do not read out code character by character; keep it verbal and natural.',
    `- Progressively probe deeper within the ${levelLabel} level as the candidate answers.`,
    '',
    'The entire round lasts about 2 minutes. When you are told that time is up, thank the candidate warmly in one sentence and stop asking questions.',
    'Begin only when the candidate speaks or when prompted to start.',
  ].join('\n')
}
