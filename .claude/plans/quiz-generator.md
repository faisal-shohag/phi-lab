# Quiz Generator Lab — Implementation Plan

## Overview

Build an AI-powered Quiz Generator as a new lab (`/labs/quiz`) in the Phi Lab platform. Users select topics (HTML, CSS, JavaScript, TypeScript, React, Next.js, Node.js, Express.js, MongoDB), difficulty, and question count. Gemini generates high-quality MCQs with four options, correct answer, and explanation. Users take the quiz, get instant feedback, see their score, and review answers. Quiz history is persisted.

---

## Tech Stack Decisions

| Concern | Choice | Rationale |
|---|---|---|
| AI generation | `generateStructured` from `@/lib/hive/providers` | Reuses existing multi-provider failover, usage tracking, and key rotation |
| Schema validation | Gemini `responseSchema` (Type enum) | Already used by Analogies, Hive, and report graders |
| Database | New `QuizSession` model in Prisma | Follows the pattern of `InterviewSession`, `AnalogyCard`, etc. |
| UI components | shadcn/ui (existing 63 components) + Tailwind v4 | Matches the rest of the project |
| Animations | framer-motion | Already a dependency |
| Toast notifications | sonner | Already used everywhere |
| XP awarding | `awardXp` from `@/lib/gamification/award` | Idempotent, existing pattern |
| Auth guard | `requireUser()` from `@/lib/auth-server` | Standard pattern |
| Error handling | `errorResponse` from `@/lib/interview/errors` | Shared taxonomy |
| Feature flag | `flag.lab.quiz.enabled` in AdminSetting | Follows all other labs |
| Daily limit | `lab.quiz.dailyLimit` in AdminSetting | Follows all other labs |

---

## Database Changes

### New Prisma Model: `QuizSession`

```prisma
model QuizSession {
  id          String   @id @default(cuid())
  userId      String
  user        User     @relation(fields: [userId], references: [id], onDelete: Cascade)
  topics      String[] // e.g. ["javascript", "react"]
  difficulty  String   // "beginner" | "intermediate" | "advanced"
  questionCount Int
  questions   Json     // Full question data (AI-generated MCQs)
  answers     Json?    // User's answers (null until submitted)
  score       Int?     // Correct count (null until submitted)
  total       Int      // Total questions
  xpAwarded   Int      @default(0)
  status      String   @default("in_progress") // "in_progress" | "completed"
  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt

  @@index([userId, createdAt])
  @@map("quiz_session")
}
```

**Why a separate model (not XpEvent-only)?**
Same rationale as `PixelSubmission` / `ChallengeAttempt`: we need mutable state (`answers`, `score`, `status`) that an append-only ledger can't hold. The questions themselves are stored so the user can review after submission without re-generating.

---

## File Structure

```
src/
├── lib/
│   └── quiz/
│       ├── topics.ts          # Topic definitions, labels, icons
│       └── schema.ts          # Gemini responseSchema for quiz generation
├── components/
│   └── quiz/
│       ├── quiz-lab.tsx       # Main client component (orchestrator)
│       ├── setup-screen.tsx   # Topic/difficulty/count selector
│       ├── quiz-player.tsx    # Active quiz taking UI
│       ├── question-card.tsx  # Single question with MCQ options
│       ├── result-screen.tsx  # Score display + answer review
│       └── history-list.tsx   # Past quizzes sidebar
├── app/
│   ├── labs/
│   │   └── quiz/
│   │       └── page.tsx       # Server page: auth guard + load history
│   └── api/
│       └── quiz/
│           ├── generate/
│           │   └── route.ts   # POST: generate quiz questions via AI
│           ├── submit/
│           │   └── route.ts   # POST: submit answers, compute score, award XP
│           └── history/
│               └── route.ts   # GET: paginated quiz history
prisma/
└── schema.prisma              # Add QuizSession model + User relation
```

---

## Detailed Implementation Steps

### Step 1: Database Schema + Migration

**File: `prisma/schema.prisma`**

1. Add `QuizSession` model (see above)
2. Add `quizSessions QuizSession[]` relation to the `User` model
3. Add `QUIZ` to `AiFeature` enum
4. Add `GENERATE_QUIZ` to `AiTask` enum

**Run:** `npx prisma migrate dev --name add_quiz_session`

---

### Step 2: Topic Definitions

**File: `src/lib/quiz/topics.ts`**

Define the 9 supported topics with labels, icons (lucide), and description hints for the AI prompt:

```typescript
export const QUIZ_TOPICS = [
  { id: 'html', label: 'HTML', icon: 'Code2', color: 'text-orange-500' },
  { id: 'css', label: 'CSS', icon: 'Palette', color: 'text-blue-500' },
  { id: 'javascript', label: 'JavaScript', icon: 'SquareFunction', color: 'text-yellow-500' },
  { id: 'typescript', label: 'TypeScript', icon: 'FileCode2', color: 'text-blue-600' },
  { id: 'react', label: 'React', icon: 'Atom', color: 'text-cyan-500' },
  { id: 'nextjs', label: 'Next.js', icon: 'Triangle', color: 'text-foreground' },
  { id: 'nodejs', label: 'Node.js', icon: 'Server', color: 'text-green-500' },
  { id: 'expressjs', label: 'Express.js', icon: 'Route', color: 'text-gray-500' },
  { id: 'mongodb', label: 'MongoDB', icon: 'Database', color: 'text-green-600' },
] as const

export type QuizTopic = typeof QUIZ_TOPICS[number]['id']
export type QuizDifficulty = 'beginner' | 'intermediate' | 'advanced'

export const DIFFICULTY_LEVELS = [
  { id: 'beginner', label: 'Beginner', description: 'Fundamentals and basic concepts' },
  { id: 'intermediate', label: 'Intermediate', description: 'Applied knowledge and patterns' },
  { id: 'advanced', label: 'Advanced', description: 'Deep understanding and edge cases' },
] as const

export const QUESTION_COUNTS = [5, 10, 15, 20] as const
```

---

### Step 3: AI Schema for Quiz Generation

**File: `src/lib/quiz/schema.ts`**

Gemini `responseSchema` that ensures structured MCQ output:

```typescript
import { Type } from '@google/genai'

export const QUIZ_SCHEMA = {
  type: Type.OBJECT,
  properties: {
    questions: {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        properties: {
          question: { type: Type.STRING, description: 'The quiz question' },
          options: {
            type: Type.ARRAY,
            items: { type: Type.STRING },
            description: 'Exactly 4 answer options',
          },
          correctIndex: {
            type: Type.INTEGER,
            description: '0-based index of the correct option',
          },
          explanation: {
            type: Type.STRING,
            description: 'Detailed explanation of why the correct answer is correct and why others are wrong',
          },
        },
        required: ['question', 'options', 'correctIndex', 'explanation'],
        propertyOrdering: ['question', 'options', 'correctIndex', 'explanation'],
      },
    },
  },
  required: ['questions'],
  propertyOrdering: ['questions'],
}
```

---

### Step 4: API Route — Generate Quiz

**File: `src/app/api/quiz/generate/route.ts`**

POST endpoint that:
1. Auth guard via `requireUser()`
2. Check `flag.lab.quiz.enabled` and daily limit
3. Validate body: `{ topics: string[], difficulty: string, count: number }`
4. Build a detailed prompt including topic-specific instructions
5. Call `generateStructured(prompt, QUIZ_SCHEMA, { feature: 'QUIZ', task: 'GENERATE_QUIZ' })`
6. Validate response (4 options per question, valid correctIndex)
7. Save `QuizSession` to DB
8. Return the session (without correctIndex — stripped server-side so the client can't cheat)

**Key prompt design:**
- Include the selected topics and difficulty level
- Request high-quality, practical questions (not trivia)
- For multi-topic quizzes, mix questions across topics
- Ensure questions are appropriate for the difficulty level
- Request explanations that teach, not just state the answer

**Response stripping:** The `correctIndex` and `explanation` are removed from the initial response. They are only revealed after submission.

---

### Step 5: API Route — Submit Quiz

**File: `src/app/api/quiz/submit/route.ts`**

POST endpoint that:
1. Auth guard
2. Validate body: `{ sessionId: string, answers: number[] }`
3. Load the `QuizSession`, verify it belongs to the user and is `in_progress`
4. Compute score by comparing answers against stored `questions` data
5. Update the session: set `answers`, `score`, `status: 'completed'`
6. Award XP via `awardXp` (idempotent per session):
   - Base: 10 XP per correct answer
   - Bonus: +20 XP for 100% score, +10 XP for 80%+
7. Return the full session with explanations revealed

---

### Step 6: API Route — Quiz History

**File: `src/app/api/quiz/history/route.ts`**

GET endpoint that:
1. Auth guard
2. Query param: `page` (default 1), `limit` (default 20)
3. Return paginated `QuizSession` records for the user, ordered by `createdAt desc`
4. Include summary stats: total quizzes, average score, total XP earned

---

### Step 7: Server Page

**File: `src/app/labs/quiz/page.tsx`**

Server component that:
1. `requireUser()` — redirect to `/sign-in?redirect=/labs/quiz` if unauthenticated
2. Fetch user's quiz history (last 50 sessions)
3. Pass to `<QuizLab>` client component

---

### Step 8: Client Components

#### `src/components/quiz/quiz-lab.tsx` (Main Orchestrator)

State machine with screens: `setup` → `playing` → `result`

```
States:
- setup: Show SetupScreen
- playing: Show QuizPlayer
- result: Show ResultScreen
```

Includes:
- Header with Logo, theme toggle, XP badge, user menu (same pattern as AnalogiesLab)
- History sidebar (collapsible on mobile)

#### `src/components/quiz/setup-screen.tsx` (Configuration)

- **Topic selector**: Grid of toggle buttons with icons and labels. Multi-select with at least one required.
- **Difficulty selector**: Three segmented buttons (Beginner / Intermediate / Advanced)
- **Question count**: Select from 5, 10, 15, 20
- **Generate button**: Calls `/api/quiz/generate`, transitions to `playing`
- **Suggested combos**: Quick-start buttons like "10 JS Questions (Intermediate)"

#### `src/components/quiz/quiz-player.tsx` (Active Quiz)

- Progress bar at top (e.g., "3 / 10")
- `<QuestionCard>` for the current question
- Previous/Next navigation
- Visual indicators for answered/unanswered questions (dot grid)
- Timer (optional, non-blocking — display elapsed time)
- Submit button (enabled when all questions answered, with confirmation dialog)

#### `src/components/quiz/question-card.tsx` (Single Question)

- Question number and text
- Four option buttons (A, B, C, D) with `radio`-like selection
- Selected state with visual feedback (border color, background)
- Topic badge (small tag showing which topic this question covers)

#### `src/components/quiz/result-screen.tsx` (Score + Review)

- Score circle/counter with animation (framer-motion)
- Confetti effect on 80%+ score (canvas-confetti, already a dependency)
- Per-question review:
  - Green highlight for correct answers
  - Red highlight for incorrect + show correct answer
  - Expandable explanation for each question
- Stats: time taken, accuracy per topic
- Action buttons: "Try Again" (same config), "New Quiz", "Back to History"

#### `src/components/quiz/history-list.tsx` (Past Quizzes)

- List of past quiz sessions with:
  - Topics covered (small badges)
  - Difficulty badge
  - Score (e.g., "8/10")
  - Date
  - Click to review (loads full results with explanations)
- Summary stats at top: total quizzes, average score, streak

---

### Step 9: Admin Settings

**File: `src/lib/admin/settings-defaults.ts`**

Add to `SETTING_DEFAULTS`:

```typescript
'lab.quiz.dailyLimit': 20,
'flag.lab.quiz.enabled': true,
```

Add to `SETTING_BOUNDS`:

```typescript
'lab.quiz.dailyLimit': { min: 0, max: 500 },
```

---

### Step 10: Navigation Integration

Add Quiz Lab to the landing page's `LabsShowcase` and any internal navigation that references labs. The route will be `/labs/quiz`.

---

## UX Flow

```
┌─────────────────────────────────────────────┐
│  /labs/quiz                                 │
│                                             │
│  ┌──────────────┐  ┌──────────────────────┐ │
│  │ SETUP SCREEN │  │  HISTORY SIDEBAR     │ │
│  │              │  │                      │ │
│  │ Topics:      │  │  Recent quizzes...   │ │
│  │ [HTML] [CSS] │  │  8/10 · 2h ago      │ │
│  │ [JS] [TS]    │  │  10/10 · yesterday  │ │
│  │ [React] ...  │  │  6/10 · 3 days ago  │ │
│  │              │  │                      │ │
│  │ Difficulty:  │  │  Stats:              │ │
│  │ [B][I][A]    │  │  Total: 15 quizzes  │ │
│  │              │  │  Avg: 78%           │ │
│  │ Questions:   │  │  XP earned: 450     │ │
│  │ [5][10][15]  │  │                      │ │
│  │              │  └──────────────────────┘ │
│  │ [Generate]   │                           │
│  └──────────────┘                           │
│                                             │
│  ════════════ AFTER GENERATE ═════════════  │
│                                             │
│  ┌─────────────────────────────────────────┐│
│  │ Question 3 / 10          ●●●○○○○○○○    ││
│  │                                         ││
│  │ What is the purpose of React's          ││
│  │ useEffect hook?                         ││
│  │                                         ││
│  │ ┌─────────────────────────────────────┐ ││
│  │ │ A. To manage component state        │ ││
│  │ │ B. To handle side effects           │ ││  ← Selected
│  │ │ C. To define props                  │ ││
│  │ │ D. To optimize rendering            │ ││
│  │ └─────────────────────────────────────┘ ││
│  │                                         ││
│  │ [← Prev]              [Next →]          ││
│  └─────────────────────────────────────────┘│
│                                             │
│  ════════════ AFTER SUBMIT ═══════════════  │
│                                             │
│  ┌─────────────────────────────────────────┐│
│  │         🎉 Score: 8/10 (80%)           ││
│  │         +90 XP earned                   ││
│  │                                         ││
│  │  Q1 ✓  What is HTML?                   ││
│  │  → Explanation: HTML is the standard... ││
│  │                                         ││
│  │  Q2 ✗  Which CSS property...           ││
│  │  Your answer: B. margin                 ││
│  │  Correct: C. padding                    ││
│  │  → Explanation: Padding creates space...││
│  │                                         ││
│  │  [New Quiz]  [Review History]           ││
│  └─────────────────────────────────────────┘│
└─────────────────────────────────────────────┘
```

---

## AI Prompt Strategy

The generation prompt is critical for quality. Template:

```
Generate a {difficulty} multiple-choice quiz about {topicList}.

Requirements:
- Each question must have exactly 4 options with one correct answer
- Questions should test practical knowledge, not obscure trivia
- Explanations should teach the concept, not just state "A is correct"
- For Beginner: focus on syntax, definitions, and basic usage
- For Intermediate: focus on patterns, best practices, and common pitfalls
- For Advanced: focus on internals, edge cases, performance, and architecture
- Mix questions across all selected topics evenly
- Avoid questions that are ambiguous or have debatable answers
- Each question should be self-contained (no "all of the above" or "none of the above")

{For multi-topic quizzes:}
- Ensure balanced representation across all selected topics
- Include questions that connect concepts across topics where relevant
```

---

## Security Considerations

1. **Correct answers never sent to client before submission** — `correctIndex` and `explanation` are stripped from the generate response
2. **Server-side scoring** — answers are validated server-side, never trusted from the client
3. **Daily limits enforced server-side** — via `getSetting('lab.quiz.dailyLimit')`
4. **Session ownership verified** — submit route checks `session.userId === user.id`
5. **Suspension check** — `isSuspended(user.id)` before generation

---

## XP Awarding Strategy

| Event | XP | Idempotency Key |
|---|---|---|
| Quiz completed | 10 per correct answer | `quiz_completed:{sessionId}` |
| Perfect score bonus | +20 | Same event, meta.perfect = true |
| High score bonus (80%+) | +10 | Same event, meta.highScore = true |

---

## Testing Plan

1. **Unit tests** for `topics.ts` (constant validation)
2. **API route tests** for generate/submit/history endpoints
3. **Schema validation tests** for the Gemini response schema
4. **Manual testing**: Generate quiz → Take quiz → Submit → Review → Check history

---

## Dependencies

No new npm packages needed. All required libraries are already installed:
- `@google/genai` (AI generation)
- `framer-motion` (animations)
- `sonner` (toasts)
- `canvas-confetti` (celebration effect)
- `lucide-react` (icons)
- shadcn/ui components (Button, Badge, Card, etc.)

---

## Estimated Effort

| Step | Files | Effort |
|---|---|---|
| Schema + migration | 1 | Small |
| Topic definitions | 1 | Small |
| AI schema | 1 | Small |
| Generate API | 1 | Medium |
| Submit API | 1 | Medium |
| History API | 1 | Small |
| Server page | 1 | Small |
| QuizLab orchestrator | 1 | Medium |
| SetupScreen | 1 | Medium |
| QuizPlayer + QuestionCard | 2 | Large |
| ResultScreen | 1 | Medium |
| HistoryList | 1 | Medium |
| Admin settings | 1 | Small |
| **Total** | **14 files** | |

---

## Implementation Order

1. Schema + migration (foundation)
2. `topics.ts` + `schema.ts` (data layer)
3. Admin settings (feature flag)
4. Generate API route (AI integration)
5. Submit API route (scoring)
6. History API route (read side)
7. Server page (auth + data loading)
8. SetupScreen (configuration UI)
9. QuizPlayer + QuestionCard (quiz taking)
10. ResultScreen (score + review)
11. HistoryList (past quizzes)
12. QuizLab orchestrator (wire everything together)
13. Navigation integration (landing page link)
