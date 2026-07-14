// Start a staked Challenge Mode round. Generates an AI coding task, derives the
// hidden expected outputs by running the AI's reference solution through the
// interpreter (never trusting the model's claimed answers), stakes the XP, and
// stores everything server-side. The client only ever sees the prompt + one
// sample — never the tests or the answer.

import { Type } from '@google/genai'
import { requireUser } from '@/lib/auth-server'
import { isSuspended } from '@/lib/admin/suspension'
import { generateStructured } from '@/lib/hive/providers'
import { spendXp } from '@/lib/gamification/award'
import { prisma } from '@/lib/prisma'
import { errorResponse } from '@/lib/interview/errors'
import {
  DIFFICULTY, MODE, isDifficulty, isMode, isTopic, topicLabel,
  type Difficulty, type Mode, type ChallengeSource, type ChallengeTopic,
} from '@/lib/visualizer/challenge'
import { computeExpected, runFn } from '@/lib/visualizer/grade'
import { getProblemProgress } from '@/lib/visualizer/problems-progress'
import { CHALLENGE_GATE_PERCENT } from '@/lib/visualizer/problems'
import { isLabLang, type LabLang } from '@/lib/visualizer/lang'

export const runtime = 'nodejs'

function fail(code: string, message: string, status: number) {
  return Response.json({ error: code, message }, { status })
}

const SCHEMA = {
  type: Type.OBJECT,
  properties: {
    fnName: { type: Type.STRING, description: 'The function name the learner must implement, e.g. "solve".' },
    signature: { type: Type.STRING, description: 'The call signature, e.g. "solve(nums)".' },
    prompt: { type: Type.STRING, description: 'The task description. Say clearly what the function takes and returns. Keep code identifiers in English. Write it in the language requested in the prompt.' },
    sampleArgsJson: { type: Type.STRING, description: 'A JSON array of the arguments for ONE visible example call, e.g. "[5]" or "[[3,1,2]]".' },
    testArgsJson: {
      type: Type.ARRAY,
      description: '5-7 hidden test inputs. Each item is a JSON array of arguments, e.g. "[9]". Include edge cases.',
      items: { type: Type.STRING },
    },
    referenceSolution: { type: Type.STRING, description: 'A correct, self-contained JavaScript solution that DEFINES the function. Teaching-subset JS only (no import/DOM/regex/fetch). Deterministic. The return value must be JSON-serializable.' },
  },
  required: ['fnName', 'signature', 'prompt', 'sampleArgsJson', 'testArgsJson', 'referenceSolution'],
  propertyOrdering: ['fnName', 'signature', 'prompt', 'sampleArgsJson', 'testArgsJson', 'referenceSolution'],
}

const DIFF_GUIDE: Record<Difficulty, string> = {
  easy: 'Beginner level: one loop or simple condition. Small inputs.',
  medium: 'Intermediate: nested loops, a helper, or array/string manipulation.',
  hard: 'Advanced-for-a-beginner: recursion, a two-pass algorithm, or careful edge handling — but still short.',
}

interface Gen {
  fnName: string
  signature: string
  prompt: string
  sampleArgsJson: string
  testArgsJson: string[]
  referenceSolution: string
}

function parseArgs(json: string): unknown[] | null {
  try {
    const v = JSON.parse(json)
    return Array.isArray(v) ? v : null
  } catch {
    return null
  }
}

export async function POST(request: Request) {
  const user = await requireUser()
  if (!user) return errorResponse('AUTH_REQUIRED')
  if (await isSuspended(user.id)) return errorResponse('SUSPENDED')

  let difficulty: Difficulty = 'easy'
  let mode: Mode = 'oneshot'
  let lang: LabLang = 'bengali'
  let code = ''
  let source: ChallengeSource = 'code'
  let topics: ChallengeTopic[] = []
  try {
    const body = await request.json()
    if (isDifficulty(body?.difficulty)) difficulty = body.difficulty
    if (isMode(body?.mode)) mode = body.mode
    if (isLabLang(body?.lang)) lang = body.lang
    if (typeof body?.code === 'string') code = body.code.slice(0, 4000)
    if (body?.source === 'topics') source = 'topics'
    if (Array.isArray(body?.topics)) {
      // Trust only catalog ids; cap at 4 so the prompt stays focused.
      topics = body.topics.filter(isTopic).slice(0, 4)
    }
  } catch {
    return fail('BAD_REQUEST', 'Invalid JSON body.', 400)
  }

  // One active challenge at a time — the client should resume via /active.
  const existing = await prisma.challengeAttempt.findFirst({ where: { userId: user.id, status: 'active' } })
  if (existing) return fail('ACTIVE_EXISTS', 'You already have an active challenge.', 409)

  // The curriculum gate. The setup card greys the button out too, but this is
  // the boundary that matters — a POST here is all it takes to bypass the UI.
  const progress = await getProblemProgress(user.id)
  if (!progress.challengeUnlocked) {
    const need: string[] = []
    if (progress.remainingForGate > 0) need.push(`${progress.remainingForGate} more problem${progress.remainingForGate === 1 ? '' : 's'}`)
    if (!progress.gateTopicComplete) need.push('the Functions topic')
    return fail(
      'CHALLENGE_LOCKED',
      `Challenge mode unlocks at ${Math.round(CHALLENGE_GATE_PERCENT * 100)}% of the problems plus the Functions topic. You still need ${need.join(' and ')}.`,
      403,
    )
  }

  const stake = DIFFICULTY[difficulty].stake
  const me = await prisma.user.findUnique({ where: { id: user.id }, select: { xp: true } })
  if ((me?.xp ?? 0) < stake) return fail('INSUFFICIENT_XP', `You need ${stake} XP to stake this challenge.`, 400)

  // Decide what the challenge is drawn from. Topics win when the learner picked
  // them; otherwise fall back to their code, then to a generic exercise.
  const basedOnCode = code.replace(/\/\/.*$/gm, '').trim()
  const topicLine =
    source === 'topics' && topics.length
      ? `Base the challenge on these topic(s): ${topics.map(topicLabel).join(', ')}. Combine them naturally if more than one.`
      : basedOnCode
        ? `Base the topic loosely on this program the learner was just working on:\n\`\`\`js\n${code}\n\`\`\``
        : 'The learner has no code yet — pick a fresh, classic beginner exercise (arrays, strings, numbers, loops).'
  const prompt = [
    'You are a programming teacher creating a short coding challenge for a beginner to solve and trace step by step.',
    topicLine,
    `Difficulty: ${DIFFICULTY[difficulty].label}. ${DIFF_GUIDE[difficulty]}`,
    'Design a single function the learner must implement. Give a clear Bengali task description, one visible sample input, 5-7 hidden test inputs (include edge cases), and a correct reference solution.',
    'Constraints on the reference solution AND anything you expect the learner to write: only variables, functions, if/else, loops (for/while/for-of/for-in), switch, arrays, objects, classes, Map, Set, destructuring, template literals, and console.log. NO import/require, DOM, fetch, or regular expressions. Must terminate quickly. The function must RETURN its result (not console.log it), and the return must be JSON-serializable.',
    lang === 'english'
      ? 'Write the "prompt" task description in clear, simple English.'
      : 'Write the "prompt" task description ENTIRELY in Bengali (Bangla script, বাংলা) — proper Bengali, NOT Banglish/Latin. Keep code identifiers in English.',
  ].join('\n')

  // Generate, then verify the reference actually runs for every test input.
  // Retry a few times before giving up — a bad generation is silently discarded.
  let gen: Gen | null = null
  let tests: { args: unknown[]; expected: string }[] | null = null
  let sampleArgs: unknown[] | null = null
  let sampleOutput: string | null = null
  for (let attempt = 0; attempt < 3 && !tests; attempt++) {
    try {
      const g = await generateStructured<Gen>(prompt, SCHEMA, { feature: 'JS_MOTION', task: 'GENERATE', userId: user.id })
      if (!g?.fnName || !g?.referenceSolution || !Array.isArray(g.testArgsJson)) continue
      const testArgs = g.testArgsJson.map(parseArgs).filter((a): a is unknown[] => a !== null)
      sampleArgs = parseArgs(g.sampleArgsJson) ?? testArgs[0] ?? null
      if (!testArgs.length || !sampleArgs) continue
      const computed = await computeExpected(g.referenceSolution, g.fnName, testArgs)
      const sOut = await runFn(g.referenceSolution, g.fnName, sampleArgs)
      if (!computed || sOut === null) continue
      gen = g
      tests = computed
      sampleOutput = sOut
    } catch {
      // provider error — fall through to retry / final failure
    }
  }

  if (!gen || !tests || sampleArgs === null || sampleOutput === null) {
    return fail('GEN_FAILED', 'Could not craft a clean challenge right now. Please try again.', 503)
  }

  // Stake the XP (idempotency key is unique per attempt — use a fresh id first).
  const created = await prisma.challengeAttempt.create({
    data: {
      userId: user.id,
      difficulty,
      mode,
      lang,
      stake,
      status: 'active',
      fnName: gen.fnName,
      prompt: gen.prompt,
      sampleInput: sampleArgs as object,
      sampleOutput,
      tests: tests as object,
      referenceSolution: gen.referenceSolution,
      attemptsUsed: 0,
      maxAttempts: MODE[mode].maxAttempts,
      expiresAt: MODE[mode].timerMs ? new Date(Date.now() + MODE[mode].timerMs!) : null,
    },
  })

  const staked = await spendXp({ userId: user.id, reason: 'viz_challenge_stake', sourceId: created.id, amount: stake })
  if (!staked.spent) {
    // Balance vanished between the check and the debit — void the attempt.
    await prisma.challengeAttempt.update({ where: { id: created.id }, data: { status: 'lost' } })
    return fail('INSUFFICIENT_XP', 'Not enough XP to stake this challenge.', 400)
  }

  // Current win streak entering this round — consecutive prior wins, newest-first.
  const recent = await prisma.challengeAttempt.findMany({
    where: { userId: user.id, status: { in: ['won', 'lost'] } },
    orderBy: { createdAt: 'desc' },
    select: { status: true },
    take: 20,
  })
  let currentStreak = 0
  for (const r of recent) { if (r.status === 'won') currentStreak++; else break }

  return Response.json({
    attemptId: created.id,
    difficulty,
    mode,
    lang,
    stake,
    fnName: gen.fnName,
    signature: gen.signature,
    prompt: gen.prompt,
    sample: { input: sampleArgs, output: sampleOutput },
    maxAttempts: created.maxAttempts,
    attemptsUsed: 0,
    currentStreak,
    expiresAt: created.expiresAt,
    balance: staked.balance,
  })
}
