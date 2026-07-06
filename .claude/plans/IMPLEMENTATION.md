# Code Motion — Implementation Notes

This document describes **how** each implemented feature was built, including the files touched, the data structures involved, and the key design decisions. It's intended as a developer reference for understanding and extending the codebase.

---

## Architecture overview

Code Motion is a Next.js 16 + TypeScript app with three layers:

```
src/lib/visualizer/
  ├─ types.ts          — Trace, Step, VarSnapshot, CallFrame types
  ├─ interpreter.ts    — tree-walking JS interpreter that records steps
  ├─ examples.ts       — demo code snippets
  ├─ challenges.ts     — challenge definitions with expected outputs
  └─ use-annotations.ts — localStorage-backed annotation hook

src/components/visualizer/
  ├─ code-editor.tsx        — Prism-highlighted editor w/ active-line overlay
  ├─ code-viewer.tsx        — read-only code view + VariableCard + ArrayValue
  ├─ timeline.tsx           — clickable step timeline + annotation bookmarks
  ├─ playback-controls.tsx  — play/pause/step/seek/speed controls
  ├─ call-stack-panel.tsx   — call stack with recursion detection
  ├─ predict-panel.tsx      — multiple-choice quiz before each step
  ├─ complexity-meter.tsx   — loop iteration progress bar
  └─ challenge-checker.tsx  — challenge result checker

src/app/page.tsx       — main layout, state orchestration, panel composition
```

**Data flow:** The interpreter parses user code with `acorn` into an AST, walks it, and records every meaningful operation as a `Step` in a flat `Trace`. The UI plays the trace back frame-by-frame, animating variable changes, call-stack growth, and line highlights.

---

## #16 — Step diff flash

**Goal:** When the learner steps forward, briefly flash what changed so the change is impossible to miss.

### How it works

The `Step` type already carries a full snapshot of all variables (`vars: VarSnapshot[]`). In `page.tsx`, a `useMemo` called `stepDiff` compares the current step's vars against the previous step's and computes three things:

- `changedVarNames: Set<string>` — which variables changed
- `changedCells: Record<string, Set<number>>` — for arrays, which specific indices changed
- `previousValues: Record<string, Primitive>` — the old value (for the "old → new" transition)

These are passed to `VariableCard` in `code-viewer.tsx`, which renders three layers of feedback:

1. **Full-card amber pulse** — a `motion.div` overlay with `initial={{ opacity: 0.55 }} animate={{ opacity: 0 }}` that fades over 1.2s.
2. **Old value floats away** — for primitives, the previous value renders as a ghost that animates `y: 0 → -22, opacity: 0.8 → 0` over 0.7s.
3. **New value slides in** — the new value animates from `y: 16, scale: 1.1, color: amber` to its resting state with a spring.
4. **Changed array cells flash rose** — cells in `changedCells` get a rose-colored overlay and a scale-pulse on the value.

### Files touched
- `src/app/page.tsx` — `stepDiff` useMemo, passes props to `VariableCard`
- `src/components/visualizer/code-viewer.tsx` — `VariableCard`, `PrimitiveValue`, `ArrayValue` components

### Key decision
The diff is computed by comparing consecutive step snapshots rather than tracking mutations in the interpreter. This keeps the interpreter simpler (it just records state, not deltas) and makes the diff logic UI-only.

---

## #3 — Call-stack panel

**Goal:** Show the current call stack so learners understand function calls and returns.

### How it works

The interpreter maintains a `callStack: CallFrame[]` array that starts with `[{ name: 'global', line: 1 }]`. When `callUserFn` is invoked:

1. A new `CallFrame` is pushed with the function name, starting line, and parameter bindings (`{ name, value }[]`).
2. Every `pushStep` call snapshots the current `callStack` (shallow-copied) into the step.
3. On function return, the frame is popped.

The `CallStackPanel` component (`call-stack-panel.tsx`) receives the current step's `callStack` and renders frames in reverse order (innermost on top, like a debugger). The active frame (top) gets an amber border; the global frame gets a dashed border with a 🌐 icon.

### The `CallFrame` type

```typescript
export interface CallFrame {
  name: string           // 'global' or function name
  line: number           // currently-executing line in this frame
  params?: { name: string; value: Primitive }[]  // parameter bindings
}
```

### Files touched
- `src/lib/visualizer/types.ts` — added `CallFrame` interface, `callStack` field on `Step`
- `src/lib/visualizer/interpreter.ts` — `callStack` array, push/pop in `callUserFn`, snapshot in `pushStep`
- `src/components/visualizer/call-stack-panel.tsx` — new component
- `src/app/page.tsx` — renders CallStackPanel as a tab inside the Memory panel

### Key decision
The call stack is recorded on **every** step (not just enter/return steps), so the panel always reflects the current state. The snapshot is a shallow copy (`callStack.map(f => ({ ...f, ... }))`) so later mutations don't corrupt earlier steps.

---

## #6 — Predict-the-next-step mode

**Goal:** Before each step, quiz the learner on what happens next. Active recall beats passive review.

### How it works

A "Predict" toggle in the header enables predict mode. When ON:

1. The `nextStep` (the step after `currentIndex`) is passed to `PredictPanel`.
2. `PredictPanel` calls `generateOptions(nextStep)` which produces 3-4 multiple-choice options based on the step's `kind`:
   - `condition` → "TRUE — take if-branch" / "FALSE — skip" / "The program crashes"
   - `branch` → "Take if-branch" / "Take else-branch" / "Skip both"
   - `assign`/`declare` → "Variable X gets a new value" + plausible distractors
   - `loop-check` → "TRUE — iterate again" / "FALSE — exit" / "New loop starts"
   - etc.
3. Options are deterministically shuffled (seeded by the step description) so the correct answer isn't always in the same position.
4. When the learner picks, `onAnswer(isCorrect)` fires. The panel shows "Correct!" (green) or "Not quite. The actual step was: X" (rose).
5. "Reveal & continue →" advances to the next step.

The `handleStepForward` callback is intercepted in predict mode: if predict mode is on and the user hasn't answered yet, Next does nothing (the quiz must be answered first).

A running score (`predictStats.correct / predictStats.total`) shows in the header button.

### Files touched
- `src/components/visualizer/predict-panel.tsx` — new component with `generateOptions` logic
- `src/app/page.tsx` — `predictMode`, `predictAnswered`, `predictWasCorrect`, `predictStats` state; `handleStepForward` interception; `handlePredictAnswer` / `handlePredictReveal` callbacks

### Key decision
Option generation is **rule-based per step kind** rather than AI-generated. This makes it instant, deterministic, and testable. The distractors are chosen to be plausible (same family of operations) but clearly wrong, so the quiz tests understanding rather than guesswork.

---

## #14 — Recursion visualizer

**Goal:** When a function calls itself, make the growing/shrinking stack visible and intuitive.

### How it works

The existing `CallStackPanel` (#3) already shows all frames. For recursion, we add:

1. **Recursion detection:** Count how many frames share each function name. If any name appears 2+ times, `hasRecursion = true`.
2. **Depth banner:** A violet strip at the top of the panel showing "Recursion depth: N frames on stack" (where N is the max count for any name).
3. **×N depth badge:** For each frame in a recursive chain, compute its position in the chain (how many frames below it share the same name) and show a `×N` badge.
4. **Violet left border accent:** Recursive frames (non-active) get a 4px violet left border so they're visually grouped.
5. **Parameter display:** Each frame shows its parameter values (e.g. `factorial(n=1)`, `factorial(n=2)`), so the learner can see how `n` decreases toward the base case.

### Example output for `factorial(4)` at peak depth:

```
┌─ Recursion depth: 4 frames on stack ──────────────┐
│ fn  factorial  (n=1)  ×4              line 1       │ ← active (base case)
│ fn  factorial  (n=2)  ×3              line 5       │
│ fn  factorial  (n=3)  ×2              line 5       │
│ fn  factorial  (n=4)                   line 5       │
│ 🌐  global                             line 8       │
└────────────────────────────────────────────────────┘
```

### Files touched
- `src/components/visualizer/call-stack-panel.tsx` — recursion detection, depth badge, violet accent, banner

### Key decision
Recursion is detected from the `callStack` array at render time (not tracked in the interpreter). This means no interpreter changes were needed — the panel just inspects the frames it already receives.

---

## #15 — Object/reference visualization

**Goal:** Show when two variables point to the SAME underlying object, so reference sharing is obvious.

### How it works

The interpreter maintains a module-level `WeakMap<object, number>` called `refIdMap`. Every time an array or object is snapshotted, `getRefId(obj)` assigns it a stable numeric ID (or returns the existing one).

In `snapshotScope` (interpreter.ts), each `VarSnapshot` now includes a `refId?: number` for arrays/objects.

In `page.tsx`, a `useMemo` called `refColors` builds a `Map<number, string>` mapping each unique refId in the current step's variables to a color from a 10-color palette:

```typescript
const REF_COLORS = [
  '#8b5cf6', '#ec4899', '#0ea5e9', '#10b981', '#f59e0b',
  '#ef4444', '#6366f1', '#14b8a6', '#f97316', '#a855f7',
]
```

The `VariableCard` component receives `refId` and `refColors`. If the variable has a refId:
- A colored `ref#N` badge appears in the top-right corner of the card.
- The card's border color matches the refId color.

So if `a` and `b` both point to the same array, they both get (say) violet borders and `ref#1` badges — making it visually obvious they share data.

### The `WeakMap` approach

Using a `WeakMap` means:
- **Stable IDs:** The same object always gets the same refId across all snapshots.
- **No memory leak:** When an object is garbage-collected, its entry disappears from the WeakMap automatically.
- **No mutation:** The original runtime values are untouched; refIds are only assigned during snapshotting.

### Files touched
- `src/lib/visualizer/types.ts` — added `refId?: number` to `VarSnapshot`
- `src/lib/visualizer/interpreter.ts` — `refIdMap`, `getRefId`, updated `snapshotScope`
- `src/components/visualizer/code-viewer.tsx` — `refId` / `refColors` props, colored badge + border
- `src/app/page.tsx` — `refColors` useMemo, passes to `VariableCard`

### Key decision
refIds are assigned at snapshot time (not at object-creation time). This means the WeakMap lives in the interpreter module and persists across interpretations — but since it's a WeakMap, it doesn't leak. The first snapshot of a new array gets refId 1, the next new array gets refId 2, etc.

---

## #17 — Mini complexity meter

**Goal:** During loops, show "iteration 3 / 5" with a progress bar to make iteration count tangible.

### How it works

The interpreter has a new `estimateForLoopTotal(node, scope)` function that analyzes a `for` loop's AST to predict the total iteration count. It only works for simple counting loops matching this pattern:

```
for (let VAR = START; VAR OP END; VAR += STEP | VAR++ | VAR--)
```

The function:
1. Extracts `varName`, `start` (from init), `end` (from test right operand), `op` (`<`, `<=`, `>`, `>=`), and `step` (from update).
2. Computes `total` based on the operator: e.g. for `<`, `total = ceil((end - start) / step)`.
3. Returns `undefined` if the loop doesn't match the pattern (while loops, complex conditions, etc.).

The `loopTotal` is recorded on every loop-related step (`loop-start`, `loop-check`, `loop-iter`, `loop-end`).

The `ComplexityMeter` component (`complexity-meter.tsx`) renders a sky-blue strip when the current step has a `loopTotal`:
- Gauge icon + "Loop" label + `iteration / total` + a progress bar that fills proportionally.
- "done" badge on `loop-end` steps.

### Files touched
- `src/lib/visualizer/types.ts` — added `loopTotal?: number` to `Step`
- `src/lib/visualizer/interpreter.ts` — `estimateForLoopTotal` function, passes `loopTotal` to loop steps
- `src/components/visualizer/complexity-meter.tsx` — new component
- `src/app/page.tsx` — renders `ComplexityMeter` above the step banner

### Key decision
The estimator is **conservative** — it returns `undefined` for anything it can't confidently compute, and the meter simply hides. This avoids showing wrong totals. It handles `i++`, `i--`, `i += N`, `i -= N` and all four comparison operators.

---

## #10 — Challenge mode

**Goal:** Turn the visualizer into a practice tool with pre-built coding challenges.

### How it works

A new `Challenge` type extends `DemoExample` with:
- `expectedOutput: string` — the exact console output the correct solution produces
- `hint: string` — a hint shown when the user clicks "Hint"

The sidebar now has a **CHALLENGES section** (below Demos) listing 5 challenges: Sum of Evens, Countdown Loop, Find the Maximum, FizzBuzz, Reverse an Array.

When a challenge is clicked:
1. `handleChallengeClick` sets `activeChallenge`, loads the starter code, and runs it quietly.
2. A `ChallengeChecker` panel appears at the top of the content area with the challenge title, description, "Check my answer" button, and "Hint" button.
3. The user edits the starter code (this keeps the challenge active — `handleCodeChange` was updated to NOT clear `activeChallenge`).
4. When the user clicks "Check my answer", the checker compares `outputsSoFar.join('\n')` against `challenge.expectedOutput`.
5. Shows ✓ "Correct! Well done." or ✗ "Not quite yet." with the expected vs actual output.

### Files touched
- `src/lib/visualizer/challenges.ts` — new file with `Challenge` type and `CHALLENGES` array
- `src/components/visualizer/challenge-checker.tsx` — new component
- `src/app/page.tsx` — `activeChallenge` state, `handleChallengeClick`, renders ChallengeChecker + Challenges section in sidebar

### Key decision
Challenge checking compares **exact console output** (trimmed) rather than AST analysis. This is simple, robust, and language-agnostic. The downside is it doesn't catch solutions that produce the right output the "wrong way" — but for beginner challenges, correct output is the primary goal.

---

## #8 — Annotation/bookmark steps

**Goal:** Let learners pin notes to timeline steps and persist them across sessions.

### How it works

A custom hook `useAnnotations(codeKey)` manages annotations:

1. **codeKey:** A hash of the current code (computed in `page.tsx` via a simple `((h << 5) - h + char) | 0` loop). Annotations are scoped per-code.
2. **Storage:** Annotations are stored in `localStorage` under `codemotion:annotations:<codeKey>`.
3. **State:** The hook uses a `base` (loaded from localStorage via `useMemo`) + an `overlay` (mutations). The `merged` set is computed in `useMemo` and persisted to localStorage on every change.
4. **API:** `addAnnotation(stepIndex, note)` and `removeAnnotation(stepIndex)`.

The `Timeline` component (`timeline.tsx`) was updated:
- Each step chip now has a **bookmark icon** below it.
- Clicking the icon opens an inline note editor (input + Save + Cancel).
- Annotated steps show a **filled amber bookmark**; unannotated show a muted outline.
- Clicking a filled bookmark removes the annotation.

### Why not use useEffect for loading?

React 19's strict lint rules (`react-hooks/set-state-in-effect`) flag setState inside effects. The hook uses `useMemo` to load from localStorage synchronously during render (keyed by `codeKey`), and a `useState` overlay for mutations. This satisfies the linter and avoids cascading renders.

### Files touched
- `src/lib/visualizer/use-annotations.ts` — new hook
- `src/components/visualizer/timeline.tsx` — bookmark icons, inline editor, annotation pins
- `src/app/page.tsx` — uses `useAnnotations`, passes `annotations` / `onAddAnnotation` / `onRemoveAnnotation` to Timeline

### Key decision
Annotations are keyed by a hash of the **code** (not the demo ID), so they persist when the user edits code. If the user switches demos and comes back, the annotations are still there (as long as the code hasn't changed). This is simpler than tracking per-step-identity and works well in practice.

---

## Call stack as a tab beside Memory

**Goal:** Reclaim vertical space by combining the Call stack and Memory panels into one tabbed panel.

### How it works

The Memory panel header now has two tab buttons: "Memory" (with variable count) and "Call stack" (with frame count). A `memoryTab` state (`'variables' | 'callstack'`) controls which content renders below.

The right column's resizable layout was simplified from 3 panels (call stack / memory / console) to 2 (memory+callstack tab / console), giving each panel more vertical room.

### Files touched
- `src/app/page.tsx` — `memoryTab` state, tab header in `memoryPanel`, renders `CallStackPanel` when tab is active

### Key decision
Tabs (not an accordion) because the learner typically wants to focus on one view at a time. The tab badges (counts) let them glance at "how many variables / how many frames" without switching.

---

## Summary of all implemented features

| # | Feature | Key files | New types |
|---|---------|-----------|-----------|
| 16 | Step diff flash | `code-viewer.tsx`, `page.tsx` | — (uses existing `vars`) |
| 3 | Call-stack panel | `call-stack-panel.tsx`, `interpreter.ts` | `CallFrame`, `Step.callStack` |
| 6 | Predict mode | `predict-panel.tsx`, `page.tsx` | — (UI-only) |
| 14 | Recursion visualizer | `call-stack-panel.tsx` | — (uses `CallFrame`) |
| 15 | Object/reference viz | `interpreter.ts`, `code-viewer.tsx` | `VarSnapshot.refId` |
| 17 | Complexity meter | `complexity-meter.tsx`, `interpreter.ts` | `Step.loopTotal` |
| 10 | Challenge mode | `challenges.ts`, `challenge-checker.tsx` | `Challenge` |
| 8 | Annotation/bookmark | `use-annotations.ts`, `timeline.tsx` | `Annotation` |

**Interpreter changes:** `callStack` tracking, `refId` assignment, `loopTotal` estimation.
**Type changes:** `CallFrame`, `Step.callStack`, `Step.loopTotal`, `VarSnapshot.refId`, `Challenge`, `Annotation`.
**New components:** `CallStackPanel`, `PredictPanel`, `ComplexityMeter`, `ChallengeChecker`.
**New hooks/files:** `use-annotations.ts`, `challenges.ts`.
