import {
  Code2,
  Palette,
  SquareFunction,
  FileCode2,
  Atom,
  Triangle,
  Server,
  Route,
  Database,
  type LucideIcon,
} from 'lucide-react'

export const QUIZ_TOPICS = [
  { id: 'html', label: 'HTML', icon: Code2, color: 'text-orange-500', hint: 'semantic elements, forms, accessibility, DOM structure' },
  { id: 'css', label: 'CSS', icon: Palette, color: 'text-blue-500', hint: 'selectors, box model, flexbox, grid, animations, responsive design' },
  { id: 'javascript', label: 'JavaScript', icon: SquareFunction, color: 'text-yellow-500', hint: 'ES6+, closures, prototypes, async/await, event loop, DOM manipulation' },
  { id: 'typescript', label: 'TypeScript', icon: FileCode2, color: 'text-blue-600', hint: 'types, generics, utility types, declaration files, type guards' },
  { id: 'react', label: 'React', icon: Atom, color: 'text-cyan-500', hint: 'components, hooks, state management, reconciliation, JSX patterns' },
  { id: 'nextjs', label: 'Next.js', icon: Triangle, color: 'text-foreground', hint: 'App Router, server components, API routes, middleware, ISR, SSR' },
  { id: 'nodejs', label: 'Node.js', icon: Server, color: 'text-green-500', hint: 'modules, streams, event loop, file system, child processes' },
  { id: 'expressjs', label: 'Express.js', icon: Route, color: 'text-gray-500', hint: 'middleware, routing, error handling, request/response cycle' },
  { id: 'mongodb', label: 'MongoDB', icon: Database, color: 'text-green-600', hint: 'documents, collections, queries, aggregation, indexing, Mongoose' },
] as const satisfies readonly { id: string; label: string; icon: LucideIcon; color: string; hint: string }[]

export type QuizTopic = (typeof QUIZ_TOPICS)[number]['id']

export const QUIZ_TOPIC_IDS = QUIZ_TOPICS.map((t) => t.id)

export const DIFFICULTY_LEVELS = [
  { id: 'beginner', label: 'Beginner', description: 'Fundamentals and basic concepts' },
  { id: 'intermediate', label: 'Intermediate', description: 'Applied knowledge and patterns' },
  { id: 'advanced', label: 'Advanced', description: 'Deep understanding and edge cases' },
] as const satisfies readonly { id: string; label: string; description: string }[]

export type QuizDifficulty = (typeof DIFFICULTY_LEVELS)[number]['id']

export const QUESTION_COUNTS = [5, 10, 15, 20] as const

export type QuizQuestion = {
  question: string
  options: [string, string, string, string]
  correctIndex: number
  explanation: string
  topic: string
}

export type QuizSessionData = {
  id: string
  topics: string[]
  difficulty: string
  questionCount: number
  questions: QuizQuestion[]
  answers: number[] | null
  score: number | null
  total: number
  xpAwarded: number
  status: string
  createdAt: string
}

export function topicLabel(id: string): string {
  return QUIZ_TOPICS.find((t) => t.id === id)?.label ?? id
}

export function difficultyLabel(id: string): string {
  return DIFFICULTY_LEVELS.find((d) => d.id === id)?.label ?? id
}
