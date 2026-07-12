# AI-Powered Learning Path — Idea Set for Phi Lab

## Context

Phi Lab today = 6 standalone AI labs + Hive helpdesk + XP/badge gamification. No curriculum, no course/progress models, no sequencing. Students wander between labs with no direction. Goal: a practical, engaging, accountable AI-powered learning path that ties the existing labs into one journey — "from first console.log to job-ready" made literal.

Key asset: rich per-user signal already exists (XpEvent ledger, per-lab session tables, badge stats, Hive activity, AI telemetry). A path feature should *consume* this, not build parallel tracking.

---

## Core Concept: "The Path" — a living skill map, not a course list

Path = visual node graph (reuse `@xyflow/react`, already used in js-motion visualizer). Each node = one concept (e.g. "closures"). Nodes unlock like a game skill tree. The AI's job is not to *deliver* content — the labs already do that — it's to **sequence, gate, adapt, and coach**.

---

## Idea Group A — Path structure (practical backbone)

### A1. Mentor-authored skeleton, AI-personalized flesh
Canonical curriculum skeleton (HTML→CSS→JS→DOM→async→React→Node…) authored by mentors as data, NOT generated per-student. AI personalizes: pacing, which optional nodes to include, remediation inserts, daily quest composition. This keeps quality controlled and AI cost low. (Fully AI-generated curricula drift and hallucinate — avoid.)

### A2. Each node = "learn → prove" loop using existing labs
A concept node isn't "watch video." It's a checklist drawn from existing labs:
- **See it**: js-motion visualizer demo for that concept (`visualizer/examples.ts` already maps concepts)
- **Build it**: staked coding challenge (`ChallengeAttempt` infra exists)
- **Explain it**: Feynman teach-back — must reach clarity threshold to mark mastered
- **Say it**: English lab scenario for interview vocabulary on that concept
Node completes only when the student can *do* and *explain* — real mastery gate, not checkbox.

### A3. Diagnostic placement (onboarding)
New student takes a 10-minute AI diagnostic: short adaptive quiz + one tiny code task + optional 2-min voice chat ("tell me what you already know"). AI places them on the map — skips known nodes, flags shaky ones as "review." Nobody starts from zero if they're not at zero.

### A4. Boss battles (module gates)
End of each module = live voice AI interview (Gemini Live infra exists) combining all module concepts + one integrated coding challenge. Pass → unlock next module + badge + big XP. Fail → AI writes specific remediation plan, inserts remedial nodes. Makes progress *earned* and memorable.

---

## Idea Group B — AI usage (useful, not gimmicky)

### B1. Weekly re-planner ("your path breathes")
Weekly cron: AI reads the student's week (sessions, failures, XP, Hive questions) and re-plans next week — reorder nodes, shrink/grow daily load, insert review. Uses existing `generateStructured` pattern + `AiUsageEvent` telemetry. One AI call per student per week = cheap.

### B2. Struggle detection + auto-remediation
Signals already in DB: repeated `ChallengeAttempt` failures, low Feynman clarity, Hive posts tagged to a concept. When struggle detected on concept X: auto-generate analogy card (analogies lab exists), suggest revisiting visualizer demo, or insert a smaller stepping-stone challenge. Intervention *before* the student gives up.

### B3. Spaced repetition micro-reviews
Concepts mastered 1/3/7/21 days ago resurface as 2-minute micro-challenges in the daily quest. AI generates one-question variants from the concept. Fights the bootcamp forgetting curve — most bootcamps skip this entirely.

### B4. AI weekly report card (human-readable)
Gemini summarizes the week into plain language: what you learned, where you struggled, what's next, one honest encouragement. Bilingual option — **Bangla + English** — huge for the audience. Shareable version for guardians/mentors.

### B5. Hive integration: questions feed the path
When a student asks a Hive question, triage already guesses a milestone. Link it to their path node — their question history becomes struggle signal (B2), and Honeycomb KB answers get suggested when they reach that node.

---

## Idea Group C — Accountability & engagement (student-friendly)

### C1. Daily quest (15–30 min, composable)
Every day AI composes a small quest from the path: e.g. "1 micro-review + 1 new challenge + 1 Feynman explain." Fits before/after class/work. Streak counter with **streak freeze** tokens (earned via XP) — punishing one missed day kills motivation; Duolingo learned this.

### C2. XP staking on weekly goals
Extend existing staking mechanic: student stakes XP on "I'll complete 5 nodes this week." Win → stake back + bonus. Miss → stake burns (or partially refunds if >50% done). Self-chosen commitment = strongest accountability psychology.

### C3. Study squads (pods of 4–6)
Auto-matched by level + timezone. Squad shares a weekly quest board; squad-wide bonus XP if everyone hits goal (positive peer pressure, no individual shaming). Squad chat = a private Hive thread. Also: "explain to a peer" as an alternative Feynman gate — peer confirms understanding.

### C4. AI check-in companion ("why'd you miss?")
Missed 2+ days → gentle AI check-in (in-app + email): "Stuck? Busy? Bored?" One-tap reasons. AI adapts: stuck → remediation; busy → shrink daily load; bored → skip-ahead challenge. Absence handled with curiosity, not guilt. Mentor gets escalation only after 7 quiet days.

### C5. Public path profile
`/u/[id]` shows the skill map — mastered nodes lit up. Shareable "I just mastered closures" cards (analogy cards already have public share pattern). Recruiter-friendly view at path end: verified mastery ≠ self-reported skills.

---

## Idea Group D — Unique / differentiating ideas

### D1. "Rescue missions" — teach to solidify
When student A masters a concept, AI can offer: "Student B is stuck on this — answer their Hive post for 2× XP." Turns the community into the curriculum. Mastery through teaching, Hive gets answers, nobody pays extra AI cost.

### D2. The "ghost of future you"
At onboarding, student records a 30-second voice note: why they're doing this. AI replays/quotes it at motivational low points (long absence, failed boss battle). Cheap, emotionally powerful, nobody does this.

### D3. Job-ready terminus with receipts
Path ends in a capstone gauntlet: full mock interview (interview lab), portfolio project review by AI + mentor, English scenario "salary negotiation." Output: a **verifiable transcript** — every mastered node with dates, attempt counts, Feynman clarity scores. Bootcamp certificate that actually says something.

### D4. Bangla-first explanations, English-first vocabulary
AI explains concepts in Bangla when the student struggles, but always drills the *English interview vocabulary* (English lab exists for this). Local comprehension + global employability — matches the audience precisely.

### D5. "Time machine" replays
On mastering a hard concept, show the student their own first failed attempt beside their passing solution. Self-comparison beats leaderboard comparison for motivation — especially for students prone to comparing themselves to others.

---

## What you missed (gaps to decide on)

1. **Who authors the skeleton?** Biggest open question. Recommend mentor-curated data files (like `visualizer/examples.ts` pattern), AI personalizes only. Pure AI curriculum = quality risk.
2. **AI cost ceiling per student.** You have `AiUsageEvent` telemetry — set a per-student daily budget, degrade gracefully (cached explanations, skip nice-to-have calls). Otherwise engaged students = expensive students.
3. **Anti-cheat / mastery integrity.** Staked challenges have hidden tests, good. But Feynman gates could be gamed with AI-written explanations. Voice-based gates (Live API) are naturally harder to fake — lean on them for gates.
4. **Struggling-student floor.** Adaptive systems quietly let weak students fall behind forever. Define a hard floor: N days stuck on a node → human mentor escalation (Hive escalation flow exists — reuse).
5. **Low bandwidth / mobile reality.** Voice labs are data-heavy. Daily quest should have a text-only fallback mode for bad-connection days so streaks survive.
6. **Outcome measurement.** Define success metrics before building: D7/D30 retention, nodes/week, boss-battle pass rate, and eventually job placement. Otherwise you can't tell if AI features actually help.
7. **Cohort vs self-paced tension.** Squads (C3) imply loose cohorts; the path is self-paced. Decide: squads re-shuffle monthly by pace? Solves both.
8. **Data model.** Needs new Prisma models: `PathNode` (or code-defined skeleton), `PathProgress`, `DailyQuest`, `Squad`. Follow existing `@@map` snake_case + cuid conventions; add `LEARNING_PATH` to `AiFeature` enum and `PLAN` to `AiTask`.

---

## Recommended MVP slice (if/when building)

1. Mentor-authored skeleton (data file) + visual node map page (`/path`)
2. Node = learn→prove loop wiring existing labs (A2) + `PathProgress` model
3. Daily quest + streaks (C1)
4. Weekly AI re-planner + report card (B1 + B4)
Then: boss battles, squads, staking, spaced repetition.

## Verification (for eventual build)
- Seed skeleton, walk one node end-to-end: visualizer → challenge → Feynman gate → node marked mastered → XP awarded
- Simulate a week of sessions, run re-planner, verify plan changes + `AiUsageEvent` rows logged
- Playwright flow on `/path` per existing testing setup (Python314, server :3000)
