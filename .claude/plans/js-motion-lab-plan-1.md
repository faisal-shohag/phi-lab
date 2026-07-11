# JS Motion Visualizer — Enrichment Roadmap + First Implementation Batch

> **Active batch:** "Challenge economy + Leaderboard + AI charge" — see the section at the very bottom for the live checklist.

## Context

JS Motion (`src/app/labs/js-motion/page.tsx`) is a step-by-step JS execution visualizer: custom interpreter (`src/lib/visualizer/interpreter.ts`) produces a Trace; 20+ opt-in views (memory, heap graph, event loop, flow chart, flame graph, recursion tree, quiz, etc.) replay it. Goal: make it more comprehensive, error-free, engaging, addictive, soothing — and AI-powered. Audience: Programming Hero beginner students (Banglish + English).

Existing assets to reuse (do NOT rebuild):
- **AI failover engine**: `src/lib/hive/providers.ts` (Gemini → Ollama → Groq rotation, cooldowns, usage telemetry) + structured generation pattern in `src/lib/hive/ai.ts` and `src/app/api/analogies/generate/route.ts` (GoogleGenAI + responseSchema).
- **XP/gamification**: `src/lib/gamification/reasons.ts` + `award.ts` (idempotent XpEvent ledger), client `use-xp.ts`. Only `quiz_correct` is client-triggerable today.
- **Auth**: Better Auth, `requireUser` in `src/lib/auth-server.ts`.
- **Feature flags**: `src/lib/visualizer/settings.ts` (14 flags, localStorage-persisted) — new features become flags + tabs in `TAB_FEATURES` (page.tsx:106).
- **Quiz**: `src/lib/visualizer/quiz.ts` (output + boolean question kinds).
- **Examples**: `src/lib/visualizer/examples.ts` (16 demos).

---

## Part A — Full Idea Roadmap (every perspective)

**Status legend:** ✅ done · 🟡 partial · ⬜ not started.
User picked all 4 tracks (Language coverage, Soothing UX, Engagement, More AI) for successive batches; recommended order starts with Language coverage (Batch C).

### 1. Comprehensiveness (language coverage — interpreter.ts)  ✅ (core complete; niche items open)
- ✅ **Destructuring** — array/object patterns in declarations, function params, and assignment (swap `[a,b]=[b,a]`); defaults + rest. Shared `destructure()` helper. **[Batch C]**
- 🟡 **for…in** ✅, **switch/case** ✅ (strict `===`, fall-through, default). ⬜ **labeled break/continue** (deferred). **[Batch C]**
- 🟡 **Optional chaining `?.`** ✅ (member + call short-circuit, `ChainExpression`). ⬜ ternary trail visualization (deferred). **[Batch C]**
- ✅ **Classes**: constructor, methods, `this`, class fields, `new`, `extends`, `super()`, `super.method()`. Instance renders as a clean heap object. **[Batch C-2]**
- 🟡 **Map/Set**: constructors + core methods (set/get/has/delete/size/keys/values/entries/forEach, add), `for…of`, `console.log` display. Backing store is a non-enumerable prop so heap stays clean. ⬜ Dedicated visual panels still open. **[Batch C-2]**
- 🟡 **async/await**: `async` fns return a resolved promise; `await` unwraps it; steps recorded. Pragmatic synchronous model (no true suspension) — enough to teach the value flow. ⬜ Faithful microtask-suspension ordering still open. **[Batch C-2]**
- ✅ **Better runtime errors with line numbers**: `RuntimeError` carries `currentLine`; editor tints the failing line (`cm-error-line`).
- ✅ **All array + string methods + Object/JSON/Array/Number/Math builtins**; higher-order callbacks (map/filter/reduce…) run through the interpreter. (Next, ⬜: emit dedicated `callback` steps so map/filter iterations show in loop-unroll view.)
- ✅ **Demos added**: "Destructuring & Swap", "Switch & Array Methods", "Classes & Inheritance" (19 demos total).

### 2. Error-free / robustness  🟡
- ✅ **Golden-trace test suite**: `interpreter.test.ts` — all 16 demos + array/string/builtin coverage (24 tests, vitest).
- ⬜ Fuzz guard: cap array allocation size (like `.repeat` cap) for `fill`, `Array.from`, `concat` growth.
- ⬜ Error taxonomy: friendly messages per class ("x is not a function" → "You called `x` like a function, but it holds 5. Did you mean…").
- ✅ Editor: runtime-error line tint after a failed run (distinct from the as-you-type parse squiggle).

### 3. Soothing / calm UX ("immediate imagination")  🟡  → **Batch (Soothing) — partly shipped**
- 🟡 **Calm mode toggle** ✅ (`calmMode` flag, Comfort group): slower auto-play (×1.6), no confetti, `prefers-reduced-motion` respected. ⬜ Remaining: muted sage/teal palette, softer spring presets, reduced DiffFlash intensity.
- ✅ **Ambient audio (opt-in)** (`ambientSound` flag): procedural Web Audio (`lib/visualizer/sound.ts`) — soft per-step blips on a warm pentatonic, output/return chimes, 3-note finish. AudioContext unlocked on Run/Play gesture.
- 🟡 **Breathing pacing**: ✅ auto-pause dwell (1.7×) + calm ×1.6. ⬜ Remaining: named "Slow story / Normal / Fast" presets.
- 🟡 **Value morphing**: ✅ numbers count up/down in MemoryPanel; array cells slide via `layout`. ⬜ Remaining: dedicated push/shift slide-in.
- ⬜ **Metaphor skins**: memory as "boxes on shelf", heap objects as "balloons on strings", call stack as "plates stacking".
- ✅ **Focus dimming** (`focusDim` flag): while playing, every line except the active one dims (`cm-dim-line`).

### 4. Engagement / addictive loops (reuse XP system)  🟡  → **Batch (Engagement) — core shipped**
- ✅ **Daily streak**: `viz_daily` reason (5 XP, idempotent per calendar day). `getStats` computes distinct days + `bestVizStreak` (longest consecutive run). Badges "Getting the Habit" (3-day) + "Week Strong" (7-day).
- ✅ **Concept badges**: stepping a concept demo to its final step awards `viz_concept` (15 XP, idempotent per concept). Badges "Recursion Wrangler", "Closure Master", "Event-Loop Navigator", "OOP Builder". Concept↔demo map in page.tsx.
- ✅ **Challenge mode (staked arena)** — see the dedicated batch below. Stake XP, AI task graded on hidden tests server-side, 3 modes × 3 tiers, win/lose XP, red/flame arena.
- ⬜ **Bug hunt levels**: curated broken programs; fix until output matches target. 10-20 levels, `viz_bug_fixed` XP.
- ✅ **Leaderboard**: weekly viz-XP board (`weeklyVizLeaderboard`, ISO week, positive viz XP) — Trophy header button → `LeaderboardDialog` (top 10 + your rank).
- ✅ **Share cards**: victory OG-image card (public `challenge/[id]` page + `opengraph-image` via `next/og`, QR, red/flame branding) + in-app Download/Copy/Share. (General trace share cards still ⬜.)
- ⬜ **Progress map**: concept checklist fed by which demos completed with quiz.

New reasons `viz_daily`/`viz_concept` are plain `XpEvent` rows (String column) — **no migration**. 6 new badges auto-appear on the achievements page (icons mapped).

### 5. UX / learnability polish  ⬜  (not in the 4 chosen tracks — later)
- ⬜ **Onboarding tour**: 5-step coach marks on first visit (localStorage flag).
- ⬜ **"What am I looking at?"** hover explainers per panel.
- ⬜ **Mobile layout**: stacked panels + swipe between views.
- ⬜ **Step search**: jump to "first time x changed" / "iteration 3" from timeline.
- ⬜ **Compare runs**: side-by-side old vs new trace outputs.

### 6. AI-powered (reuse hive/providers.ts failover)  🟡  → **Batch (More AI) — core shipped**
All server routes under `src/app/api/labs/js-motion/*`, `requireUser`, Banglish/English toggle, cached, stamped `feature: JS_MOTION`.

1. ✅ **AI Step Tutor** ("Why?" on step banner) — code + step + vars → explanation + analogy. Route `explain`.
2. 🟡 **AI Error Coach** — "Help me fix" gives explanation + one hint. ⬜ Remaining: second-click "show the fix".
3. ⬜ **AI Analogy generator** — reuse analogies lab, tied to current demo concept.
4. ⬜ **AI Quiz generator** — richer distractors + "why wrong" feedback (invasive to quiz overlay; deferred).
5. ✅ **AI Code-to-Story** — whole-program narrative before playback. Route `insight` (kind `story`), "Story" button on the editor AI bar.
6. ✅ **AI Challenge maker** — "similar but harder" program; **client validates it through `interpret()`** (drops it if it throws / truncates) before offering "Load into editor". Route `insight` (kind `challenge`).
7. ⬜ **AI voice narration (later)** — gemini-live token pattern, spoken Banglish synced to playback.
8. ⬜ **Ask-the-trace chat (later)** — side chat grounded on the trace JSON.
9. ✅ **Complexity insight** — names the algorithm + Big-O + one-line why. Route `insight` (kind `complexity`), "Complexity" button.

New route `insight` (one route, 3 kinds) + `AiInsights` bar under the editor header (guest-locked upsell). No migration (reuses `EXPLAIN`/`GENERATE` tasks).

**✅ Lab-wide language setting** — replaced the per-popover Banglish/English toggles with ONE lab language (`বাংলা`/`English`) in the Settings panel. Shared `src/lib/visualizer/lang.ts` (`LabLang`, `aiLangInstruction`) drives **every** AI surface: Step Tutor, Story, Complexity, Harder-one, Challenge task **and** hints. Challenge language is stored on `ChallengeAttempt.lang` (db push) so the prompt/hint/share-card render in the chosen language (Bengali → `--font-bengali`, else default). "Banglish" retired — non-English is now proper Bengali script everywhere. Verified: tsc/lint clean, 56 tests, page 200, routes auth-gated.

**Extra shipped (beyond original Part A):** ✅ JS_MOTION `AiFeature` + `EXPLAIN` task — tutor usage now breaks out on the admin AI-usage dashboard (applied to DB via `db push`).

---

## Part B — First Implementation Batch  ✅ SHIPPED

All of B1–B5 implemented, typecheck clean, 24/24 tests passing, page/route verified on the dev server.

### B1. ✅ AI Step Tutor + AI Error Coach (one route)
- New route `src/app/api/labs/js-motion/explain/route.ts`:
  - `requireUser`; body `{ mode: 'step' | 'error', code, lang: 'banglish' | 'english', step?: {description, kind, line, vars}, error?: string }`.
  - Uses `generateWithFailover`-style call via `src/lib/hive/providers.ts` (follow `analogies/generate/route.ts` structured-schema pattern).
  - Prompt: 2-3 sentence beginner explanation; Banglish default; never dump full corrected code in first response for errors — hint first.
  - In-memory LRU cache keyed `(codeHash, mode, line/stepIndex, lang)` to avoid repeat spend.
- UI (`page.tsx`):
  - Sparkle "Why?" button in step banner → popover with explanation, loading shimmer, lang toggle (persist in visualizer settings as `aiLang`).
  - "Help me fix" button inside the error overlay card → same popover.
- New settings key `aiTutor` (default ON) in `settings.ts`.

### B2. ✅ Calm/polish quick wins
- ✅ `prefers-reduced-motion`: confetti off when set.
- ✅ Auto-pause dwell (1.7×) after `enter`/`condition` steps at speed ≤ 1.
- ✅ Number morph: count-up on changed primitive values in MemoryPanel (`code-viewer.tsx`, reduced-motion aware).

### B3. ✅ Runtime error line highlight
- `interpreter.ts`: wrap top-level catch — attach `line: currentLine` to thrown runtime errors (new `RuntimeError extends Error`).
- `safeInterpret` returns `errorLine`; editor shows red line decoration (reuse ParseError squiggle mechanism in `code-editor.tsx`).

### B4. ✅ Guest (logged-out) mode with gentle upsell
- Core visualizer stays fully open to guests: editor, run, playback, all trace views, demos, share.
- **Login-gated features** (hidden/locked for guests):
  - AI Step Tutor "Why?" + AI Error Coach (route already `requireUser`) — UI shows lock state instead of button firing.
  - Quiz mode + XP/streak (XP award needs a user; quiz toggle shows lock).
  - XpBadge/XpHint hidden for guests (check how UserMenu detects session — reuse `auth-client.ts` `useSession`).
- Locked controls: replace with subtle lock chip; clicking opens a friendly popover: warm, non-pushy copy — "You're missing the best part! Sign in free to unlock AI tutor, quizzes & XP. No pressure — keep exploring as guest." + Sign-in button (link to `/sign-in?next=/labs/js-motion`).
- One-time dismissible banner (localStorage flag) under header for guests: generous tone, lists what they'd unlock, "Continue as guest" dismiss.
- Session detection client-side via existing Better Auth `useSession` hook from `src/lib/auth-client.ts`.

### B5. ✅ Golden-trace tests
- `src/lib/visualizer/__tests__/interpreter.test.ts`: run all 16 demos + array/string-method program; assert outputs + no throw + truncated=false. (Check for vitest/jest config; add vitest if absent — dev-dep only.)

## Verification
- `npx tsc --noEmit` clean.
- Run tests (B4) — all demos pass.
- Dev server: run map/filter demo, click "Why?" on a step → Banglish explanation appears; break code → error card shows "Help me fix" → hint; toggle English; confirm no layout shift.
- Logged out (incognito): visualizer fully usable; quiz + AI buttons show lock chip; popover copy shows; sign in → features unlock.
- Toggle OS reduced-motion → confetti off.

## Out of scope this batch
Destructuring/async-await interpreter work, voice narration, bug-hunt levels, leaderboard, mobile layout — roadmap items for later batches.

---

# Batch: Challenge Mode (gamified, staked)  ✅ SHIPPED

**Delivered:** `ChallengeAttempt` model (db push, no migration) · `spendXp()` + challenge stats/badges (`challenger`/`gladiator`/`flawless` + the missing `sorting-sifter`) · pure `challenge.ts` grader (`runFn`/`grade`/`computeExpected`/`reward`) · 4 routes (`activate`/`submit`/`giveup`/`active`) with server-side timer/attempt/grading enforcement · 3 UI components (setup, arena, result) + page wiring (red/flame theme, demos hidden, AI disabled mid-round, resume-after-refresh). Verified: `tsc` clean, 0 lint errors, **54 tests pass** (12 new challenge tests — hardcode & wrong both fail), page 200, all routes auth-gate (401 guest). Grading is cheat-proof (hidden inputs, server-run). Below is the as-built spec.

---


## Context
The AI "Challenge maker" (insight route, kind `challenge`) currently just drops a harder program into the editor — no stakes, no grading, no reward. Turn it into a real **gamified, staked arena**: the learner risks XP to take an AI-generated coding challenge, writes a solution, and the server grades it against **hidden tests** (cheat-proof). Win → refund + bonus; lose → forfeit the stake. This is the Engagement track's "Challenge mode" (and seeds "leaderboard").

Decisions locked with the user:
- **Grading:** function + hidden tests, graded **server-side** (can't be beaten by hardcoding output).
- **Tiers (stake `S`):** Easy 20 · Medium 50 · Hard 100 (also scales AI difficulty).
- **Modes (learner picks all three):**
  - **One-shot** — Submit is final. Win `+2S` (net **+S**); lose (net **−S**). No feedback until final.
  - **Retries** — unlimited submits; bonus decays 20%/wrong (floor 0). Win credits `S + bonus` (net **0…+S**); Give Up/abandon (net **−S**). Shows `X/N passed`.
  - **Timed** — 3 tries + 5-min clock (both server-enforced). Win `2S + timeBonus` (timeBonus ≤ `0.5S` by remaining time); out of tries/time (net **−S**). Shows passed count + tries/clock.
- Stake deducted **on activate**; abandon = forfeit.

## Why a new table
No deduct path exists (`awardXp` floors ≥0, award.ts:35). Retries/Timed need **mutable per-round state** (attempts, deadline, status) that the append-only `XpEvent` ledger can't hold. So add a small **`ChallengeAttempt`** model, applied via **`db push`** (same path used for the `JS_MOTION` enum — the DB has no migrate baseline/P3005, so `db push` is the working mechanism; no full migration). The **answer/tests live only in this server-side row**, never sent to the client.

## Data model — `prisma/schema.prisma` (+ `User.challengeAttempts` relation)
```
model ChallengeAttempt {
  id           String   @id @default(cuid())
  userId       String
  user         User     @relation(fields:[userId], references:[id], onDelete: Cascade)
  difficulty   String   // easy|medium|hard
  mode         String   // oneshot|retries|timed
  stake        Int
  status       String   @default("active") // active|won|lost
  fnName       String
  prompt       String              // Bengali task text (shown)
  sampleInput  Json                // one visible example (shown)
  sampleOutput String               // shown
  tests        Json                // SERVER-ONLY: [{args:[...], expected:string}]
  attemptsUsed Int      @default(0)
  maxAttempts  Int                 // oneshot=1, timed=3, retries=9999
  expiresAt    DateTime?            // timed only
  createdAt    DateTime @default(now())
  updatedAt    DateTime @updatedAt
  @@index([userId, status])
}
```
Apply with `db push` (session-pooler URL — port 5432, drop `pgbouncer`, as done before), then `prisma generate`.

## Server
- **`src/lib/gamification/award.ts`** — add `spendXp(userId, reason, sourceId, amount)`: balance check (≥ amount) → write `XpEvent{ amount: -amount }` + `user.xp` decrement, idempotent via the existing `@@unique`. Extend `getStats` with `challengeWins` (count `reason:'viz_challenge_win'`) + `bestChallengeStreak` (optional) for badges.
- **`src/lib/visualizer/challenge.ts`** (new, pure, server+test usable) — reuses `interpret()`:
  - `DIFFICULTY = { easy:{stake:20}, medium:{stake:50}, hard:{stake:100} }`, mode configs (maxAttempts, timer).
  - `runFn(code, fnName, args)` — build harness `code + ';console.log(""+JSON.stringify(fnName(...args)))'`, `interpret(harness,{maxSteps:2000})`, return the sentinel-marked last `output` (or `null` on truncated/throw/missing).
  - `grade(code, fnName, tests)` → `{ passed:number, total, allPass:boolean }`.
  - `computeExpected(referenceSolution, fnName, testArgs[])` → run reference through `runFn` for each input to derive expected outputs (never trust AI's claimed outputs).
  - `reward(mode, stake, attemptsUsed, remainingFrac)` → XP credited on win.
- **Routes** under `src/app/api/labs/js-motion/challenge/` (all `requireUser` + `isSuspended`):
  - `activate` POST `{difficulty, mode, code}` → validate; balance ≥ stake else `INSUFFICIENT_XP`; forfeit any existing active row; generate via `generateStructured` (feature `JS_MOTION`, task `GENERATE`) asking for `{fnName, prompt(Bengali), testArgs[], referenceSolution, signature}`; **server computes expected outputs** from the reference (regenerate up to N times if it doesn't run clean); `spendXp(-stake)`; create `ChallengeAttempt`. Return **client-safe** fields only (`attemptId, prompt, fnName, sample, mode, difficulty, stake, maxAttempts, expiresAt`).
  - `submit` POST `{attemptId, code}` → load active row (own); enforce expiry/attempts **server-side**; `attemptsUsed++`; `grade()`; resolve per mode; on win `awardXp('viz_challenge_win', attemptId, reward)` + status; on final loss status=`lost`. Return `{status, passed, total, xpDelta, remainingAttempts, expiresAt}` — **never the tests/expected**.
  - `giveup` POST `{attemptId}` → status=`lost`.
  - `active` GET → resume the current active attempt (client-safe fields) after refresh.
- Prompt: Bengali task text (reuse `--font-bengali`); code identifiers/keywords English.

## Client — `src/app/labs/js-motion/page.tsx` + new components
- **`challenge-setup.tsx`** — activation card: difficulty pills × mode cards, live stake/reward preview + risk meter, "Enter Arena (−S XP)" (disabled if `xp < S`), guest-locked upsell. Reads balance from `useXp()`.
- **`challenge-arena.tsx`** — replaces the demo sidebar while active: Bengali prompt + sample I/O, HUD (stake, mode, tries left, countdown — display only, server authoritative), big red **Submit**. Local Run still allowed to self-test.
- **`challenge-result.tsx`** — win overlay (confetti + XP burst) / lose overlay (ember, −XP), passed/total, "New Challenge" / "Exit arena".
- **page.tsx**: `challengeActive`/`attempt` state; on active → **red/flame theme** (conditional root classes), **hide `DEMO_EXAMPLES` sidebar** (L1022 region), mount arena, **disable AI tutor + AiInsights** (so nobody asks the AI for the solution), route wiring, `refreshXp()` after result. Resume via `active` GET on mount.

## Anti-abuse
Hidden inputs + server-run grading (no hardcoding); one active attempt per user; balance gate; AI help disabled mid-round; timer/attempts server-enforced; reuse `isSuspended`.

## Badges (bonus) — `src/lib/gamification/badges.ts`
`challenger` (1 win), `gladiator` (10 wins), `flawless` (win a Hard one-shot). Also fix the noted gap: add a **`sorting`** badge (concept exists, no badge). Add icons to the achievements ICONS map.

## Suggested extras (not in this batch — flag for later)
Daily free challenge · win-streak multiplier + leaderboard · "hint for a few XP" · shareable victory card · auto-difficulty from current code · post-win reveal of the reference solution · per-hour cooldown.

## Verification
- **db push** applies `ChallengeAttempt`; `prisma generate` clean; `tsc` clean.
- **Unit (`challenge.test.ts`, vitest):** a correct `solve` passes all hidden tests; a hardcoded/wrong one fails; an infinite loop → truncated → fail; `computeExpected` derives outputs from a reference; reward math per mode.
- **Route smoke (dev server):** `activate` guest → 401; signed-in → deducts stake, returns prompt with **no tests/answer** in payload; `submit` correct → win + XP up; wrong (one-shot) → lose −S; `giveup` → lost; balance gate blocks when `xp < S`.
- **Manual:** enter arena → red/flame, demos hidden, AI hidden, timer counts down, Submit correct → confetti + XP; refresh mid-round → `active` restores it.

---

# Batch: Challenge source — code OR topics  ✅ SHIPPED

**Delivered:** `CHALLENGE_TOPICS` catalog + `isTopic`/`topicLabel` in `challenge.ts` · `activate` parses `source`/`topics` (catalog-validated, capped 4) and builds the prompt from topics → code → generic · setup card gains a "My code / Topics" toggle + topic pill grid (Enter blocked until a topic is picked) · page state `challengeSource`/`challengeTopics` with smart default (code when editor has real content, else topics) + remembered topic selection. Verified: `tsc` clean, 0 lint errors, 54 tests pass, page 200, topic-mode route 401 for guests. As-built below.

---


## Context
Today `activate` always bases the challenge on the editor's current code (or a generic fallback when empty). Add a second way in: let the learner deliberately **pick one or more programming topics** to be challenged on, so they can drill a weak area instead of only riffing on whatever's in the editor. Small extension — only the setup card, the activate body/prompt, and a shared topic list change; generation, grading, stake, arena, and result are untouched.

Decisions locked with the user:
- **Topic catalog:** a fixed curated beginner set (multi-select), all inside the interpreter subset.
- **Source pick:** a `From my code / Pick topics` toggle in the setup card. **Smart default** — `code` when the editor has real (non-comment) content, else `topics`. Remember the last choice.

## Changes
- **`src/lib/visualizer/challenge.ts`** (shared client+server) — add
  ```
  export const CHALLENGE_TOPICS = [
    { id:'arrays', label:'Arrays' }, { id:'strings', label:'Strings' },
    { id:'loops', label:'Loops' }, { id:'conditionals', label:'Conditionals' },
    { id:'objects', label:'Objects' }, { id:'recursion', label:'Recursion' },
    { id:'sorting', label:'Sorting' }, { id:'searching', label:'Searching' },
    { id:'math', label:'Math' }, { id:'closures', label:'Closures' },
    { id:'mapset', label:'Map / Set' }, { id:'oop', label:'Classes / OOP' },
  ] as const
  export type ChallengeTopic = typeof CHALLENGE_TOPICS[number]['id']
  export function isTopic(v: unknown): v is ChallengeTopic { … }   // catalog guard
  export type ChallengeSource = 'code' | 'topics'
  ```
- **`src/app/api/labs/js-motion/challenge/activate/route.ts`** — parse `source: 'code'|'topics'` + `topics: string[]` (filter to catalog via `isTopic`, cap ~4). Build the `basedOn` line:
  - `source==='topics'` & topics non-empty → `Base the challenge on: <labels joined>. Combine them naturally if more than one.`
  - `source==='code'` & code present → existing code-based line.
  - otherwise → the existing generic fallback.
  Everything after (generate → `computeExpected` → stake → store) is unchanged.
- **`src/components/visualizer/challenge-setup.tsx`** — add a two-button **source toggle**; when `topics`, render a wrap-grid of `CHALLENGE_TOPICS` pills (multi-select, selected = rose). "Enter Arena" disabled if `topics` chosen but none selected. New props `source`, `topics`, `hasCode`, and `onChange` extended to carry `source`/`topics`.
- **`src/app/labs/js-motion/page.tsx`** — new state `challengeSource: ChallengeSource`, `challengeTopics: ChallengeTopic[]`; persist both in `localStorage` (like `aiLang`). `openChallenge()` sets the smart default from whether `code` has real content (strip `//` comments + trim). `activateChallenge()` sends `{ difficulty, mode, source, topics, code }`. Pass `hasCode` to the setup card.

## Reuse
`DIFFICULTY`/`MODE`/`reward` already imported by the setup card; `CHALLENGE_TOPICS` lives beside them. The whole downstream pipeline (`generateStructured`, `computeExpected`, `grade`, `spendXp`, arena/result) is reused as-is.

## Verification
- `tsc` clean; existing 54 tests still pass (grading path unchanged).
- **Route smoke:** `activate` with `{source:'topics', topics:['arrays','strings']}` (signed-in) → returns a prompt/challenge; with an unknown topic → filtered out, not trusted.
- **Manual:** toggle shows/hides the topic grid; smart default = code when editor has code, else topics; pick "Recursion" → the generated task is about recursion; empty selection blocks Enter; last source/topics restored on reload.

---

# Batch: Challenge economy + Leaderboard + AI charge  ✅ SHIPPED

## Context
Deepen the game loop and add a cost to AI help. Six features: (1) win-streak multiplier, (2) hint-for-XP, (3) victory share card (public + og:image), (4) post-win solution reveal, (5) weekly leaderboard, (6) a 30-XP charge on helper-AI use with a "don't show again" confirm. Reuses the shipped Challenge Mode + XP ledger + Hive leaderboard patterns.

**Locked decisions:** AI charge hits **helper AI only** (Step Tutor Why?/Help-fix, Story, Complexity, Harder-one) — NOT staked Challenge activate, NOT hints; cached results are free; blocked if balance < 30. **Hint** = one per challenge, flat **15 XP**, does not reduce the win reward. **Share card** = full social version: in-app download/copy **and** a public link with a real `og:image`; card shows difficulty · mode · +XP · streak · date · prompt snippet · QR · handle; **PhiLab / Js Motion Lab branding** in the red/flame palette.

## Progress checklist (keep updated: ✅ done · 🟡 wip · ⬜ pending)
- ✅ **F0 Schema** — `ChallengeAttempt` + `referenceSolution`, `wonXp`, `winStreak`, `hintsUsed`. Applied via `db push` + `prisma generate`.
- ✅ **F1 Win-streak multiplier** — `streakMultiplier()` (1/1.25/1.5/2×); submit computes consecutive-win streak, stores `wonXp`/`winStreak`, returns `winStreak`+`multiplier`; result overlay shows it.
- ✅ **F2 Hint-for-XP** — `challenge/hint` route (one/round, 15 XP, refunds on gen failure, never reveals solution); arena "Get a hint (−15 XP)" → Bengali hint.
- ✅ **F3 Victory share card (public + og:image)** — public `challenge/[id]/page.tsx` (won-only, 404 else) + `opengraph-image.tsx` (`next/og`, red/flame, QR via `qrcode`); result overlay Download/Copy/Share.
- ✅ **F4 Post-win solution reveal** — `referenceSolution` stored on activate, returned on win, collapsible "Reveal a solution" (winner-only, never public).
- ✅ **F5 Weekly leaderboard** — `weeklyVizLeaderboard`/`myWeeklyRank` (ISO week, positive viz XP) + route + `LeaderboardDialog` (Trophy header button, top 10 + your rank).
- ✅ **F6 30-XP AI charge + confirm popup** — `chargeAiUse` after cache-check in explain/insight (402 when broke); `AiChargeDialog` (alert-dialog + "don't show again" → localStorage); `onBeforeAi` gate on AiTutor/AiInsights.

**Shipped & verified:** `tsc` clean · 0 lint errors · **56 tests** (2 new streak tests) · `db push` applied 4 columns · page 200 · leaderboard/hint 401 for guests · share page 404 on bad id · og-image 200. Confetti now fires on challenge win. `AI_CHARGE` lives in client-safe `challenge.ts` so no server code (node:crypto) leaks into the client bundle.

## F0 — Schema (`prisma/schema.prisma`)
Add to `ChallengeAttempt`: `referenceSolution String?` (stored on activate, revealed only to the winner), `wonXp Int?`, `winStreak Int?` (set on win — feed the share card without recompute), `hintsUsed Int @default(0)`. Apply via `db push` (port 5432, drop `pgbouncer`), then `prisma generate`.

## F1 — Win-streak multiplier
- `src/lib/visualizer/challenge.ts`: `streakMultiplier(streak)` → `1` (1 win) · `1.25` (2) · `1.5` (3–4) · `2` (5+). Keep `reward()` as base; multiply at award time.
- `submit/route.ts` (win branch): compute the current streak = count of consecutive `won` attempts (most-recent-first, stop at first `lost`) **including this win** — query `challengeAttempt` `where status in (won,lost)`, `orderBy createdAt desc`. `finalXp = round(reward(...) * streakMultiplier(streak))`. Store `wonXp=finalXp`, `winStreak=streak`; award that amount. Loss/give-up naturally breaks the streak.
- Return `winStreak` + `multiplier` in the win response; show in the result overlay.

## F2 — Hint-for-XP
- New route `POST /api/labs/js-motion/challenge/hint` — `requireUser`; load the caller's `active` attempt; if `hintsUsed >= 1` → `409 HINT_USED`; `spendXp({ reason:'viz_challenge_hint', sourceId: attempt.id, amount: 15 })` (balance-gated → `INSUFFICIENT_XP`); generate a **nudge** via `generateStructured` (feature `JS_MOTION`, task `EXPLAIN`) from the stored `prompt`/`fnName`/`sample` with a hard rule "give ONE hint, never the solution or code"; `hintsUsed++`; return `{ hint, balance }`. (`sourceId=attempt.id` makes it idempotent → truly one paid hint.)
- Arena (`challenge-arena.tsx`): "💡 Hint (−15 XP)" button; after use, show the hint text and disable. Bengali via `--font-bengali`.

## F3 — Victory share card (public + og:image)
- **Persist-for-share:** the won `ChallengeAttempt` row is the shareable record (id in URL). No auth on the public page; **select only safe fields** (never `tests`/`referenceSolution`).
- **Public page** `src/app/labs/js-motion/challenge/[id]/page.tsx` — server component, `cache()`+Prisma; 404 unless `status==='won'`. Renders the branded card (name/handle, difficulty·mode, `+wonXp`, `winStreak`, date, Bengali prompt snippet) + a "Take your own challenge" CTA → `/labs/js-motion`. `generateMetadata` sets `openGraph.images` to the image route.
- **OG image** `src/app/labs/js-motion/challenge/[id]/opengraph-image.tsx` — `ImageResponse` from `next/og` (built-in; fall back to adding `@vercel/og` only if this custom Next lacks it). 1200×630, red/flame gradient, PhiLab / Js Motion Lab lockup, the boast, and a **QR** (data-URL from the new `qrcode` dep) linking back to the public page. No external fetches (fonts/colors inline).
- **In-app share** (result overlay): "Download card" → GET the og-image route as PNG and save; "Copy link" → the public URL; native **Web Share** where available.
- **Deps:** add `qrcode` (+ `@types/qrcode`). Verify `next/og` is available in this Next build before falling back to `@vercel/og`.

## F4 — Post-win solution reveal
- `activate/route.ts`: store the AI `referenceSolution` on the row (already generated, just persist it).
- `submit/route.ts` win response includes `referenceSolution`; `SubmitResult` gains the field.
- Result overlay: a collapsible "Reveal solution" (monospace). **Winner-only, in-app** — never on the public card.

## F5 — Weekly leaderboard
- `src/lib/visualizer/leaderboard.ts` — `weeklyVizLeaderboard(limit=10)`: `prisma.xpEvent.groupBy({ by:['userId'], where:{ reason:{ in:['viz_challenge_win','viz_daily','viz_concept','quiz_correct'] }, amount:{ gt:0 }, createdAt:{ gte: startOfIsoWeekUTC() } }, _sum:{ amount:true } })`, join `user{name,image}`, sort desc, `slice(limit)`. Reuse `startOfIsoWeekUTC`/`isoWeekKey` from `src/lib/hive/leaderboard.ts` (export them there if not already).
- Route `GET /api/labs/js-motion/leaderboard` — `requireUser`; returns `{ week, rows, you:{ rank, xp } }`.
- UI `leaderboard-dialog.tsx` (reuse `dialog.tsx` + `HiveAvatar` pattern from `leaderboard-panel.tsx`): header **Trophy** button opens it; top 10 with rank/avatar/name/weekly-XP, "you" row highlighted.

## F6 — 30-XP AI charge + confirm popup
- `src/lib/visualizer/ai-charge.ts` — `AI_CHARGE = 30`; `chargeAiUse(userId): Promise<{ ok:boolean; balance:number; reason?:'INSUFFICIENT_XP' }>`: balance ≥ 30 else `INSUFFICIENT_XP`; `spendXp({ reason:'viz_ai_use', sourceId: crypto.randomUUID(), amount: 30 })` (unique id → every real call charges).
- `explain/route.ts` + `insight/route.ts`: call `chargeAiUse` **after the cache-hit check, before `generateStructured`** (cache hits stay free). On `INSUFFICIENT_XP` → `402`-style JSON so the client can message it.
- Client confirm (helper-AI only): `ai-charge-dialog.tsx` (reuse `alert-dialog.tsx` + `checkbox.tsx`) — "AI help costs 30 XP. Continue?" + **"Don't show again"** (localStorage `phi-viz-ai-charge-ack`). Page owns a `requestAiCharge(): Promise<boolean>` (acked → resolve true immediately; else open dialog) passed as `onBeforeAi` to `AiTutor` + `AiInsights`; they `await onBeforeAi()` before fetching. After any AI call, `refreshXp()` so the badge updates. Insufficient balance → toast "Need 30 XP for AI help".

## Reuse
`spendXp`/`awardXp`/`getStats` (`award.ts`) · `generateStructured` (`hive/providers.ts`) · ISO-week helpers + `LeaderboardRow` shape (`hive/leaderboard.ts`, `hive/leaderboard-panel.tsx`) · `ChallengeAttempt` + reward/streak in `challenge.ts` · `dialog`/`alert-dialog`/`checkbox` primitives · `canvas-confetti` (fire on challenge win — currently not fired) · `--font-bengali`.

## Verification
- **F0:** `db push` applies the 4 columns; `prisma generate` clean; `tsc` clean.
- **Unit (`challenge.test.ts`):** `streakMultiplier` curve; reward×multiplier. Existing 54 tests still pass.
- **Route smoke (dev server, guest → 401 on all):** `hint` deducts 15 & blocks the 2nd; `leaderboard` returns week+rows; `explain`/`insight` deduct 30 on a real (non-cached) call and 402 when balance < 30; `challenge/[id]` public page 200 for a won id / 404 otherwise; its `opengraph-image` returns a PNG.
- **Manual:** win 2+ in a row → multiplier shown + bigger XP; buy a hint; result overlay → reveal solution + download/copy/share card (QR scans to the public page, og:image shows in a link preview); AI action shows the 30-XP confirm once, "don't show again" suppresses it; leaderboard dialog lists top 10 + your rank.

---

# Batch: Blitz rescues (paid resume / extra life)  ✅ SHIPPED

Timed (Blitz) rounds are no longer an instant loss at the buzzer or when tries run out — the learner can pay to keep fighting.

- **Out of TIME** (clock hit 0): "Resume" = **20 XP** → **+5:00** on the clock **and +1 life**.
- **Out of TRIES** (clock still running): "Buy a life" = **100 XP** → **+1 attempt**, no extra time.
- Both **unlimited, flat price**. Blitz only (one-shot/retries unaffected).

**As built:**
- `challenge.ts`: `RESUME_TIME_COST=20`, `RESUME_LIFE_COST=100`, `RESUME_TIME_MS=5min`.
- `submit/route.ts`: expiry no longer marks the row lost — returns `{status:'rescue', rescuable:'time'}`, keeps it active. Timed out-of-tries miss returns `{status:'rescue', rescuable:'life'}` (persists the used attempt, stays active). One-shot loss unchanged.
- New `challenge/resume/route.ts`: server-authoritative — `kind:'time'` requires expired (bumps `expiresAt`+`maxAttempts`), `kind:'life'` requires out-of-tries + time remaining (bumps `maxAttempts`). `spendXp` (unique `randomUUID` sourceId → every rescue charges), balance-gated (`INSUFFICIENT_XP`). Reasons `viz_challenge_resume` / `viz_challenge_life` (negative XpEvents; don't touch the leaderboard). **No schema change** — reuses mutable `expiresAt`/`maxAttempts`.
- Client: `SubmitResult.status` gains `'rescue'` + `rescuable`. New `challenge-rescue.tsx` overlay (amber, breathing icon, cost + perk, Give up / Buy). Page `resumeChallenge()` updates the live `challenge` and stays in the arena (plays `playGoSting`); declining → `giveUpChallenge` (loss). Arena `onTimeUp` fires the buzzer path once (Submit is disabled at 0:00), resetting if time is added back. Life-buy that races an expiry (`EXPIRED`) falls back to a time-resume prompt.

**Verified:** tsc/lint clean, 56 tests. **No migration.** Refresh mid-timeout still forfeits (the `active` GET closes a lapsed clock) — rescue is an in-session choice.
