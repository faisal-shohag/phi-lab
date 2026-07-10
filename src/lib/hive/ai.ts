// AI calls for Hive. Every response is shape-constrained by a schema so the
// model can only return the fields the caller needs.
//
// The schemas below are written in Gemini's dialect and are the single source
// of truth; `providers.ts` translates them for Ollama and Groq and handles
// failover + rate-limit cooldowns. If every provider fails, the call throws and
// `runAiAttempt` escalates the post to a human mentor.
//
// Server-only. Never call these from a client component.
import { Type } from '@google/genai'
import { HIVE_TAGS } from './constants'
import { generateStructured, generateStructuredWithMeta, type ProviderId } from './providers'
import type { AiCallContext } from './usage'

/** Callers pass who/what a call is for so its usage row is attributable. */
export type CallScope = Omit<AiCallContext, 'task'>

// ── Triage ────────────────────────────────────────────────────────────────
// Runs inline on post creation: it decides tags/topic/severity and, crucially,
// whether the post must skip the AI loop and go straight to a human.

export interface TriageResult {
  tags: string[]
  topic: string
  milestone: string
  severity: 'low' | 'medium' | 'high'
  sensitive: boolean
  sensitiveReason?: string
}

const TRIAGE_SCHEMA = {
  type: Type.OBJECT,
  properties: {
    tags: {
      type: Type.ARRAY,
      description: `Up to 3 tags, each chosen from this exact list: ${HIVE_TAGS.join(', ')}.`,
      items: { type: Type.STRING },
    },
    topic: { type: Type.STRING, description: 'The single best topic label, e.g. "javascript" or "css".' },
    milestone: {
      type: Type.STRING,
      description: 'Best guess at the bootcamp milestone/skill area this belongs to, e.g. "Milestone 3 — problem solving".',
    },
    severity: {
      type: Type.STRING,
      description: 'How blocked the student is: "low", "medium", or "high".',
    },
    sensitive: {
      type: Type.BOOLEAN,
      description:
        'True if a human must handle this: mental-health distress, harassment, academic integrity/cheating, billing, or account issues.',
    },
    sensitiveReason: { type: Type.STRING, description: 'One short line on why it is sensitive. Empty when sensitive is false.' },
  },
  required: ['tags', 'topic', 'milestone', 'severity', 'sensitive'],
  propertyOrdering: ['tags', 'topic', 'milestone', 'severity', 'sensitive', 'sensitiveReason'],
}

export async function triagePost(title: string, body: string, scope: CallScope = {}): Promise<TriageResult> {
  const prompt = [
    'You are triaging a post on the helpdesk of a beginner-to-intermediate web development bootcamp in Bangladesh.',
    'Classify it. Pick tags only from the allowed list. Judge severity by how blocked the student is.',
    'Mark `sensitive` true ONLY for things an AI must not handle alone: signs of mental-health crisis, harassment or abuse, requests to cheat on assignments, or billing/account problems.',
    '',
    `TITLE: ${title}`,
    `BODY:\n${body}`,
  ].join('\n')

  const result = await generateStructured<TriageResult>(prompt, TRIAGE_SCHEMA, { ...scope, task: 'TRIAGE' })
  // Never trust the model's tag vocabulary — filter to the curated list.
  result.tags = (result.tags ?? [])
    .map((t) => t.toLowerCase().trim())
    .filter((t): t is (typeof HIVE_TAGS)[number] => HIVE_TAGS.includes(t as (typeof HIVE_TAGS)[number]))
    .slice(0, 3)
  if (!['low', 'medium', 'high'].includes(result.severity)) result.severity = 'medium'
  return result
}

// ── Answer attempts ───────────────────────────────────────────────────────
// Attempt 1 answers directly. Attempt 2 must take a different angle because
// attempt 1 demonstrably failed. Attempt 3 stops guessing and asks for the
// specific information it needs (a clarifying question, not another answer).

export interface AnswerResult {
  body: string
  confidence: number
  usedAngle: string
  /** Which AI answered. Recorded on the timeline so failovers are auditable. */
  provider: ProviderId
}

const ANSWER_SCHEMA = {
  type: Type.OBJECT,
  properties: {
    body: {
      type: Type.STRING,
      description:
        'The reply, in GitHub-flavored markdown. Use fenced code blocks with a language tag. Be concrete and warm. Keep it under 300 words.',
    },
    confidence: {
      type: Type.INTEGER,
      description: 'How confident you are that this resolves the problem, 0-100.',
    },
    usedAngle: {
      type: Type.STRING,
      description: 'A short label for the approach you took, e.g. "fix the closure capture".',
    },
  },
  required: ['body', 'confidence', 'usedAngle'],
  propertyOrdering: ['body', 'confidence', 'usedAngle'],
}

export interface ThreadMessage {
  who: string
  body: string
}

const PERSONA = [
  'You are "Hive AI", the first line of support on a web development bootcamp helpdesk.',
  'Students are beginners. Be warm, direct, and never condescending.',
  'LANGUAGE: mirror the student exactly. If their question is written in English, answer in English.',
  'Answer in Bengali ONLY if the student actually wrote in Bengali. Code and technical terms always stay in English.',
  'Always show corrected code in fenced blocks with a language tag. Explain the *why* in one or two sentences.',
  'Never invent APIs. If you are unsure, say what you would check and how.',
].join(' ')

export async function answerAttempt(
  post: { title: string; body: string; topic: string | null },
  thread: ThreadMessage[],
  attempt: number,
  scope: CallScope = {},
): Promise<AnswerResult> {
  const transcript = thread.length
    ? thread.map((m) => `${m.who}: ${m.body}`).join('\n\n---\n\n')
    : '(no replies yet)'

  const strategy =
    attempt === 1
      ? 'This is your first attempt. Give the most likely complete fix, with corrected code.'
      : attempt === 2
        ? [
            'Your previous answer did NOT work — the student is still stuck.',
            'Do NOT repeat it or rephrase it. Take a genuinely DIFFERENT angle:',
            'question the environment, the assumptions, the data shape, or the build/tooling.',
            'Give one concrete diagnostic step the student can run to narrow it down.',
          ].join(' ')
        : [
            'Two answers have already failed. STOP guessing.',
            'Do not propose another fix. Instead ask 2-3 specific, targeted questions',
            '(exact error text, the actual input/output, versions, a minimal reproduction)',
            'that would let anyone solve this. Explain briefly why each one matters.',
          ].join(' ')

  const prompt = [
    PERSONA,
    '',
    strategy,
    '',
    `QUESTION TITLE: ${post.title}`,
    `TOPIC: ${post.topic ?? 'unknown'}`,
    `QUESTION BODY:\n${post.body}`,
    '',
    `THREAD SO FAR:\n${transcript}`,
  ].join('\n')

  const { data, provider } = await generateStructuredWithMeta<Omit<AnswerResult, 'provider'>>(
    prompt,
    ANSWER_SCHEMA,
    { ...scope, task: 'ANSWER', aiAttempt: attempt },
  )
  return {
    ...data,
    confidence: Math.max(0, Math.min(100, Math.round(data.confidence ?? 0))),
    provider,
  }
}

// ── Peer answer verification ("Bee-Approved") ─────────────────────────────
// Deliberately conservative: `unsure` and `reject` both leave the answer
// unmarked. A wrong answer wearing a verified badge is far worse than a right
// answer without one, and rejecting never shames the student publicly.

export interface VerifyResult {
  verdict: 'approve' | 'reject' | 'unsure'
  note: string
}

const VERIFY_SCHEMA = {
  type: Type.OBJECT,
  properties: {
    verdict: {
      type: Type.STRING,
      description:
        'approve only if the answer is technically correct AND actually addresses the question. reject if it is wrong or harmful. unsure otherwise.',
    },
    note: { type: Type.STRING, description: 'One short sentence explaining the verdict.' },
  },
  required: ['verdict', 'note'],
  propertyOrdering: ['verdict', 'note'],
}

export async function verifyPeerAnswer(
  post: { title: string; body: string },
  answerBody: string,
  scope: CallScope = {},
): Promise<VerifyResult> {
  const prompt = [
    'You are verifying whether a student\'s answer to a classmate\'s coding question is correct.',
    'Approve ONLY when the answer is technically correct and genuinely addresses the question asked.',
    'If the answer is plausible but you cannot be confident, choose "unsure" — do not approve.',
    'If it is wrong or would cause harm (data loss, insecure code), choose "reject".',
    '',
    `QUESTION TITLE: ${post.title}`,
    `QUESTION BODY:\n${post.body}`,
    '',
    `PROPOSED ANSWER:\n${answerBody}`,
  ].join('\n')

  const result = await generateStructured<VerifyResult>(prompt, VERIFY_SCHEMA, { ...scope, task: 'VERIFY' })
  if (!['approve', 'reject', 'unsure'].includes(result.verdict)) result.verdict = 'unsure'
  return result
}

// ── Honeycomb archive summary ─────────────────────────────────────────────
// Written when a post is resolved, so the knowledge base stores a distilled
// answer rather than a raw thread nobody wants to re-read.

export interface KbSummaryResult {
  kbTitle: string
  kbSummary: string
  keyTakeaways: string[]
}

const KB_SCHEMA = {
  type: Type.OBJECT,
  properties: {
    kbTitle: { type: Type.STRING, description: 'A clear, searchable title for the knowledge-base entry.' },
    kbSummary: {
      type: Type.STRING,
      description: 'The problem and its solution in 2-4 sentences of markdown, including the key code fix.',
    },
    keyTakeaways: {
      type: Type.ARRAY,
      description: '2-3 one-line lessons a future student should remember.',
      items: { type: Type.STRING },
    },
  },
  required: ['kbTitle', 'kbSummary', 'keyTakeaways'],
  propertyOrdering: ['kbTitle', 'kbSummary', 'keyTakeaways'],
}

export async function summarizeForKb(
  post: { title: string; body: string },
  acceptedAnswer: string,
  scope: CallScope = {},
): Promise<KbSummaryResult> {
  const prompt = [
    'Distill this solved helpdesk thread into a knowledge-base entry a future student can search and understand on its own.',
    'Do not reference "the student" or the thread. State the problem, then the fix.',
    '',
    `QUESTION TITLE: ${post.title}`,
    `QUESTION BODY:\n${post.body}`,
    '',
    `ACCEPTED ANSWER:\n${acceptedAnswer}`,
  ].join('\n')

  return generateStructured<KbSummaryResult>(prompt, KB_SCHEMA, { ...scope, task: 'KB_SUMMARY' })
}

// ── Encouragement posts ───────────────────────────────────────────────────
// The Hive occasionally nudges the community toward the other labs. Posted by
// the AI itself (no author), pinned never, expires never.

export interface EncouragementResult {
  title: string
  body: string
  /** Which model wrote it — stored on the post, shown to staff only. */
  provider: ProviderId
}

const ENCOURAGEMENT_SCHEMA = {
  type: Type.OBJECT,
  properties: {
    title: { type: Type.STRING, description: 'A short, warm, non-salesy title.' },
    body: { type: Type.STRING, description: '2-4 sentences of markdown encouraging the practice. No hype, no emoji spam.' },
  },
  required: ['title', 'body'],
  propertyOrdering: ['title', 'body'],
}

const NUDGES = [
  'stepping through a tricky snippet in the Js Motion visualizer at /labs/js-motion',
  'booking a live Support Session at /labs/support when they are stuck and tired',
  'practising a mock interview at /labs/interview before applying for jobs',
  'explaining a concept out loud in the Feynman lab at /labs/feynman to find the gaps',
  'practising spoken technical English at /labs/english',
]

export async function encouragementPost(seed: number): Promise<EncouragementResult> {
  const nudge = NUDGES[seed % NUDGES.length]
  const prompt = [
    'You are Hive AI posting a short, genuine encouragement to a bootcamp community feed.',
    `Encourage students to try ${nudge}.`,
    'Be specific about why it helps. Sound like a helpful senior, not a marketing email. Include the link path as a markdown link.',
  ].join('\n')

  const { data, provider } = await generateStructuredWithMeta<Omit<EncouragementResult, 'provider'>>(
    prompt,
    ENCOURAGEMENT_SCHEMA,
    { task: 'ENCOURAGEMENT' },
  )
  return { ...data, provider }
}

// ── Pre-post coach ────────────────────────────────────────────────────────

export interface CoachResult {
  quality: number
  suggestions: { kind: string; text: string }[]
  improvedTitle?: string
}

const COACH_SCHEMA = {
  type: Type.OBJECT,
  properties: {
    quality: { type: Type.INTEGER, description: 'How answerable this question is as written, 0-100.' },
    suggestions: {
      type: Type.ARRAY,
      description: 'Up to 3 concrete improvements. Empty if the question is already strong.',
      items: {
        type: Type.OBJECT,
        properties: {
          kind: {
            type: Type.STRING,
            description: 'One of: add_error, add_code, clarify_goal, shorten, title.',
          },
          text: { type: Type.STRING, description: 'One short, actionable sentence addressed to the student.' },
        },
        required: ['kind', 'text'],
        propertyOrdering: ['kind', 'text'],
      },
    },
    improvedTitle: { type: Type.STRING, description: 'A sharper title, or empty if the current one is fine.' },
  },
  required: ['quality', 'suggestions'],
  propertyOrdering: ['quality', 'suggestions', 'improvedTitle'],
}

export async function coachDraft(title: string, body: string, scope: CallScope = {}): Promise<CoachResult> {
  const prompt = [
    'You coach bootcamp students on asking answerable technical questions.',
    'Review this draft. Be encouraging and specific. If it already has the error text, the relevant code, and a clear goal, say so with few or no suggestions.',
    'Never answer the question itself — only improve how it is asked.',
    '',
    `DRAFT TITLE: ${title}`,
    `DRAFT BODY:\n${body}`,
  ].join('\n')

  const result = await generateStructured<CoachResult>(prompt, COACH_SCHEMA, { ...scope, task: 'COACH' })
  result.quality = Math.max(0, Math.min(100, Math.round(result.quality ?? 0)))
  result.suggestions = (result.suggestions ?? []).slice(0, 3)
  return result
}
