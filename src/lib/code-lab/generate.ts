// Server-only AI authoring for Code Lab. The model drafts a whole problem —
// description, both-language starters, a reference solution, and test inputs —
// but we NEVER trust its claimed outputs: expected values are recomputed by
// running its solution in the sandbox (computeExpected). If the solution doesn't
// run cleanly the draft is rejected and the admin regenerates.
import 'server-only'

import { Type } from '@google/genai'
import { generateStructured } from '@/lib/hive/providers'
import { computeExpected, gradeAll } from './grade-qjs'
import { XP_BY_DIFFICULTY } from './xp'
import type { ProblemDifficulty, ProblemTests, ProblemType, TestCase } from './types'
import type { ProblemInput } from './admin'

const SCHEMA = {
  type: Type.OBJECT,
  properties: {
    slug: { type: Type.STRING, description: 'kebab-case url slug, e.g. "merge-intervals".' },
    title: { type: Type.STRING, description: 'Short human title.' },
    description: { type: Type.STRING, description: 'Markdown problem statement. Start with an H2 heading. No code fences unless showing example I/O.' },
    constraints: { type: Type.ARRAY, items: { type: Type.STRING }, description: 'Short constraint lines, e.g. "1 <= n <= 1000".' },
    hints: { type: Type.ARRAY, items: { type: Type.STRING }, description: '1-3 progressive hints.' },
    tags: { type: Type.ARRAY, items: { type: Type.STRING }, description: '2-4 topic tags, lowercase.' },
    fnName: { type: Type.STRING, description: 'The entry function name learners implement, e.g. "twoSum". Required for both problem types.' },
    starterJs: { type: Type.STRING, description: 'JavaScript starter: the function signature with an empty body and a "// your code here" comment.' },
    starterTs: { type: Type.STRING, description: 'TypeScript starter: same signature with parameter and return types.' },
    solutionJs: { type: Type.STRING, description: 'A correct JavaScript reference solution defining fnName. Plain source, no fences.' },
    cases: {
      type: Type.ARRAY,
      description: '4-6 test cases. Each has args (array of JSON inputs to the function) and hidden (boolean). Make ~2 visible, the rest hidden. Do NOT include expected values — they are computed from the solution.',
      items: {
        type: Type.OBJECT,
        properties: {
          args: { type: Type.STRING, description: 'A JSON array of arguments to spread into fnName, e.g. "[[2,7,11,15], 9]".' },
          hidden: { type: Type.BOOLEAN, description: 'Whether this case is hidden from the learner.' },
        },
        required: ['args', 'hidden'],
      },
    },
  },
  required: ['slug', 'title', 'description', 'constraints', 'hints', 'tags', 'fnName', 'starterJs', 'starterTs', 'solutionJs', 'cases'],
  propertyOrdering: ['slug', 'title', 'description', 'constraints', 'hints', 'tags', 'fnName', 'starterJs', 'starterTs', 'solutionJs', 'cases'],
}

interface RawDraft {
  slug: string
  title: string
  description: string
  constraints: string[]
  hints: string[]
  tags: string[]
  fnName: string
  starterJs: string
  starterTs: string
  solutionJs: string
  cases: { args: string; hidden: boolean }[]
}

const TYPE_GUIDANCE: Record<ProblemType, string> = {
  FUNCTION_RETURN: 'The function RETURNS a value that is deep-compared to the expected output. It must not rely on console output.',
  CONSOLE_OUTPUT: 'The function prints its answer with console.log (one value per line) and returns nothing; output is compared as text.',
}

export interface GenerateParams {
  topic: string
  difficulty: ProblemDifficulty
  type: ProblemType
  userId: string
}

/** Draft a complete, validated problem. Throws on generation/validation failure. */
export async function generateProblem(params: GenerateParams): Promise<ProblemInput> {
  const prompt = [
    'You are authoring a coding problem for Phi Lab, a programming bootcamp.',
    `Topic / idea: ${params.topic}`,
    `Difficulty: ${params.difficulty}.`,
    `Problem type: ${params.type}. ${TYPE_GUIDANCE[params.type]}`,
    '',
    'Rules:',
    '- The reference solution must define a function named exactly `fnName` and be correct.',
    '- `args` for each case is a JSON array spread into fnName(...args). Keep inputs small and deterministic.',
    '- Do NOT use Math.random or Date — outputs must be reproducible.',
    '- Never reuse a verbatim well-known prompt; write a fresh statement.',
    '- No markdown fences in solutionJs, starterJs or starterTs — plain source only.',
  ].join('\n')

  const raw = await generateStructured<RawDraft>(prompt, SCHEMA, {
    feature: 'CODE_LAB',
    task: 'GENERATE',
    userId: params.userId,
  })

  const parsedCases: TestCase[] = (raw.cases ?? []).map((c, i) => ({
    id: `t${i + 1}`,
    hidden: Boolean(c.hidden),
    args: parseArgs(c.args),
  }))
  if (parsedCases.length === 0) throw new Error('The model produced no test cases.')

  const tests: ProblemTests = { cases: parsedCases }
  const fnName = raw.fnName?.trim() || null

  // Recompute expected outputs from the model's own solution. If it doesn't run,
  // the draft is unusable — surface that rather than shipping wrong tests.
  const filled = await computeExpected(raw.solutionJs, { type: params.type, fnName, tests })
  if (!filled) throw new Error('The generated solution failed to run against its own cases. Try again.')

  // Sanity: the solution must pass every case it just defined.
  const check = await gradeAll(raw.solutionJs, { type: params.type, fnName, tests: filled }, true)
  if (check.verdict !== 'ACCEPTED') throw new Error('The generated solution did not pass its own cases. Try again.')

  return {
    slug: (raw.slug || '').trim().toLowerCase(),
    title: raw.title ?? '',
    difficulty: params.difficulty,
    type: params.type,
    description: raw.description ?? '',
    constraints: raw.constraints ?? [],
    hints: raw.hints ?? [],
    tags: (raw.tags ?? []).map((t) => t.toLowerCase()),
    fnName,
    languages: ['JAVASCRIPT', 'TYPESCRIPT'],
    starterJs: stripFences(raw.starterJs ?? ''),
    starterTs: stripFences(raw.starterTs ?? ''),
    solutionJs: stripFences(raw.solutionJs ?? ''),
    tests: filled,
    xp: XP_BY_DIFFICULTY[params.difficulty],
    published: false,
  }
}

function parseArgs(s: string): unknown[] {
  try {
    const v = JSON.parse(s)
    return Array.isArray(v) ? v : [v]
  } catch {
    return []
  }
}

function stripFences(s: string): string {
  return s.replace(/^```[\w-]*\n?/, '').replace(/\n?```$/, '').trim() + '\n'
}
