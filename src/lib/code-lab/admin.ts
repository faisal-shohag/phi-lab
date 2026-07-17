// Server-only Code Lab authoring: CRUD, solution validation, and demo seeding.
// Admin-gated at the route layer (withAdmin). The reference solution and hidden
// cases live only in these server paths.
import 'server-only'

import { prisma } from '@/lib/prisma'
import { gradeAll, computeExpected, type GradeInput } from './grade-qjs'
import { XP_BY_DIFFICULTY } from './xp'
import { DEMO_PROBLEMS } from './demo-problems'
import type { CaseResult, CodeLanguage, ProblemDifficulty, ProblemTests, ProblemType } from './types'

export interface ProblemInput {
  slug: string
  title: string
  difficulty: ProblemDifficulty
  type: ProblemType
  description: string
  constraints: string[]
  hints: string[]
  tags: string[]
  fnName: string | null
  languages: CodeLanguage[]
  starterJs: string
  starterTs: string
  solutionJs: string
  tests: ProblemTests
  xp?: number
  published?: boolean
  order?: number
}

const ALL_LANGUAGES: CodeLanguage[] = ['JAVASCRIPT', 'TYPESCRIPT']

const slugRe = /^[a-z0-9]+(?:-[a-z0-9]+)*$/

function normalize(input: ProblemInput): ProblemInput {
  const type = input.type
  const fnName = type === 'FUNCTION_RETURN' ? (input.fnName || null) : (input.fnName || null)
  const languages = (input.languages ?? []).filter((l) => ALL_LANGUAGES.includes(l))
  return {
    ...input,
    slug: input.slug.trim().toLowerCase(),
    fnName,
    languages: languages.length > 0 ? languages : ALL_LANGUAGES,
    constraints: input.constraints ?? [],
    hints: input.hints ?? [],
    tags: input.tags ?? [],
    tests: { cases: input.tests?.cases ?? [] },
  }
}

function validateShape(p: ProblemInput): string | null {
  if (!slugRe.test(p.slug)) return 'Slug must be kebab-case (lowercase letters, numbers, hyphens).'
  if (!p.title.trim()) return 'Title is required.'
  if (!p.description.trim()) return 'Description is required.'
  if (p.type === 'FUNCTION_RETURN' && !p.fnName) return 'Function-return problems need an entry function name.'
  if (p.tests.cases.length === 0) return 'At least one test case is required.'
  for (const c of p.tests.cases) {
    if (!c.id) return 'Every test case needs an id.'
    if (p.type === 'FUNCTION_RETURN' && c.expected === undefined) return `Case ${c.id} is missing an expected value.`
    if (p.type === 'CONSOLE_OUTPUT' && c.expectedStdout === undefined) return `Case ${c.id} is missing expected stdout.`
  }
  return null
}

export interface ProblemRow {
  id: string
  slug: string
  title: string
  difficulty: ProblemDifficulty
  type: ProblemType
  published: boolean
  submissions: number
}

export async function listProblems(): Promise<ProblemRow[]> {
  const rows = await prisma.problem.findMany({
    orderBy: [{ order: 'asc' }, { createdAt: 'asc' }],
    select: {
      id: true,
      slug: true,
      title: true,
      difficulty: true,
      type: true,
      published: true,
      _count: { select: { submissions: true } },
    },
  })
  return rows.map((p) => ({
    id: p.id,
    slug: p.slug,
    title: p.title,
    difficulty: p.difficulty,
    type: p.type,
    published: p.published,
    submissions: p._count.submissions,
  }))
}

export async function getProblem(id: string) {
  return prisma.problem.findUnique({ where: { id } })
}

export async function createProblem(input: ProblemInput, createdById: string) {
  const p = normalize(input)
  const err = validateShape(p)
  if (err) return { error: err as string }
  const created = await prisma.problem.create({
    data: {
      slug: p.slug,
      title: p.title,
      difficulty: p.difficulty,
      type: p.type,
      description: p.description,
      constraints: p.constraints,
      hints: p.hints,
      tags: p.tags,
      fnName: p.fnName,
      languages: p.languages,
      starterJs: p.starterJs,
      starterTs: p.starterTs,
      solutionJs: p.solutionJs,
      tests: p.tests as unknown as object,
      xp: p.xp ?? XP_BY_DIFFICULTY[p.difficulty],
      published: p.published ?? false,
      order: p.order ?? 0,
      createdById,
    },
  })
  return { id: created.id }
}

export async function updateProblem(id: string, input: Partial<ProblemInput> & { published?: boolean }) {
  const existing = await prisma.problem.findUnique({ where: { id } })
  if (!existing) return { error: 'NOT_FOUND' as const }

  // Merge over the existing record so a partial edit (e.g. publish toggle) is
  // still validated against the full shape.
  const merged = normalize({
    slug: input.slug ?? existing.slug,
    title: input.title ?? existing.title,
    difficulty: input.difficulty ?? existing.difficulty,
    type: input.type ?? existing.type,
    description: input.description ?? existing.description,
    constraints: input.constraints ?? existing.constraints,
    hints: input.hints ?? existing.hints,
    tags: input.tags ?? existing.tags,
    fnName: input.fnName !== undefined ? input.fnName : existing.fnName,
    languages: input.languages ?? existing.languages,
    starterJs: input.starterJs ?? existing.starterJs,
    starterTs: input.starterTs ?? existing.starterTs,
    solutionJs: input.solutionJs ?? existing.solutionJs,
    tests: input.tests ?? (existing.tests as unknown as ProblemTests),
    xp: input.xp ?? existing.xp,
    published: input.published ?? existing.published,
    order: input.order ?? existing.order,
  })
  const err = validateShape(merged)
  if (err) return { error: err }

  await prisma.problem.update({
    where: { id },
    data: {
      slug: merged.slug,
      title: merged.title,
      difficulty: merged.difficulty,
      type: merged.type,
      description: merged.description,
      constraints: merged.constraints,
      hints: merged.hints,
      tags: merged.tags,
      fnName: merged.fnName,
      languages: merged.languages,
      starterJs: merged.starterJs,
      starterTs: merged.starterTs,
      solutionJs: merged.solutionJs,
      tests: merged.tests as unknown as object,
      xp: merged.xp ?? XP_BY_DIFFICULTY[merged.difficulty],
      published: merged.published ?? false,
      order: merged.order ?? 0,
    },
  })
  return { id }
}

export async function deleteProblem(id: string) {
  await prisma.problem.delete({ where: { id } })
}

export interface ValidateResult {
  ok: boolean
  results: CaseResult[]
  passedCount: number
  totalCount: number
  error?: string
  /** Expected values recomputed from the solution, offered for one-click apply. */
  computed?: ProblemTests
}

/** Run the reference solution against the cases; every case must pass. */
export async function validateSolution(
  type: ProblemType,
  fnName: string | null,
  solutionJs: string,
  tests: ProblemTests,
): Promise<ValidateResult> {
  const input: GradeInput = { type, fnName, tests }
  const summary = await gradeAll(solutionJs, input, true)
  const computed = (await computeExpected(solutionJs, input)) ?? undefined
  return {
    ok: summary.verdict === 'ACCEPTED',
    results: summary.results,
    passedCount: summary.passedCount,
    totalCount: summary.totalCount,
    error: summary.error,
    computed,
  }
}

/** Idempotent upsert-by-slug of the demo set. Returns how many were touched. */
export async function seedDemoProblems(createdById: string): Promise<number> {
  for (const d of DEMO_PROBLEMS) {
    const data = {
      title: d.title,
      difficulty: d.difficulty,
      type: d.type,
      description: d.description,
      constraints: d.constraints,
      hints: d.hints,
      tags: d.tags,
      fnName: d.fnName,
      languages: ALL_LANGUAGES,
      starterJs: d.starterJs,
      starterTs: d.starterTs,
      solutionJs: d.solutionJs,
      tests: d.tests as unknown as object,
      xp: XP_BY_DIFFICULTY[d.difficulty],
      published: true,
      order: d.order,
    }
    await prisma.problem.upsert({
      where: { slug: d.slug },
      create: { slug: d.slug, createdById, ...data },
      update: data,
    })
  }
  return DEMO_PROBLEMS.length
}
