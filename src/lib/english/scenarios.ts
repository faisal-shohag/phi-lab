// Scenario catalog + the AI coach persona for the English-for-Developers lab.
// The learner practises spoken technical English; the AI plays a role
// (interviewer, manager, teammate) and keeps the conversation going. Voice
// personas are reused from the interview lab. Framework-free.
import { spokenDuration } from '@/lib/labs/duration'

export interface Scenario {
  id: string
  label: string
  /** lucide-react icon name, resolved on the client. */
  icon: string
  /** One-line description of the roleplay. */
  blurb: string
  /** Tailwind gradient classes for the scenario chip. */
  gradient: string
  /** The role the AI plays, injected into the system prompt. */
  role: string
  /** Extra behaviour lines for this scenario. */
  extra: string[]
}

export const SCENARIOS: Scenario[] = [
  {
    id: 'explain-code',
    label: 'Explain your code',
    icon: 'Code2',
    blurb: 'Walk a colleague through a feature you built and how it works.',
    gradient: 'from-sky-400 to-blue-600',
    role: 'a friendly senior engineer asking the learner to walk you through some code they wrote',
    extra: [
      'Ask them to explain what a recent feature or function does and why they built it that way.',
      'Ask natural follow-up questions about trade-offs and edge cases to keep them talking.',
    ],
  },
  {
    id: 'standup',
    label: 'Daily standup',
    icon: 'Users',
    blurb: 'Give your update: what you did, what’s next, any blockers.',
    gradient: 'from-emerald-400 to-teal-600',
    role: 'a supportive scrum master running a quick daily standup',
    extra: [
      'Ask them for their standup update: what they finished yesterday, what they will work on today, and any blockers.',
      'Ask one short clarifying question about a blocker or task, like a real standup.',
    ],
  },
  {
    id: 'negotiation',
    label: 'Salary negotiation',
    icon: 'HandCoins',
    blurb: 'Negotiate an offer with a hiring manager — practise the hard part.',
    gradient: 'from-amber-400 to-orange-600',
    role: 'a fair but firm hiring manager discussing a job offer and compensation',
    extra: [
      'Make an initial offer and let the learner negotiate. Push back gently so they must justify their ask.',
      'Reward clear, polite, confident negotiation language.',
    ],
  },
  {
    id: 'defend-decision',
    label: 'Defend a decision',
    icon: 'MessagesSquare',
    blurb: 'A teammate questions your technical choice — explain and defend it.',
    gradient: 'from-fuchsia-400 to-purple-600',
    role: 'a curious teammate in a code review who questions the learner’s technical decisions',
    extra: [
      'Ask why they chose a particular approach (library, pattern, structure) and probe politely.',
      'Let them practise disagreeing and justifying a decision professionally.',
    ],
  },
  {
    id: 'networking',
    label: 'Networking chat',
    icon: 'Coffee',
    blurb: 'Professional small talk — introduce yourself at a meetup.',
    gradient: 'from-rose-400 to-red-500',
    role: 'a friendly developer meeting the learner at a tech meetup',
    extra: [
      'Start with light small talk, then ask what they work on and what they are interested in.',
      'Keep it relaxed; help them practise introducing themselves and their work.',
    ],
  },
]

/** Length of a single practice round, in seconds. */
export const ROUND_SECONDS = 180

export function scenarioById(id: string): Scenario | undefined {
  return SCENARIOS.find((s) => s.id === id)
}

export interface CoachInstructionOptions {
  /** Persona name the coach may use to introduce themselves. */
  personaName?: string
  /** Round length in seconds, so the prompt's pacing matches the actual timer. */
  roundSeconds?: number
}

/**
 * System instruction for the AI English coach. It stays in the scenario role,
 * speaks clear natural English, keeps the learner talking, and only lightly
 * corrects in-conversation — the detailed feedback comes from the report.
 */
export function buildCoachInstruction(
  scenarioId: string,
  opts: CoachInstructionOptions = {},
): string {
  const { personaName, roundSeconds = ROUND_SECONDS } = opts
  const scenario = scenarioById(scenarioId)
  const role = scenario?.role ?? 'a friendly conversation partner'

  const lines: string[] = [
    `You are an English-speaking practice partner for a software developer who is improving their spoken technical English. In this session you are ${role}.`,
    ...(personaName ? [`Your name is ${personaName}; you may introduce yourself briefly by that name.`] : []),
    '',
    'How you behave:',
    '- Speak clear, natural, professional English. Keep your own turns short (under about 15 seconds) so the LEARNER does most of the talking.',
    '- Stay in your role for the whole conversation. Ask one question at a time and keep the dialogue flowing naturally.',
    '- Your goal is to get the learner speaking as much as possible. Ask open follow-up questions; never lecture.',
    '- Do NOT constantly correct their grammar mid-conversation — that breaks the flow. Only gently rephrase if a mistake makes them hard to understand, then move on.',
    '- Be warm and encouraging. This is practice; help them feel comfortable speaking.',
    ...(scenario?.extra ?? []),
    '',
    `The session lasts about ${spokenDuration(roundSeconds)}. When you are told time is up, thank them warmly in one sentence and stop.`,
    'Begin only when prompted: greet the learner in one sentence in your role and ask your first question.',
  ]

  return lines.join('\n')
}
