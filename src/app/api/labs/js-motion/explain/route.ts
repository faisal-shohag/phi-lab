// AI tutor for the JS Motion visualizer.
//
// Two modes:
//   • 'step'  — the learner clicked "Why?" on a step; explain, in 2-3 friendly
//               sentences, WHY that step did what it did.
//   • 'error' — the program failed; give an encouraging explanation and a
//               nudge toward the fix (a hint, not the full corrected program).
//
// Generation goes through the Hive multi-provider failover engine
// (Gemini -> Ollama -> Groq) so one provider's 429 never leaves a student
// staring at a spinner. Answers are cached per (codeHash, mode, line, lang)
// so re-asking the same step costs nothing.

import { Type } from '@google/genai'
import { requireUser } from '@/lib/auth-server'
import { isSuspended } from '@/lib/admin/suspension'
import { generateStructured } from '@/lib/hive/providers'
import { errorResponse } from '@/lib/interview/errors'
import { chargeAiUse, AI_CHARGE } from '@/lib/visualizer/ai-charge'
import { isLabLang, aiLangInstruction, type LabLang } from '@/lib/visualizer/lang'

export const runtime = 'nodejs'

function fail(code: string, message: string, status: number) {
  return Response.json({ error: code, message }, { status })
}

type Lang = LabLang
type Mode = 'step' | 'error'

interface ExplainReply {
  // A short, friendly explanation (2-3 sentences).
  explanation: string
  // One extra line: an everyday analogy (step mode) or a fix hint (error mode).
  tip: string
}

const SCHEMA = {
  type: Type.OBJECT,
  properties: {
    explanation: {
      type: Type.STRING,
      description: '2-3 short, friendly sentences explaining what happened and why. Beginner-level.',
    },
    tip: {
      type: Type.STRING,
      description:
        'One extra line. For a step: a tiny everyday analogy. For an error: a gentle hint toward the fix — never the full corrected code.',
    },
  },
  required: ['explanation', 'tip'],
  propertyOrdering: ['explanation', 'tip'],
}

// A tiny bounded cache. Keeping it small is fine: the win is "the learner
// re-clicks the same step" and "two learners hit the same demo", not long-term
// memory. Oldest entries fall off once we pass the cap.
const CACHE = new Map<string, ExplainReply>()
const CACHE_MAX = 300

function cacheGet(key: string): ExplainReply | undefined {
  const hit = CACHE.get(key)
  if (hit) {
    // Refresh recency (Map keeps insertion order).
    CACHE.delete(key)
    CACHE.set(key, hit)
  }
  return hit
}

function cacheSet(key: string, value: ExplainReply): void {
  CACHE.set(key, value)
  while (CACHE.size > CACHE_MAX) {
    const oldest = CACHE.keys().next().value
    if (oldest === undefined) break
    CACHE.delete(oldest)
  }
}

// djb2 — same cheap hash the page uses so keys stay short and stable per program.
function codeHash(src: string): string {
  let h = 5381
  for (let i = 0; i < src.length; i++) h = ((h << 5) + h + src.charCodeAt(i)) | 0
  return (h >>> 0).toString(36)
}

interface StepContext {
  description?: string
  kind?: string
  line?: number
  vars?: string
}

export async function POST(request: Request) {
  const user = await requireUser()
  if (!user) return errorResponse('AUTH_REQUIRED')
  if (await isSuspended(user.id)) return errorResponse('SUSPENDED')

  let mode: Mode = 'step'
  let lang: Lang = 'bengali'
  let code = ''
  let step: StepContext | undefined
  let errorText = ''
  try {
    const body = await request.json()
    if (body?.mode === 'error') mode = 'error'
    if (isLabLang(body?.lang)) lang = body.lang
    if (typeof body?.code === 'string') code = body.code.slice(0, 4000)
    if (body?.step && typeof body.step === 'object') {
      step = {
        description: String(body.step.description ?? '').slice(0, 300),
        kind: String(body.step.kind ?? '').slice(0, 40),
        line: Number.isFinite(body.step.line) ? Number(body.step.line) : undefined,
        vars: String(body.step.vars ?? '').slice(0, 500),
      }
    }
    if (typeof body?.error === 'string') errorText = body.error.slice(0, 400)
  } catch {
    return errorResponse('SERVER_ERROR', 'Invalid JSON body.')
  }

  if (!code.trim()) return errorResponse('SERVER_ERROR', 'No code to explain.')
  if (mode === 'step' && !step) return errorResponse('SERVER_ERROR', 'No step to explain.')
  if (mode === 'error' && !errorText) return errorResponse('SERVER_ERROR', 'No error to explain.')

  const key = `${codeHash(code)}:${mode}:${lang}:${mode === 'error' ? codeHash(errorText) : step?.line ?? '?'}:${
    mode === 'step' ? codeHash(step?.description ?? '') : ''
  }`
  const cached = cacheGet(key)
  if (cached) return Response.json({ ...cached, cached: true })

  // Real generation ahead — charge for the AI use (cache hits above are free).
  const charge = await chargeAiUse(user.id)
  if (!charge.ok) return fail('INSUFFICIENT_XP', `AI help costs ${AI_CHARGE} XP — you don't have enough.`, 402)

  const prompt =
    mode === 'step'
      ? [
          'You are a warm, encouraging programming tutor for absolute beginners.',
          'A student is stepping through this JavaScript program in a visualizer:',
          '```js',
          code,
          '```',
          `They are on line ${step?.line ?? '?'}. The visualizer describes this step as: "${step?.description}" (kind: ${step?.kind}).`,
          step?.vars ? `Current variables: ${step.vars}.` : '',
          'Explain in 2-3 short sentences WHY this step does what it does. Be concrete about the values involved. Do not lecture; imagine you are sitting beside them.',
          aiLangInstruction(lang),
        ]
          .filter(Boolean)
          .join('\n')
      : [
          'You are a warm, encouraging programming tutor for absolute beginners.',
          'A student ran this JavaScript program in a visualizer and it failed:',
          '```js',
          code,
          '```',
          `The error was: "${errorText}".`,
          'In 2-3 short sentences, explain in plain words what went wrong and why. Then, in the tip, give ONE gentle hint that points them toward the fix — do NOT write the corrected code for them.',
          aiLangInstruction(lang),
        ].join('\n')

  try {
    const reply = await generateStructured<ExplainReply>(prompt, SCHEMA, {
      feature: 'JS_MOTION',
      task: 'EXPLAIN',
      userId: user.id,
    })
    const clean: ExplainReply = {
      explanation: String(reply.explanation ?? '').trim(),
      tip: String(reply.tip ?? '').trim(),
    }
    if (!clean.explanation) return errorResponse('SERVER_ERROR', 'The tutor had nothing to say — try again.')
    cacheSet(key, clean)
    return Response.json(clean)
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error'
    return errorResponse('SERVER_ERROR', `The tutor is busy right now: ${message}`)
  }
}
