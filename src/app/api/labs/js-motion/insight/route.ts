// Program-level AI features for the JS Motion visualizer, one route, three kinds:
//
//   • 'story'      — a short, vivid narrative of what the whole program does,
//                    shown before playback to "set the imagination frame".
//   • 'complexity' — names the algorithm and its Big-O with a one-line why.
//   • 'challenge'  — generates a similar-but-harder program for the learner to
//                    trace. The CLIENT validates it through the interpreter
//                    before offering it, so a bad generation is silently dropped.
//
// Like the tutor, generation goes through the Hive multi-provider failover
// engine, is stamped under the JS_MOTION feature, and is cached per input.

import { Type } from '@google/genai'
import { requireUser } from '@/lib/auth-server'
import { isSuspended } from '@/lib/admin/suspension'
import { generateStructured } from '@/lib/hive/providers'
import { errorResponse } from '@/lib/interview/errors'
import { chargeAiUse, AI_CHARGE } from '@/lib/visualizer/ai-charge'

export const runtime = 'nodejs'

function fail(code: string, message: string, status: number) {
  return Response.json({ error: code, message }, { status })
}

type Lang = 'banglish' | 'english'
type Kind = 'story' | 'complexity' | 'challenge'

const SCHEMAS: Record<Kind, object> = {
  story: {
    type: Type.OBJECT,
    properties: {
      title: { type: Type.STRING, description: 'A short, catchy title for the story (max 6 words).' },
      story: { type: Type.STRING, description: '2-4 vivid sentences narrating what the program does, using an everyday metaphor. No code.' },
    },
    required: ['title', 'story'],
    propertyOrdering: ['title', 'story'],
  },
  complexity: {
    type: Type.OBJECT,
    properties: {
      name: { type: Type.STRING, description: 'The algorithm/pattern name, e.g. "Bubble sort", "Linear scan", "Recursion". "—" if none obvious.' },
      bigO: { type: Type.STRING, description: 'Time complexity in Big-O, e.g. "O(n²)", "O(n)", "O(1)".' },
      why: { type: Type.STRING, description: 'One short sentence explaining why that complexity, for a beginner.' },
    },
    required: ['name', 'bigO', 'why'],
    propertyOrdering: ['name', 'bigO', 'why'],
  },
  challenge: {
    type: Type.OBJECT,
    properties: {
      title: { type: Type.STRING, description: 'A short title for the challenge program.' },
      idea: { type: Type.STRING, description: 'One sentence on what is harder about it.' },
      code: { type: Type.STRING, description: 'The full JavaScript program. Plain teaching JS only.' },
    },
    required: ['title', 'idea', 'code'],
    propertyOrdering: ['title', 'idea', 'code'],
  },
}

// The non-English option is real Bengali (Bangla script), not Banglish.
function langLine(lang: Lang): string {
  return lang === 'english'
    ? 'Write the prose in clear, simple English.'
    : 'Write the prose ENTIRELY in Bengali (Bangla script, বাংলা) — proper Bengali, NOT Banglish/Latin letters. Keep code identifiers, keywords and Big-O in English.'
}

// The interpreter is a teaching subset. Tell the challenge generator to stay
// inside it so generated programs actually run.
const CHALLENGE_RULES = [
  'Constraints for the code:',
  '- Only use: variables (let/const), functions, arrow functions, if/else, for/while/for-of/for-in, switch, arrays, objects, classes, Map, Set, destructuring, template literals, and console.log.',
  '- Do NOT use: import/require, fetch, the DOM, regular expressions, JSON APIs beyond JSON.stringify/parse, try/catch of thrown errors you rely on, or any browser/node globals.',
  '- The program must be self-contained, terminate quickly (no huge loops), and print something with console.log.',
  '- Keep it short (under ~25 lines) and beginner-friendly — just one clear step up in difficulty.',
].join('\n')

const CACHE = new Map<string, unknown>()
const CACHE_MAX = 200

function codeHash(src: string): string {
  let h = 5381
  for (let i = 0; i < src.length; i++) h = ((h << 5) + h + src.charCodeAt(i)) | 0
  return (h >>> 0).toString(36)
}

export async function POST(request: Request) {
  const user = await requireUser()
  if (!user) return errorResponse('AUTH_REQUIRED')
  if (await isSuspended(user.id)) return errorResponse('SUSPENDED')

  let kind: Kind = 'story'
  let lang: Lang = 'banglish'
  let code = ''
  try {
    const body = await request.json()
    if (body?.kind === 'complexity' || body?.kind === 'challenge') kind = body.kind
    if (body?.lang === 'english') lang = 'english'
    if (typeof body?.code === 'string') code = body.code.slice(0, 4000)
  } catch {
    return errorResponse('SERVER_ERROR', 'Invalid JSON body.')
  }
  if (!code.trim()) return errorResponse('SERVER_ERROR', 'No code to work with.')

  const key = `${codeHash(code)}:${kind}:${lang}`
  const cached = CACHE.get(key)
  if (cached) return Response.json({ ...(cached as object), cached: true })

  // Charge for the AI use before a real generation (cache hits above are free).
  const charge = await chargeAiUse(user.id)
  if (!charge.ok) return fail('INSUFFICIENT_XP', `AI help costs ${AI_CHARGE} XP — you don't have enough.`, 402)

  const prompt =
    kind === 'story'
      ? [
          'You are a warm programming teacher for absolute beginners.',
          'Read this JavaScript program and narrate, before they run it, what it is going to do — like telling a little story with an everyday metaphor (mangoes in a crate, students in a queue, etc.).',
          '```js', code, '```',
          '2-4 sentences. Do not restate the code line by line; capture the intent so they can picture it.',
          langLine(lang),
        ].join('\n')
      : kind === 'complexity'
        ? [
            'You are a CS teacher. Identify the main algorithm/pattern in this JavaScript program and its time complexity.',
            '```js', code, '```',
            'Give the name, the Big-O, and one beginner-friendly sentence on why. If there is no real algorithm, use name "—" and bigO "O(1)".',
            langLine(lang),
          ].join('\n')
        : [
            'You are a programming teacher. Based on this JavaScript program, write a NEW program that teaches the same idea but is one clear step harder — a good next exercise to trace step by step.',
            '```js', code, '```',
            CHALLENGE_RULES,
            langLine(lang),
          ].join('\n')

  try {
    const data = await generateStructured<Record<string, unknown>>(prompt, SCHEMAS[kind], {
      feature: 'JS_MOTION',
      task: kind === 'complexity' ? 'EXPLAIN' : 'GENERATE',
      userId: user.id,
    })
    CACHE.set(key, data)
    while (CACHE.size > CACHE_MAX) {
      const oldest = CACHE.keys().next().value
      if (oldest === undefined) break
      CACHE.delete(oldest)
    }
    return Response.json(data)
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error'
    return errorResponse('SERVER_ERROR', `The AI is busy right now: ${message}`)
  }
}
