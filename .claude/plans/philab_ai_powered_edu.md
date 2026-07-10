# PhiLab — Build the Future of AI-Powered Education

> **Thesis:** Programming Hero teaches with videos, assignments, and human mentors. That model is linear, labor-heavy, and blind to what each student actually understands. PhiLab turns it into an AI-native loop: **practice → speak → prove → get placed** — where every interaction generates skill data, and skill data drives everything else (support, curriculum, retention, hiring).

---

## Table of Contents

1. [Current Problems of Programming Hero](#1-current-problems-of-programming-hero)
2. [Is PhiLab Capable? Honest Assessment](#2-is-philab-capable-honest-assessment)
3. [The Solutions — Problem-by-Problem](#3-the-solutions--problem-by-problem)
4. [Architecture: PhiLab OS for Learning (5 Layers)](#4-architecture-philab-os-for-learning)
5. [Theme Coverage Map](#5-theme-coverage-map)
6. [Phased Roadmap](#6-phased-roadmap)
7. [Workflow — How We Build](#7-workflow--how-we-build)
8. [Future-Proofing](#8-future-proofing)
9. [Why This Plan Wins](#9-why-this-plan-wins)
10. [Risks & Mitigations](#10-risks--mitigations)

---

## 1. Current Problems of Programming Hero

Derived from the Batch-14 curriculum (`ph-present-curriculum.md`), org structure (`present-structure-of-ph.md`), and the hackathon theme list (`probable-themes.md`).

### P1 — Passive learning: video completion ≠ skill
The flagship course is ~60 modules of recorded video + 9 assignments. A student can watch 100% of videos and still freeze at `map()` in an interview. There is **no continuous verification** of understanding between assignments — the gap between "watched" and "can do" is invisible until it's too late.

### P2 — Support doesn't scale (human bottleneck)
1-hour tech support SLA, mentors/TAs doing doubt-solving daily, ~18-person community team. Every batch grows, support cost grows linearly. Mentors answer the **same 50 questions** thousands of times (git push errors, CORS, undefined is not a function). Peak hours = queue explosions. Off-hours = no support.

### P3 — Assignment checking is manual, slow, and shallow
9 assignments × thousands of students × human graders = days of latency, inconsistent rubrics, plagiarism slipping through, and feedback that arrives after the student has already moved 2 modules ahead. Feedback that arrives late is feedback wasted.

### P4 — Dropout is detected after it happens
Student success team makes "dropout follow-up calls" — i.e., they call **after** the student has already disengaged. There is no early-warning signal: falling quiz accuracy, shrinking session time, skipped modules, late-night grinding followed by silence. The data exists; nobody is watching it.

### P5 — One curriculum for every brain
Batch-14 is one linear track. The CS grad and the shopkeeper's son who never wrote code get the same Module 7 at the same pace. No placement diagnostic, no adaptive path, no "you can skip this / you need extra reps here." Fast learners get bored; slow learners silently drown.

### P6 — English + communication barrier kills placements
PH claims 70-80% placement, and SCIC/EJP does mock interviews with **human mentors** — another linear-cost bottleneck. The real killer for BD students is not code: it's explaining code in English, standups, salary talks. There is no infinite-patience practice environment for speaking. Interview confidence is trained in 1.5 weeks; anxiety needs months of reps.

### P7 — Abstract concepts stay abstract
Closures, event loop, recursion, references — the concepts that cause 80% of dropouts in Milestones 2-3 — are taught by talking-head video. Students can't *see* execution. (Modules 13-15, 18-19 "problem solving" are exactly where batches bleed.)

### P8 — No verifiable proof of skill for employers
Certificates say "completed course." Employers want "can this person actually code?" The placement team hand-forwards CVs. There is no employer-facing, tamper-evident skill signal — so every placement requires human vouching.

### P9 — Learning data is trapped and unused
Interview scores, assignment results, helpdesk questions, watch-time — all siloed. No skill graph per student, no aggregate "Batch-14 is collectively weak at async" signal for curriculum developers, no executive dashboard driven by learning outcomes.

### P10 — AI-era skills gap in the curriculum itself
The curriculum added an "AI Mindset" milestone (good), but there is no **practice environment** for AI-era skills: reviewing AI output, catching hallucinations, spec-writing for agents. PH teaches *about* AI; it doesn't train *working with* AI.

---

## 2. Is PhiLab Capable? Honest Assessment

**Verdict: Yes — this is a continuation, not a pivot.** PhiLab is already a working AI-powered education platform; the theme asks us to widen it from "labs" to "learning OS."

### What already exists (live code, not slides)

| Capability | Evidence in codebase |
|---|---|
| 5 working labs | `src/app/labs/{js-motion, interview, feynman, english, support}` |
| Step-through JS interpreter (custom) | `src/lib/visualizer/*`, memory/call-stack/heap views, predict-quiz, challenges |
| Real-time AI voice (EN + **Bengali**) | Gemini Live via ephemeral tokens — `src/app/api/*/token/route.ts` |
| AI grading + structured reports | interview/feynman/english report routes, JSON reports in Postgres |
| Learn-by-teaching (Feynman) + spoken-English practice | strongest-known retention method + BD's #1 placement barrier, both live |
| Live AI support w/ screen share + FIFO queue | `src/app/api/support/*` — queue, heartbeat, concurrency cap |
| Gamification engine | XP ledger, levels, 16 badges — `src/lib/gamification/*` |
| Auth + career profiles (public, shareable) | better-auth, `src/app/profile`, `u/[id]` |
| Persistence for every session | Prisma/Postgres, per-lab session models with transcripts |

### What's missing (the gaps this plan closes)

| Gap | Why it matters | Closed in |
|---|---|---|
| Skill graph / mastery model | Without it, no personalization, no dropout prediction, no proof | Phase 1-2 |
| Curriculum engine (PH course ↔ labs mapping) | Labs float free; must anchor to Batch-14 milestones | Phase 1-2 |
| PH platform integration (helpdesk, assignments) | PhiLab must eat PH's operational pain, not live beside it | Phase 2-3 |
| Teacher/B2B layer | Instructors + student-success team need dashboards | Phase 3 |
| Multiplayer/realtime | Community + retention engine | Phase 3 |
| Single AI provider (Gemini only) | Model churn risk | Phase 1 (adapter) |

---

## 3. The Solutions — Problem-by-Problem

Every problem in §1 gets a concrete PhiLab answer. Most reuse infra that already runs in production.

### S1 → P1 (Passive learning): The Verified Practice Loop
Every video module in Batch-14 gets a **companion lab activity**: watch closures video → step through closure in Js Motion → predict-the-output quiz → explain it aloud in Feynman Lab → mastery recorded. "Module complete" now means *demonstrated*, not *watched*.
- Reuses: interpreter, quiz engine, Feynman lab — all live.
- New: module↔concept mapping table, embeddable widget (iframe) inside PH course pages.

### S2 → P2 (Support bottleneck): AI HelpDesk, Tier-0
Support Session lab becomes the **first line of support**: 24/7, voice, Bengali, screen-share so the AI sees the actual error. Escalation to human mentors only when AI can't resolve — with full transcript + attempted fixes attached, so the mentor starts warm, not cold.
- Reuses: `src/app/api/support/*` queue + Gemini Live + screen share — **already built**.
- New: raise concurrency cap, escalation flow, FAQ auto-mining from transcripts ("40% of this week's questions = CORS" → feeds curriculum team).
- Effect: mentors handle the hard 20%, AI absorbs the repetitive 80%. Support cost stops scaling with enrollment.

### S2b → P2 (Support bottleneck, async side): "Hive" — AI-Driven HelpDesk

Support Session lab covers **live voice**; Hive covers the other 80% of support volume: **posted questions/tickets** (the current HelpDesk from Module 0-7). AI manages everything first; humans are drivers who take the wheel only when AI fails.

**The cycle (every 15-20 min, cron/queue worker):**

```
┌─────────────────────────────────────────────────────────────┐
│  HIVE CYCLE (runs every 15-20 min)                          │
│                                                             │
│  1. SWEEP    pick up new posts + posts with new student     │
│              replies since last cycle                       │
│  2. RESPOND  AI answers with full context: student's        │
│              skill graph, module position, past tickets,    │
│              attached code/screenshot, similar solved posts │
│  3. CHECK    student replied "solved" / reacted ✔ /         │
│              AI verifies from reply → mark RESOLVED         │
│  4. RETRY    unresolved → AI tries different angle          │
│              (attempt 2: new approach; attempt 3: asks      │
│              clarifying question or minimal repro)          │
│  5. ESCALATE after 3 failed attempts (or student clicks     │
│              "need human", or safety/billing/account        │
│              topic) → handed to human mentor WITH full      │
│              thread + what AI already tried + suspected     │
│              cause. Mentor starts warm, never cold.         │
└─────────────────────────────────────────────────────────────┘
```

**Ticket states:** `open → ai_working(attempt 1-3) → resolved | escalated → human_working → resolved`. Append-only attempt log per ticket (same auditable pattern as XpEvent).

**Human-as-driver principles:**
- Every AI reply shows "answered by Hive AI" — honest labeling builds trust.
- "Need human" button always visible; student can skip the AI loop anytime.
- Mentor dashboard: escalated queue ranked by wait time + student risk score; one click shows AI's 3 attempts so mentor never repeats them.
- Mentor's final answer feeds back as training data: next time similar question arrives, Hive cites the mentor-approved solution (RAG over resolved tickets).

**Why the 15-20 min cycle (not instant) is actually right:**
- Batches replies → cheap (one model pass over many tickets, cacheable context).
- Gives students time to try the fix and reply before next sweep — matches real doubt-solving rhythm.
- Beats current 1-hour SLA by 3-4×, 24/7, without instant-chat cost.
- Urgent path exists anyway: Support Session lab for live voice.

**Flywheel:** every resolved ticket enriches the knowledge base → Hive's first-attempt resolution rate climbs → escalations shrink → the same 18-person team supports 10× students. Weekly mining: "top unresolved topics" report to curriculum team (this week 40% = CORS → fix Module 40-8).

**Reuses:** Gemini structured output (report routes pattern), Postgres + Prisma (Ticket/TicketAttempt models mirror session tables), skill graph for student context (L2), risk score for escalation priority.
**New:** cron worker (Vercel cron or queue), ticket UI, mentor dashboard, RAG index over resolved tickets.
**Future-proof:** cycle worker is provider-agnostic (goes through the Phase-1 AI adapter); attempt log means any better future model can replay history; escalation thresholds/cycle timing are config, not code.

### S3 → P3 (Assignment checking): AI-First Grading Pipeline
AI grades every submission in minutes against the rubric: correctness, code quality, requirement coverage — plus **plagiarism/AI-detection heuristics** (style-shift, similarity clustering across batch). Human graders review flagged/borderline cases only. Feedback becomes teaching: each deduction links to the exact lab demo covering that concept.
- Reuses: Gemini structured-output grading pattern (proven in interview/feynman reports).
- New: submission ingestion, rubric schemas, grader review queue.

### S4 → P4 (Late dropout detection): Early-Warning Engine
Every lab session, quiz, XP event, support call already lands in Postgres. Add a risk model over it: falling accuracy + shrinking streak + missed assignment + frustration signals in support transcripts = **risk score**. Student-success team gets a ranked daily list — call the student *before* they vanish, with context ("stuck on Milestone 3, failed recursion quiz 3×").
- Reuses: XP ledger, session tables, transcripts — the data layer exists.
- New: risk scoring job + dashboard for the student-success team.

### S5 → P5 (One-size curriculum): Adaptive Placement GPS + Personalized Path
10-minute diagnostic on enrollment → skill-graph snapshot → personal roadmap over the same Batch-14 content: "skip Module 8 basics, double reps on Milestone 3, estimated job-ready in 94 days at your pace." Recalculates weekly from mastery data. Closed loop: interview report says "weak at closures" → one click opens visualizer preloaded with closure demo → pass quiz → retry interview topic.
- Reuses: interview reports' `improvements` array, demo library, quiz engine.
- New: Concept/MasteryEvent tables, roadmap generator.

### S6 → P6 (English/interview barrier): Infinite Reps at Zero Marginal Cost
Already live: Interview Lab (10 topics, difficulty/pressure levels, Bengali), English Lab (standup, code review, salary negotiation roleplay), Feynman Lab. Extend with **Anxiety Trainer** (graded exposure: friendly AI → neutral → stern panel → interruptions) and company-specific tracks. SCIC's 1.5-week human mock-interview sprint becomes the *final polish* on months of AI reps.
- Effect: every student arrives at SCIC pre-trained; human mentor time drops per placement.

### S7 → P7 (Abstract concepts): Motion Labs family
Js Motion already makes execution visible (memory, call stack, heap, recursion, references — the exact Milestone 2-3 killers). Extend: "Ask to See It" (AI generates runnable snippet for any question), voice tutor narrating steps in Bengali, then Git Motion Lab (top-3 beginner pain), Network Lab (CORS finally clicks).
- Reuses: interpreter accepts arbitrary code today; Gemini codegen is one structured-output call.

### S8 → P8 (No skill proof): Job-Ready Score + Verifiable Credentials
Aggregate quiz mastery + interview scores + drills + projects into one **Job-Ready Score** with a public, shareable, verifiable profile (public profiles already exist at `u/[id]`). Employer portal: browse ranked, verified candidates. Placement team stops hand-vouching; the data vouches.
- Revenue path: employer subscriptions + sponsored challenges.

### S9 → P9 (Trapped data): Executive Analytics on the Skill Graph
Once mastery events flow, dashboards are queries: per-student radar, per-batch weakness heatmap ("Batch-14 collectively weak at async → reshoot Module 26-8"), funnel analytics, support-topic trends. Curriculum developers finally get outcome data, not just watch-time.

### S10 → P10 (AI-era skills): AI-Collaboration Lab
New lab family: **Spot-the-AI-Bug Daily** (find the hallucinated bug in 60s), spec-writing for agents, reviewing AI PRs, "when to trust vs verify." Aligns with curriculum's Milestone 0.5 (AI Mindset) and Milestones 9-10 (AI-first projects) — PhiLab becomes their practice ground.

---

## 4. Architecture: PhiLab OS for Learning

Five layers. Each layer consumes the one below, each independently shippable.

```
┌─────────────────────────────────────────────────────────────┐
│ L5  CAREER LOOP                                             │
│     Job-Ready Score · Verifiable credentials · Employer     │
│     portal · SCIC/EJP integration · Market compass          │
├─────────────────────────────────────────────────────────────┤
│ L4  INSTITUTION (B2B / internal teams)                      │
│     Teacher Copilot · Classroom live mode · Dropout         │
│     early-warning dashboard · Batch weakness heatmaps       │
│     · AI grading review queue                               │
├─────────────────────────────────────────────────────────────┤
│ L3  CURRICULUM ENGINE                                       │
│     Batch-14 module ↔ concept mapping · Adaptive Placement  │
│     GPS · Closed loop (weakness → auto-lesson → retry)      │
│     · Curriculum Autopilot (later)                          │
├─────────────────────────────────────────────────────────────┤
│ L2  INTELLIGENCE                                            │
│     Skill Graph (Concept + MasteryEvent) · AI Mentor with   │
│     Memory (cross-lab, persistent) · Mistake Bank (spaced   │
│     repetition, SM-2) · Risk scoring                        │
├─────────────────────────────────────────────────────────────┤
│ L1  LABS (live today) — practice surfaces                   │
│     Js Motion · Interview · Feynman · English · Support     │
│     + next: AI-Collab · Debugging Dojo · Git Motion ·       │
│     Duel/Royale multiplayer                                 │
├─────────────────────────────────────────────────────────────┤
│ L0  PLATFORM (live today)                                   │
│     Next.js 16 · Gemini Live (ephemeral tokens) · Prisma/   │
│     Postgres · better-auth · XP/badges · profiles           │
└─────────────────────────────────────────────────────────────┘
```

**Key design rule:** every lab interaction writes a `MasteryEvent`. The skill graph is the spine — personalization (L3), dashboards (L4), and credentials (L5) are all *views over the same events*. Build the spine once, everything else compounds.

**New core tables (L2):**
```prisma
model Concept {          // ~120 nodes mapped to Batch-14 curriculum
  id, slug, name, milestone, module, prerequisites[]
}
model MasteryEvent {     // append-only, like XpEvent (proven pattern)
  id, userId, conceptId, source (quiz|interview|feynman|drill|assignment),
  score, createdAt
}
```

---

## 5. Theme Coverage Map

How one platform answers the hackathon theme list (`probable-themes.md`):

| Theme | PhiLab answer | Layer |
|---|---|---|
| AI-Powered HelpDesk | **Hive** (async AI ticket loop, human-as-driver) + Support lab (live voice) | L1/L4 |
| AI Assignment Checking | AI-first grading pipeline | L4 |
| AI Detect Lazy/Dropout Students | Early-warning risk engine | L2/L4 |
| AI Coding Assistant | Voice tutor in visualizer, "explain my bug" | L1 |
| AI Learning Coach | AI Mentor with Memory | L2 |
| AI Personalized Learning Path | Adaptive Placement GPS | L3 |
| AI Community & Engagement | Duel/Royale, pods, streaks, leaderboards | L1 |
| AI Interview & Career Coach | Interview + English + Anxiety Trainer (live) | L1/L5 |
| AI Resume & Portfolio Reviewer | Career toolkit on profile layer | L5 |
| AI Executive Analytics Dashboard | Skill-graph analytics | L4 |
| AI Plagiarism & Integrity Detection | Grading pipeline heuristics | L4 |
| AI Code Review & Optimization | Code Review Lab / AI-Collab Lab | L1 |
| AI Content & Trend Recommendation | Mistake Bank + next-lesson recommender | L2/L3 |
| Open Innovation ("Build the Future…") | **This whole plan** | all |
| Marketing analytics / Sales forecasting / Social dashboard / Internal productivity | Out of scope — not learning-core; skill-graph data can feed enrollment models later | — |

**14 of 18 themes answered by one coherent platform.** That's the pitch: not a feature, a foundation.

---

## 6. Phased Roadmap

Ordering consistent with `selected-idea-rank.md`; each phase ships standalone value.

### Phase 0 — DONE (today)
5 labs, Gemini Live voice EN/BN, gamification, profiles, support queue with screen share.

### Phase 1 — Spine + Quick Wins (weeks)
1. **Skill Graph v1** — Concept + MasteryEvent tables; instrument existing quizzes/reports to emit events.
2. **Closed learning loop** — interview `improvements[]` → preloaded visualizer demo → quiz → retry topic.
3. **Daily Challenge + streaks** — retention engine on existing quiz overlay.
4. **Embeddable widget** — iframe visualizer inside PH course pages (distribution!).
5. **Anxiety Trainer** — persona difficulty ramp on interview lab (XS effort).
6. **AI provider adapter** — thin interface over `@google/genai` so grading/codegen can swap models.

### Phase 2 — Intelligence + PH Integration (1-2 months)
1. **AI Mentor with Memory** — persistent cross-lab tutor, weekly "next 7 days" plan.
2. **Adaptive Placement GPS** — diagnostic → personal roadmap over Batch-14 content.
3. **Mistake Bank** — SM-2 spaced repetition over wrong answers.
4. **Assignment grading pilot** — one assignment, AI-graded, human-reviewed, measure agreement rate.
5. **Hive v1 (AI HelpDesk)** — 15-20 min cycle worker, 3-attempt loop, escalation queue, mentor dashboard; pilot with one batch section. RAG over resolved tickets in v1.1.
6. **HelpDesk escalation flow** — support lab (live voice) → mentor handoff with transcript.
6. **Rickshaw Analogies at scale** + module↔concept mapping for full curriculum.

### Phase 3 — Institution + Community (quarter)
1. **Dropout early-warning dashboard** for student-success team.
2. **Teacher Copilot pilot** — instructor uploads syllabus → visualizer examples + quizzes; live classroom "predict output" polls.
3. **Multiplayer stack** — one realtime investment (WebSocket/Pusher) → Duel, then Ranked Ladder, then Quiz Royale for cohort events.
4. **Batch weakness heatmaps** for curriculum developers.

### Phase 4 — Career Loop + Autonomy (2+ quarters)
1. **Job-Ready Score + verifiable credentials + employer portal** (revenue).
2. **Curriculum Autopilot** — self-adjusting personal course.
3. **Creator economy** — learners publish voice-over lessons, best surface.
4. **New Motion Labs** — Git, Network (one per quarter).

---

## 7. Workflow — How We Build

1. **Fork-don't-modify** — every new lab forks the proven voice-lab pattern (token route → live session → transcript → report/feedback). Support lab proved this: zero edits to existing labs. Keeps shipping risk local.
2. **PRD-first, AI-assisted** — every feature starts with a PRD + prompts + prototype, mirroring what PH itself teaches in Milestones 9-10. We build the way we teach.
3. **Spine-first data rule** — no feature ships without emitting MasteryEvents where applicable. The graph must fatten with every release.
4. **Weekly ship cadence** — Phase 1 items are 1-2 week units; demo internally every Friday; instrument usage before building the next.
5. **Grading trust loop** — every AI-graded artifact (assignment, interview) keeps a human-review sample (~10%) with agreement tracking; publish the agreement rate internally. Trust is earned with data.
6. **Pilot inside PH** — each L4 feature pilots with one real team (one mentor pod, one instructor, one batch section) before batch-wide rollout.

---

## 8. Future-Proofing

- **Model churn** — provider adapter (Phase 1) isolates Gemini; grading prompts + eval sets versioned so any model swap is regression-tested, not vibes-tested.
- **Evaluation harness** — golden transcript/answer sets per grader; CI checks grading drift when prompts or models change.
- **Data ownership** — Skill Passport: exportable, verifiable JSON of a learner's full record. Trust signal + regulatory hedge.
- **Cost control** — per-lab daily rate limits already exist; concurrency caps (support lab pattern) generalize; cheap-model routing for low-stakes tasks.
- **Bengali-first moat** — voice + analogies + explanations in Bengali. Global players won't do this; it compounds.
- **Low-bandwidth mode** — interpreter is fully client-side already; text-only lesson variants + PWA caching for outside-Dhaka reality.
- **Append-only event architecture** — XpEvent pattern extended to MasteryEvent: idempotent, auditable, replayable. New models can re-score history.

---

## 9. Why This Plan Wins

1. **It runs today.** 5 labs, voice AI, gamification, real users' sessions in Postgres. Competing themes start at slide 1; this starts at Phase 1.
2. **One platform, 14 themes.** Most hackathon entries answer one theme. The skill-graph spine makes helpdesk, grading, dropout detection, personalization, and analytics *the same investment*.
3. **Voice + Bengali + real execution state = triple moat.** Python Tutor doesn't talk. LeetCode doesn't speak Bengali. ChatGPT doesn't see your interpreter's heap. Nobody has all three.
4. **It attacks PH's cost structure, not just its product.** Support, grading, and mock interviews are linear human costs. Every solution here converts a linear cost into a fixed one — that's what lets PH scale batches without scaling headcount.
5. **It closes PH's actual funnel.** Learn (labs) → verify (skill graph) → prove (credentials) → place (SCIC/EJP integration). The career loop matches PH's existing marketing promise with data instead of vouching.
6. **No big-bang risk.** Every phase item is independently valuable; if the roadmap stops at Phase 2, PH still has AI helpdesk, adaptive paths, and grading. Compounding, not betting.

---

## 10. Risks & Mitigations

| Risk | Mitigation |
|---|---|
| Gemini dependency (pricing, deprecation) | Provider adapter + eval harness (Phase 1); Live API isolated behind token routes already |
| AI grading trust (students/mentors dispute) | Human-review sampling, published agreement rate, appeal flow, human final say on grades |
| Hallucinated support answers | Escalation path always visible; transcripts audited; safety guardrails proven in support prompt (helpline pattern) |
| Hive gives confidently wrong fix 3× before escalating | Attempt 3 forced to ask clarifying question, not re-answer; "need human" button skips loop anytime; low-confidence answers auto-escalate at attempt 1; first-attempt resolution rate tracked per topic |
| Content pipeline hunger (labs need concepts mapped) | Start with Milestones 1-3 (highest dropout zone), AI-assisted mapping, curriculum team validates |
| Cost blow-up with scale | Rate limits + concurrency caps exist; cheap-model routing; voice reserved for high-value moments |
| Privacy of student risk scores | Risk data visible to student-success team only; student sees supportive framing, never a "lazy" label |
| Team bandwidth | Phase order = effort-ranked (`selected-idea-rank.md`); XS/S items front-loaded |

---

*PhiLab codebase evidence: `src/app/labs/*`, `src/app/api/*`, `src/lib/{gamification,visualizer,interview,support}/*`, `prisma/schema.prisma`. Companion docs: `probable-themes.md`, `present-structure-of-ph.md`, `ph-present-curriculum.md`, `selected-idea-rank.md`, `platform-ideas.md`.*
