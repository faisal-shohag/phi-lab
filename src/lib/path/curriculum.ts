// The Path — the curriculum itself. Pure data + pure helpers, no DB, no network:
// importable from a client component as safely as from a route handler.
//
// A node is NOT a lesson. Phi Lab already teaches — the labs do that. A node is
// a *mastery gate*: a small set of steps, each one satisfied by evidence a lab
// already records. The shape of every node is the same loop:
//
//   see it   → step a JS Motion demo to its final frame
//   build it → win a staked coding challenge
//   explain it → teach it back in the Feynman lab and clear a clarity bar
//   say it   → (later modules) talk about it in English, or survive an interview
//
// You cannot finish a node by clicking through it. You finish it by doing the
// thing and being able to explain the thing. That is the whole design.
//
// Adding a node is a code change here — no migration, no seed. See the comment
// block above `model PathProgress` in prisma/schema.prisma for why.

import type { Difficulty } from '@/lib/visualizer/challenge'

/** How a step is satisfied. Each kind maps to a lab that already exists. */
export type StepKind = 'viz' | 'challenge' | 'feynman' | 'english' | 'interview' | 'analogy' | 'quiz' | 'code' | 'pixel'

export interface PathStep {
  kind: StepKind
  /** Stable within its node — used as the quest item key. */
  id: string
  label: string
  /** Deep link into the lab that satisfies it. */
  href: string
  /** Rough minutes, so the daily quest can budget a session. */
  minutes: number
  /** Nice-to-have: does not block mastery, still earns its lab's XP. */
  optional?: boolean

  // ── Matchers. Exactly the fields the step's kind needs. ──
  /** viz: the DEMO_EXAMPLES id to step through, and the concept it credits. */
  demoId?: string
  /** viz: VIZ_CONCEPTS key. feynman: CONCEPTS id. analogy: free text. */
  concept?: string
  /** challenge: the minimum difficulty of the win that counts. */
  difficulty?: Difficulty
  /** english: SCENARIOS id. */
  scenario?: string
  /** interview: TOPICS id. quiz: QUIZ_TOPICS id the quiz must have covered. */
  topic?: string
  /** interview: LEVELS id. quiz: DIFFICULTY_LEVELS id (informational; not matched). */
  level?: string
  /** feynman clarity / english + interview / quiz score the run must clear. */
  minScore?: number
  /** code: the Problem.slug an accepted Code Lab submission must target. */
  slug?: string
  /** pixel: the Pixel Lab challenge id a submission must have cleared. */
  pixelId?: string
  /** pixel: the minimum tier the submission must have reached. Default 'standing'. */
  tier?: string
}

export interface PathNode {
  id: string
  title: string
  blurb: string
  /** lucide-react icon name, resolved in the UI. */
  icon: string
  /** Node ids that must be mastered before this one unlocks. */
  requires: string[]
  steps: PathStep[]
  /** Bonus XP on mastery, on top of whatever the labs paid out along the way. */
  xp: number
  /**
   * A module gate. Bosses demand a live interview and a hard challenge, and they
   * are the only nodes that can send you backwards: fail one and the AI's weekly
   * plan pulls the module's weak nodes back into focus.
   */
  boss?: boolean
}

export interface PathModule {
  id: string
  title: string
  subtitle: string
  /** Tailwind gradient, matching the badge medallion convention. */
  tint: string
  nodes: PathNode[]
}

// Feynman clarity is scored generously; 60 is "you actually explained it", not
// "you said the word closure". Interview/English bars sit lower because those
// runs grade delivery too, and a nervous first attempt should still count.
const CLARITY_BAR = 60
const SPEAK_BAR = 50
// A quiz is multiple-choice, so the bar sits higher than a spoken run — 70/100
// is "you actually knew most of it", not a coin-flip pass. Quiz alone is interim
// evidence; nodes that also carry a build/explain step still need those.
const QUIZ_BAR = 70

const viz = (id: string, demoId: string, concept: string, label: string): PathStep => ({
  kind: 'viz',
  id,
  label,
  href: `/labs/js-motion?demo=${demoId}`,
  minutes: 8,
  demoId,
  concept,
})

const build = (difficulty: Difficulty, label: string): PathStep => ({
  kind: 'challenge',
  id: `build-${difficulty}`,
  label,
  href: '/labs/js-motion?challenge=1',
  minutes: 15,
  difficulty,
})

const explain = (concept: string, label: string): PathStep => ({
  kind: 'feynman',
  id: `explain-${concept}`,
  label,
  href: `/labs/feynman?concept=${concept}`,
  minutes: 5,
  concept,
  minScore: CLARITY_BAR,
})

const speak = (scenario: string, label: string): PathStep => ({
  kind: 'english',
  id: `speak-${scenario}`,
  label,
  href: `/labs/english?scenario=${scenario}`,
  minutes: 5,
  scenario,
  minScore: SPEAK_BAR,
})

const grill = (topic: string, level: string, label: string, minScore = SPEAK_BAR): PathStep => ({
  kind: 'interview',
  id: `grill-${topic}-${level}`,
  label,
  href: `/labs/interview?topic=${topic}&level=${level}`,
  minutes: 12,
  topic,
  level,
  minScore,
})

// A quiz is fast, interim proof: a completed Quiz Lab run that covered `topic`
// and cleared the bar. Cheap enough to sprinkle anywhere; it never fully masters
// a node alone in modules that also demand a build/explain step.
const quiz = (topic: string, level: string, label: string, minScore = QUIZ_BAR): PathStep => ({
  kind: 'quiz',
  id: `quiz-${topic}-${level}`,
  label,
  href: `/labs/quiz?topic=${topic}&difficulty=${level}`,
  minutes: 6,
  topic,
  level,
  minScore,
})

// Solve a specific Code Lab problem. Unlike a raw challenge win (fungible), this
// names its problem by slug, so it credits exactly the node that asked for it.
const solve = (slug: string, label: string): PathStep => ({
  kind: 'code',
  id: `solve-${slug}`,
  label,
  href: `/labs/code-lab/${slug}`,
  minutes: 20,
  slug,
})

// Clear a Pixel Lab challenge to at least `tier`. Names its challenge by id.
const pixel = (pixelId: string, label: string, tier: string = 'standing'): PathStep => ({
  kind: 'pixel',
  id: `pixel-${pixelId}`,
  label,
  href: `/labs/pixel-lab?challenge=${pixelId}`,
  minutes: 20,
  pixelId,
  tier,
})

export const MODULES: PathModule[] = [
  // ── 1 ────────────────────────────────────────────────────────────────────
  {
    id: 'foundations',
    title: 'Foundations',
    subtitle: 'Make the machine do what you meant.',
    tint: 'from-emerald-400 to-teal-600',
    nodes: [
      {
        id: 'conditionals',
        title: 'Conditionals',
        blurb: 'Branching: if, else, and the truthiness that trips everyone up.',
        icon: 'GitFork',
        requires: [],
        xp: 30,
        steps: [
          viz('see', 'conditional', 'conditionals', 'Step through the Conditionals demo'),
          build('easy', 'Win an Easy challenge'),
        ],
      },
      {
        id: 'loops',
        title: 'Loops',
        blurb: 'for, while, for…of — and knowing which one the job wants.',
        icon: 'Repeat',
        requires: ['conditionals'],
        xp: 30,
        steps: [
          viz('see', 'for-loop-sum', 'loops', 'Step through the For Loop demo'),
          viz('see-nested', 'nested-loops', 'loops', 'Step through Nested Loops'),
          build('easy', 'Win an Easy challenge'),
        ],
      },
      {
        id: 'arrays',
        title: 'Arrays',
        blurb: 'Indexing, iterating, mutating — and why mutation bites.',
        icon: 'Brackets',
        requires: ['loops'],
        xp: 35,
        steps: [
          viz('see', 'array-max', 'arrays', 'Step through Find Max'),
          viz('see-mutate', 'array-mutation', 'arrays', 'Step through Array Mutation'),
          build('easy', 'Win an Easy challenge'),
          { ...solve('sum-array', 'Solve “Sum of an Array” in Code Lab'), optional: true },
        ],
      },
      {
        id: 'functions',
        title: 'Functions',
        blurb: 'Arguments, returns, and the call stack underneath them.',
        icon: 'FunctionSquare',
        requires: ['arrays'],
        xp: 40,
        steps: [
          viz('see', 'function-call', 'functions', 'Step through Function Call'),
          build('medium', 'Win a Medium challenge'),
          explain('scope', 'Teach back: Scope'),
        ],
      },
      {
        id: 'foundations-boss',
        title: 'Boss: FizzBuzz & Friends',
        blurb: 'Prove the basics under pressure: a live interview and a real challenge.',
        icon: 'Swords',
        requires: ['functions'],
        xp: 120,
        boss: true,
        steps: [
          viz('see', 'fizzbuzz', 'conditionals', 'Step through FizzBuzz'),
          build('medium', 'Win a Medium challenge'),
          { ...solve('fizzbuzz', 'Solve “FizzBuzz” in Code Lab'), optional: true },
          grill('javascript', 'easy', 'Survive an Easy JavaScript interview'),
        ],
      },
    ],
  },

  // ── 2 ────────────────────────────────────────────────────────────────────
  {
    id: 'thinking',
    title: 'Thinking in Code',
    subtitle: 'Stop guessing. Start reasoning about cost.',
    tint: 'from-sky-400 to-blue-600',
    nodes: [
      {
        id: 'recursion',
        title: 'Recursion',
        blurb: 'A function that calls itself — and the base case that saves it.',
        icon: 'GitBranch',
        requires: ['foundations-boss'],
        xp: 50,
        steps: [
          viz('see', 'recursion', 'recursion', 'Step through Recursion — Factorial'),
          explain('recursion', 'Teach back: Recursion'),
          build('medium', 'Win a Medium challenge'),
        ],
      },
      {
        id: 'sorting',
        title: 'Sorting',
        blurb: 'Bubble sort by hand, so every sort after it makes sense.',
        icon: 'ArrowDownWideNarrow',
        requires: ['recursion'],
        xp: 45,
        steps: [
          viz('see', 'bubble-sort', 'sorting', 'Step through Bubble Sort'),
          viz('see-two-pointer', 'two-pointer', 'two-pointers', 'Step through Two Pointers'),
          build('medium', 'Win a Medium challenge'),
        ],
      },
      {
        id: 'big-o',
        title: 'Big-O',
        blurb: 'How your solution behaves when the input stops being small.',
        icon: 'TrendingUp',
        requires: ['sorting'],
        xp: 55,
        steps: [
          explain('big-o', 'Teach back: Big-O Notation'),
          build('hard', 'Win a Hard challenge'),
          { kind: 'analogy', id: 'analogy-big-o', label: 'Make an analogy card for Big-O', href: '/labs/analogies', minutes: 4, concept: 'big-o', optional: true },
        ],
      },
      {
        id: 'thinking-boss',
        title: 'Boss: Problem Solver',
        blurb: 'A hard challenge and a medium interview. No hints, no mercy.',
        icon: 'Swords',
        requires: ['big-o'],
        xp: 150,
        boss: true,
        steps: [
          build('hard', 'Win a Hard challenge'),
          grill('javascript', 'medium', 'Survive a Medium JavaScript interview', 55),
        ],
      },
    ],
  },

  // ── 3 ────────────────────────────────────────────────────────────────────
  {
    id: 'javascript',
    title: 'JavaScript, Properly',
    subtitle: 'The parts that separate a coder from a JavaScript developer.',
    tint: 'from-amber-400 to-orange-600',
    nodes: [
      {
        id: 'scope-hoisting',
        title: 'Scope & Hoisting',
        blurb: 'Why your variable is undefined before the line that sets it.',
        icon: 'Braces',
        requires: ['thinking-boss'],
        xp: 50,
        steps: [
          viz('see', 'hoisting', 'hoisting', 'Step through Hoisting & TDZ'),
          explain('hoisting', 'Teach back: Hoisting'),
        ],
      },
      {
        id: 'closures',
        title: 'Closures',
        blurb: 'The single most-asked interview concept in JavaScript.',
        icon: 'Lasso',
        requires: ['scope-hoisting'],
        xp: 65,
        steps: [
          viz('see', 'closure', 'closures', 'Step through Closures — Counter'),
          explain('closures', 'Teach back: Closures'),
          build('medium', 'Win a Medium challenge'),
        ],
      },
      {
        id: 'references',
        title: 'Value vs Reference',
        blurb: 'Why copying an object is nothing like copying a number.',
        icon: 'Link2',
        requires: ['scope-hoisting'],
        xp: 45,
        steps: [
          viz('see', 'aliasing', 'references', 'Step through References & Aliasing'),
          explain('references', 'Teach back: Value vs Reference'),
        ],
      },
      {
        id: 'objects-oop',
        title: 'Objects & Classes',
        blurb: 'Prototypes, `this`, and the class syntax sitting on top of them.',
        icon: 'Boxes',
        requires: ['references'],
        xp: 60,
        steps: [
          viz('see', 'classes', 'oop', 'Step through Classes & Inheritance'),
          explain('this', 'Teach back: the `this` keyword'),
          explain('prototypes', 'Teach back: Prototypes'),
          build('medium', 'Win a Medium challenge'),
        ],
      },
      {
        id: 'js-boss',
        title: 'Boss: JavaScript Interview',
        blurb: 'Closures, this, prototypes — spoken, out loud, under pressure.',
        icon: 'Swords',
        requires: ['closures', 'objects-oop'],
        xp: 180,
        boss: true,
        steps: [
          grill('javascript', 'expert', 'Survive an Expert JavaScript interview', 60),
          speak('explain-code', 'Explain your code in English'),
        ],
      },
    ],
  },

  // ── 4 ────────────────────────────────────────────────────────────────────
  {
    id: 'async',
    title: 'Async JavaScript',
    subtitle: 'One thread, and still nothing blocks. Learn how.',
    tint: 'from-violet-400 to-fuchsia-600',
    nodes: [
      {
        id: 'event-loop',
        title: 'The Event Loop',
        blurb: 'Call stack, task queue, microtasks — the order things actually run.',
        icon: 'Timer',
        requires: ['js-boss'],
        xp: 70,
        steps: [
          viz('see', 'event-loop', 'event-loop', 'Step through Event Loop — Async Order'),
          explain('event-loop', 'Teach back: the Event Loop'),
          { kind: 'analogy', id: 'analogy-event-loop', label: 'Make an analogy card for the event loop', href: '/labs/analogies', minutes: 4, concept: 'event loop', optional: true },
        ],
      },
      {
        id: 'promises',
        title: 'Promises & async/await',
        blurb: 'What await really pauses, and what it very much does not.',
        icon: 'Hourglass',
        requires: ['event-loop'],
        xp: 70,
        steps: [
          explain('promises', 'Teach back: Promises & async/await'),
          build('hard', 'Win a Hard challenge'),
        ],
      },
    ],
  },

  // ── 5 ────────────────────────────────────────────────────────────────────
  {
    id: 'web',
    title: 'The Web',
    subtitle: 'The document, the styles, and the interview questions about both.',
    tint: 'from-rose-400 to-red-600',
    nodes: [
      {
        id: 'html',
        title: 'HTML & Semantics',
        blurb: 'Structure, forms, accessibility — the part everyone skips and regrets.',
        icon: 'FileCode2',
        requires: ['promises'],
        xp: 45,
        steps: [
          pixel('found-01', 'Rebuild a layout in Pixel Lab'),
          quiz('html', 'beginner', 'Pass an HTML quiz'),
          grill('html', 'easy', 'Survive an Easy HTML interview'),
        ],
      },
      {
        id: 'css',
        title: 'CSS & Layout',
        blurb: 'Specificity, flexbox, grid, responsive design.',
        icon: 'Palette',
        requires: ['html'],
        xp: 55,
        steps: [
          pixel('navbar-01', 'Rebuild a navbar in Pixel Lab', 'close'),
          quiz('css', 'intermediate', 'Pass a CSS quiz'),
          grill('css', 'medium', 'Survive a Medium CSS interview'),
          speak('defend-decision', 'Defend a layout decision in English'),
        ],
      },
    ],
  },

  // ── 6 ────────────────────────────────────────────────────────────────────
  {
    id: 'react',
    title: 'React & Next.js',
    subtitle: 'Components, state, and rendering on somebody else’s machine.',
    tint: 'from-cyan-400 to-sky-600',
    nodes: [
      {
        id: 'react-core',
        title: 'React Core',
        blurb: 'Hooks, state, effects, and why your component rendered twice.',
        icon: 'Atom',
        requires: ['css'],
        xp: 80,
        steps: [
          quiz('react', 'intermediate', 'Pass a React quiz'),
          grill('react', 'medium', 'Survive a Medium React interview'),
          speak('standup', 'Give a standup update in English'),
        ],
      },
      {
        id: 'nextjs',
        title: 'Next.js',
        blurb: 'App Router, server components, data fetching, caching.',
        icon: 'PanelsTopLeft',
        requires: ['react-core'],
        xp: 90,
        steps: [
          quiz('nextjs', 'intermediate', 'Pass a Next.js quiz'),
          grill('nextjs', 'medium', 'Survive a Medium Next.js interview'),
        ],
      },
      {
        id: 'react-boss',
        title: 'Boss: Frontend Engineer',
        blurb: 'An expert React grilling. This is the real interview.',
        icon: 'Swords',
        requires: ['nextjs'],
        xp: 200,
        boss: true,
        steps: [grill('react', 'expert', 'Survive an Expert React interview', 60)],
      },
    ],
  },

  // ── 7 ────────────────────────────────────────────────────────────────────
  {
    id: 'backend',
    title: 'Backend',
    subtitle: 'The server, the database, and who is allowed to talk to them.',
    tint: 'from-lime-400 to-green-600',
    nodes: [
      {
        id: 'node-express',
        title: 'Node & Express',
        blurb: 'Runtime, routing, middleware, error handling, REST design.',
        icon: 'Server',
        requires: ['react-boss'],
        xp: 85,
        steps: [
          quiz('nodejs', 'intermediate', 'Pass a Node.js quiz'),
          grill('nodejs', 'medium', 'Survive a Medium Node.js interview'),
          grill('express', 'medium', 'Survive a Medium Express interview'),
        ],
      },
      {
        id: 'mongodb',
        title: 'MongoDB',
        blurb: 'Documents, indexes, aggregation, schema design.',
        icon: 'Database',
        requires: ['node-express'],
        xp: 75,
        steps: [
          quiz('mongodb', 'intermediate', 'Pass a MongoDB quiz'),
          grill('mongodb', 'medium', 'Survive a Medium MongoDB interview'),
        ],
      },
      {
        id: 'auth',
        title: 'Auth & JWT',
        blurb: 'Tokens, sessions, signing, refresh flows — and how they get broken.',
        icon: 'KeyRound',
        requires: ['mongodb'],
        xp: 90,
        steps: [grill('jwt', 'medium', 'Survive a Medium JWT & Auth interview')],
      },
    ],
  },

  // ── 8 ────────────────────────────────────────────────────────────────────
  {
    id: 'job-ready',
    title: 'Job Ready',
    subtitle: 'The gauntlet. Everything, in English, under pressure.',
    tint: 'from-amber-300 to-orange-600',
    nodes: [
      {
        id: 'networking',
        title: 'Talk to Humans',
        blurb: 'Networking, and asking for what you are worth.',
        icon: 'Users',
        requires: ['auth'],
        xp: 70,
        steps: [
          speak('networking', 'Hold a networking conversation'),
          speak('negotiation', 'Negotiate a salary in English'),
        ],
      },
      {
        id: 'gauntlet',
        title: 'Boss: The Gauntlet',
        blurb: 'A hard one-shot challenge and an expert interview. Then you are done.',
        icon: 'Crown',
        requires: ['networking'],
        xp: 300,
        boss: true,
        steps: [
          build('hard', 'Win a Hard challenge'),
          grill('typescript', 'expert', 'Survive an Expert TypeScript interview', 60),
          grill('nodejs', 'expert', 'Survive an Expert Node.js interview', 60),
        ],
      },
    ],
  },
]

// ── Derived lookups ────────────────────────────────────────────────────────

export const ALL_NODES: PathNode[] = MODULES.flatMap((m) => m.nodes)

export const TOTAL_NODES = ALL_NODES.length

const NODE_BY_ID = new Map(ALL_NODES.map((n) => [n.id, n]))
const MODULE_BY_NODE = new Map(MODULES.flatMap((m) => m.nodes.map((n) => [n.id, m] as const)))

export function nodeById(id: string): PathNode | undefined {
  return NODE_BY_ID.get(id)
}

export function moduleOfNode(nodeId: string): PathModule | undefined {
  return MODULE_BY_NODE.get(nodeId)
}

/** Non-optional steps — the ones that actually gate mastery. */
export function requiredSteps(node: PathNode): PathStep[] {
  return node.steps.filter((s) => !s.optional)
}

/**
 * Every node this one transitively depends on (its `requires`, and theirs, all
 * the way to the roots). Excludes the node itself. Curriculum order — roots
 * first — so banking them in this order never violates a prerequisite. This is
 * what a jump-forward gate credits: to legitimately stand on a node you must
 * already hold everything upstream of it.
 */
export function ancestorsOf(nodeId: string): string[] {
  const seen = new Set<string>()
  const walk = (id: string) => {
    const node = NODE_BY_ID.get(id)
    if (!node) return
    for (const req of node.requires) {
      if (seen.has(req)) continue
      seen.add(req)
      walk(req)
    }
  }
  walk(nodeId)
  // Return in curriculum order for stable, prerequisite-safe banking.
  return ALL_NODES.filter((n) => seen.has(n.id)).map((n) => n.id)
}

/** Estimated minutes to finish a node from scratch. Shown on the card. */
export function nodeMinutes(node: PathNode): number {
  return node.steps.reduce((sum, s) => sum + (s.optional ? 0 : s.minutes), 0)
}
