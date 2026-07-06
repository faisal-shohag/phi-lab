# Code Motion — Feature Ideas

A catalog of feature ideas for **Code Motion**, the step-by-step JavaScript visualizer. Each idea is tied to a goal: making the tool more **attractive**, more **understandable**, or more **engaging** for learners — or extending **what can be visualized**.

---

## 🎨 Make it more attractive

### 1. Flow-chart visualization of control flow
A second tab next to "Memory" that draws a live flowchart of the executing code — nodes for `if`/`else` branches, loop blocks, function calls. As the playhead advances, the active node lights up. Learners see *why* a branch was taken, not just *that* it was.

**Why it helps:** Some learners think in diagrams, not code. A flowchart makes the "shape" of control flow immediately legible.

### 2. Variable value "flight" animation
When `sum = sum + numbers[i]` runs, animate the actual value flying from `numbers[i]` into the `+` operator and the result landing in `sum`. Framer Motion's layout animations already do half of this — you'd add a temporary "ghost" element that travels. Makes assignment feel physical.

**Why it helps:** Turns the abstract `a = b + c` into a visible "value moves here" gesture.

### 3. Call-stack panel ✅ *implemented*
A thin strip showing the current call stack (e.g. `global → add(a, b) → innerCall()`). Each frame is a card; the active frame is highlighted. When a function returns, its card animates out. This is the #1 thing missing for understanding recursion and function calls.

**Why it helps:** Functions and recursion are the biggest conceptual gaps for beginners. Seeing the stack grow and shrink makes "what does `return` do?" obvious.

### 4. Dark/glow theme toggle
A "neon" mode where the active line glows, variable cards have neon borders, and the console looks like a terminal. Purely cosmetic but learners love it — and it's a 1-hour job with CSS variables.

**Why it helps:** Aesthetics drive engagement. A "cool" tool gets used more.

---

## 🧠 Make it more understandable

### 5. "Why?" tooltips on each step
Right now the banner says `if (score >= 70) → true`. Add a small "Why?" button that expands to explain: *"score is 78, and 78 ≥ 70 is true, so we enter this branch."* The interpreter already has the operands — you'd format them into a sentence.

**Why it helps:** Beginners often can't connect a condition's result to the values that produced it. A one-sentence explanation bridges that gap.

### 6. Predict-the-next-step mode ✅ *implemented*
Before each step, ask the learner "What will happen next?" with 3-4 multiple-choice options (e.g. "Take if-branch", "Take else-branch", "Skip"). They click, then the actual step reveals. Turns passive watching into active prediction — the single most effective learning technique.

**Why it helps:** Active recall beats passive review. Forcing a prediction makes the learner reason about the code before seeing the answer.

### 7. Speed-linked difficulty
Auto-slow the playback (1× → 0.5×) when entering a loop body or function call for the first time, then speed back up for repeated iterations. Learners get more time on novel concepts and less on the 10th iteration of the same loop.

**Why it helps:** The first iteration of a loop is where understanding happens; the 10th is just noise. Adaptive pacing keeps attention where it matters.

### 8. Annotation/bookmark steps ✅ *implemented*
Let learners pin a comment to any step ("this is where the loop exits"). The comment appears as a sticky note on the timeline. Helps with note-taking and review.

**Why it helps:** Learners build their own mental map. Annotations let them mark "aha" moments and revisit them.

### 9. "Explain this line" button
Click any line in the editor → a side panel explains that line in plain English, using the current variable values. E.g. clicking `sum = sum + numbers[i]` shows: "Adds the current array element (42) to the running total (42), giving 84. `sum` is now 84."

**Why it helps:** Reading code is a skill. A line-by-line explainer scaffolds that skill with concrete, contextual explanations.

---

## 🎯 Make it more engaging

### 10. Challenge mode ✅ *implemented*
Pre-built challenges: "Make this loop print only even numbers", "Fix the bug so the sum is correct", "Rewrite this using a for-of loop". Learners edit code, press Run, and get instant feedback (✓ correct / ✗ try again with a hint). Turns the visualizer into a practice tool.

**Why it helps:** Watching is passive; doing is active. Challenges convert the visualizer from a demo into a practice environment.

### 11. Step-by-step quiz after each demo
After a demo finishes, show 2-3 quick questions: "What was the final value of `sum`?", "How many times did the loop run?" Reinforces what they just watched.

**Why it helps:** Retrieval practice after a lesson boosts retention. A quick quiz cements the key takeaways.

### 12. Progress tracking
A simple streak/XP system: "You've completed 5 demos", "3-day streak". localStorage-based, no backend needed. Surprisingly motivating for self-learners.

**Why it helps:** Gamification works. Visible progress encourages learners to come back.

### 13. Shareable trace links
"Share" button encodes the current code + step index in the URL. A learner can send a friend a link that opens the exact same code at the exact same step. Great for "can you explain why this line does X?" conversations.

**Why it helps:** Learning is social. Shareable links make it easy to ask for help or show a friend a tricky concept.

---

## 🔧 Extend what can be visualized

### 14. Recursion visualizer ✅ *implemented*
When a function calls itself, draw a growing stack of function frames (like Russian dolls). Each frame shows its own `n` value. When base case hits, frames collapse one by one. This is *the* hardest concept for beginners and a visual makes it click.

**Why it helps:** Recursion is famously "mind-bending." Seeing the stack grow and shrink turns an abstract concept into a visible, physical metaphor.

### 15. Object/reference visualization ✅ *implemented*
Show arrays and objects as boxes-with-arrows, so `let b = a; b.push(4);` visibly mutates `a` too. Currently arrays show as flat cell grids — adding reference arrows would teach the #1 JavaScript gotcha.

**Why it helps:** Reference vs value is the most common JS bug source for beginners. Color-coded shared references make the concept unmissable.

### 16. Step "diff" view ✅ *implemented*
When you step forward, briefly flash what changed: `sum` flashes amber (42 → 84), the array cell flashes rose (written). You already detect changed variables — a 200ms flash animation on the delta would make changes impossible to miss.

**Why it helps:** In a busy visualization, the eye needs guidance. A flash says "look HERE" without the learner having to compare states manually.

### 17. Mini "complexity" meter ✅ *implemented*
For loop demos, show a small counter: "This loop will run 5 times" (decreasing as iterations complete). Helps learners build intuition for O(n) before they hear the term.

**Why it helps:** Loops are where complexity intuition starts. A "3 of 5" progress bar makes iteration count tangible.

---

## Implementation status

| # | Feature | Status |
|---|---------|--------|
| 1 | Flow-chart visualization | ☐ not implemented |
| 2 | Variable value "flight" animation | ☐ not implemented |
| 3 | Call-stack panel | ✅ implemented |
| 4 | Dark/glow theme toggle | ☐ not implemented |
| 5 | "Why?" tooltips | ☐ not implemented |
| 6 | Predict-the-next-step mode | ✅ implemented |
| 7 | Speed-linked difficulty | ☐ not implemented |
| 8 | Annotation/bookmark steps | ✅ implemented |
| 9 | "Explain this line" button | ☐ not implemented |
| 10 | Challenge mode | ✅ implemented |
| 11 | Step-by-step quiz after each demo | ☐ not implemented |
| 12 | Progress tracking | ☐ not implemented |
| 13 | Shareable trace links | ☐ not implemented |
| 14 | Recursion visualizer | ✅ implemented |
| 15 | Object/reference visualization | ✅ implemented |
| 16 | Step "diff" view | ✅ implemented |
| 17 | Mini "complexity" meter | ✅ implemented |

**8 of 17 ideas implemented so far.**

---

## Suggested next steps

If continuing development, the highest-impact remaining ideas are:

1. **#5 "Why?" tooltips** — small effort, large understanding payoff. The interpreter already has the operand values; it's mostly a formatting job.
2. **#1 Flow-chart visualization** — larger effort, but uniquely helps visual thinkers.
3. **#13 Shareable trace links** — small effort, large social-learning payoff. URL-encode the code + step.
4. **#9 "Explain this line"** — medium effort, large payoff for self-study. Pairs naturally with the existing step descriptions.
