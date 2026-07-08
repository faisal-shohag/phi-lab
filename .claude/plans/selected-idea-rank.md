# Phi Lab — Feature Idea Bank

## FINAL RANKING — user's 18 selected ideas (from client/.claude/plans/selected-ideas.md)

Scored on: learning impact / effort (infra reuse) / moat / dependencies. Sequence respects dependencies (XP before Ladder; Duel realtime infra before Royale).

### Phase 1 — Quick wins, weeks not months (mostly reuse existing infra)
| Rank | Idea | Why here | Effort |
|---|---|---|---|
| 1 | **XP / Levels / Badges** | Enabler for Duel, Ladder, Royale, streaks. Score + confetti infra exists. Build FIRST. | S |
| 2 | **Interview Anxiety Trainer** | Smallest delta: persona difficulty ramp on existing interview lab (friendly→neutral→stern→interruptions). Unique feature for near-zero cost. | XS |
| 3 | **Feynman Mode** | Flagship learning feature. Reuses Gemini Live pipeline + report grading pattern. Strongest retention science. | S |
| 4 | **Rickshaw Analogies Engine** | Gemini generation + card renderer. Viral Bengali meme cards = organic growth. | S |
| 5 | **Embeddable Widget** | Iframe route + postMessage. Distribution into Programming Hero courses + blogs. | XS |
| 6 | **Export video/GIF** | Client-side canvas capture of step-through, watermark. Free marketing loop. | S |

### Phase 2 — Voice moat (infra ready, bigger scope)
| Rank | Idea | Why | Effort |
|---|---|---|---|
| 7 | **English-for-Developers Lab** | Gemini Live + Bengali built. Massive underserved market, direct PH audience. New lab shell + prompt catalog. | M |

### Phase 3 — Multiplayer stack (one realtime investment, three features)
| Rank | Idea | Why | Effort |
|---|---|---|---|
| 8 | **Duel Mode** | First WebSocket/Pusher investment + matchmaking. Social + viral. | M |
| 9 | **Ranked Ladder** | ELO + seasons on top of Duel infra. Retention machine. | S after Duel |
| 10 | **Quiz Royale** | 100-player rooms on same realtime infra. Cohort events for PH. | M after Duel |

### Phase 4 — Learning depth
| Rank | Idea | Why | Effort |
|---|---|---|---|
| 11 | **Adaptive Placement GPS** | High retention payoff; needs question bank + mastery model first (XP data feeds it). | M |
| 12 | **Muscle-Memory Drills** | Typing engine + ghost cursor + pattern bank. Solid, not urgent. | M |
| 13 | **Debugging Dojo** | High learning impact; needs AI broken-app generator + approach-grading. Worth it after Phase 1 proves AI grading UX. | M-L |

### Phase 5 — New Motion Labs (each = big engine build; pick one per quarter)
| Rank | Idea | Why | Effort |
|---|---|---|---|
| 14 | **Git Motion Lab** | Best third-lab candidate: top-3 beginner pain, brand fit, isomorphic-git exists. | L |
| 15 | **Network Lab** | CORS/HTTP pain real; animation engine new build. | L |
| 16 | **Code Shorts Feed** | Big content pipeline + mobile-first feed. Strong but content-hungry — do after analogy/lesson generators exist to feed it. | L |
| 17 | **DOM/CSS or SQL Motion Lab** | Render-pipeline visualizer = biggest engine work. Git lab beats it on pain-per-effort. | XL |
| 18 | **System Design Sandbox** | Advanced-tier audience smallest today; `@xyflow/react` helps but traffic sim + AI critique is research-y. Last. | L |

**TLDR order:** XP → Anxiety Trainer → Feynman → Analogies → Widget → GIF export → English Lab → **Support Session Lab (NEXT — user-added)** → Duel → Ladder → Royale → Placement GPS → Drills → Dojo → Git Lab → Network Lab → Shorts → DOM/SQL Lab → System Design.

---

## SUPPORT SESSION LAB — final spec (user-requested, added 2026-07-08)

### Context
User wants a lab where a student talks live by voice with an AI support agent about anything: mental support, a coding problem, or learning guidance. Sessions cap at 10 min. Student writes their problem before joining. Optional screen share so the AI can see a real error in their codebase (AI asks for it when needed). Only **3 sessions may be active platform-wide at once** (global cap, per user); everyone else waits gracefully in a queue. No AI evaluation/report after — instead the student gives a 1–5 star rating + optional comment. Shown on the home page (a 5th lab card). Screen share is in v1.

This is the first Phi Lab feature with a real concurrency constraint and the first to send video to Gemini Live — both new to the codebase. Everything else forks the proven English/Feynman voice-lab pattern (fork-don't-modify: zero edits to existing labs).

### Decisions locked (user)
- Concurrency: **global 3 total** active sessions across the whole platform.
- Placement: **show on home page** (add a 5th card to `labs-showcase.tsx`).
- Screen share: **include in v1** (feasibility confirmed against Google's gemini-live-api-dev skill).

### Concurrency store — RECOMMENDATION: Postgres advisory lock (no new infra)
Codebase today has NO Redis/Upstash, NO advisory locks, NO `$transaction` — idempotency is done purely with unique constraints. For a "max 3 active" gate we need atomic claim-a-slot, so introduce one `$transaction` + a Postgres advisory lock (cleanest option, zero new services, survives redeploy/multi-instance — unlike an in-memory counter which dies on redeploy).

Slot-claim logic, run inside the queue-poll route:
```
prisma.$transaction(async (tx) => {
  await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext('support_slots'))`  // serializes claims; auto-released at tx end
  const active = await tx.supportSession.count({
    where: { status: 'active', lastSeenAt: { gt: new Date(Date.now() - 45_000) } } // stale heartbeat = dead slot, auto-reclaimed
  })
  const slots = 3 - active
  if (slots > 0) {
    // promote the oldest `slots` waiting sessions (FIFO by createdAt) to active, set startedAt
  }
  // recompute this user's position among status='waiting' ordered by createdAt
})
```
Client polls `GET /api/support/queue?id=` every ~4s while waiting; each poll doubles as a heartbeat (`lastSeenAt = now()`). Closed tab → heartbeat stops → slot frees within 45s. No WebSocket needed. Redis rejected: adds a service + secret for one counter, not worth it at this scale.

### Screen share — CONFIRMED path (Google gemini-live-api-dev skill)
`@google/genai ^2.10.0` is already installed. Video frames go over the SAME session as audio:
```js
session.sendRealtimeInput({ video: { data: base64Jpeg, mimeType: 'image/jpeg' } })  // 'video' key, NOT 'media'
```
Capture: `navigator.mediaDevices.getDisplayMedia()` → draw frame to canvas → downscale to ≤1024px → `toDataURL('image/jpeg', ~0.6)` → strip prefix → send.
Two hard constraints from the skill that MUST shape the token config:
- **Audio-only session = 15 min without compression; audio+VIDEO = only 2 min without compression.** A 10-min session with screen share on therefore REQUIRES context-window compression enabled in the token's `config` (add `contextWindowCompression`). Enable it always (session target is 10 min, near the 15-min audio ceiling anyway).
- Default turn coverage sends ALL video frames (cost). Send frames at ~1 fps and only while the user is actually sharing; stop the interval when share is off. Connection lifetime ~10 min → keep the English lab's existing session-resumption/reconnect logic.

### Prisma — new model + User relation (mirrors EnglishSession shape)
```prisma
model SupportSession {
  id         String    @id @default(cuid())
  userId     String
  user       User      @relation(fields: [userId], references: [id], onDelete: Cascade)
  category   String    // 'coding' | 'mental' | 'guidance' | 'other'
  problem    String    // written before joining, feeds systemInstruction
  status     String    @default("waiting") // waiting | active | completed | abandoned
  transcript Json?
  rating     Int?      // 1-5, set after session
  feedback   String?   // optional comment
  lastSeenAt DateTime  @default(now())  // heartbeat; stale (>45s) active row = reclaimable slot
  startedAt  DateTime? // set when promoted to active
  endedAt    DateTime?
  createdAt  DateTime  @default(now()) // FIFO queue order
  updatedAt  DateTime  @updatedAt
  @@index([status, createdAt])  // queue scan + slot count
  @@map("support_session")
}
```
Add `support SupportSession[]` to the `User` model. Migration name: `support_session`. Remember the project gotcha: after `prisma migrate dev` run `npx prisma generate` AND restart the :3000 dev server (stale client = "Cannot read properties of undefined").

### Flow / screens (all NEW files, fork English lab; reuse interview presentational components)
1. **Setup** (`idle` phase) — category picker (Coding / Mental / Guidance / Other) + required "Describe your problem" textarea (min ~20 chars). On submit → `POST /api/support/session` creates a `waiting` row → go to waiting screen.
2. **Waiting screen** (NEW, no analog in other labs) — calm animated UI, shows queue position ("You're #2 in line") + rough ETA (position × ~10 min), "Leave queue" button (`DELETE` → `abandoned`). Polls `/api/support/queue` (also the heartbeat). When the poll returns `status:'active'` → auto-advance to green room.
3. **Green room** — reuse `MicCheck` + `SpeakingOrb` (`@/components/interview/`), mic permission. On start → `POST /api/support/token` → connect Gemini Live.
4. **Live session** — fork `use-english.ts` → `use-support.ts`: rename roles `coach/learner` → `agent/student`, set `ROUND_SECONDS = 600`, keep `startCountdown` + `WRAP_UP_AT` nudge (raise to ~30s), reuse `CountdownRing`, transcript PATCH sync + heartbeat, keep reconnect/session-resumption. Add screen-share button (`getDisplayMedia` → 1fps JPEG via `sendRealtimeInput({ video })`), stop-share button, auto-stop on end. Toast warning at ~1 min left.
5. **End** — at 10:00 or user-ends → `POST /api/support/sessions/[id]/end` sets `status:'completed'` + `endedAt` (frees the slot immediately) and awards a small idempotent XP (`support_completed`, ~20 XP). **No AI report generated.**
6. **Feedback screen** (replaces report-screen) — 5-star rating (required to submit) + optional comment → `POST /api/support/sessions/[id]/feedback`. "Skip" allowed.

### System instruction (`src/lib/support/prompt.ts`, mirrors `buildCoachInstruction`)
`buildSupportInstruction(category, problem)` → `string[]`.join('\n'):
- Warm, patient supporter persona; adapt tone by category.
- Coding: ask clarifying questions, **request screen share when a visual/error would help**, guide rather than dump full solutions.
- Mental: empathetic listener, NOT a therapist; on serious-distress/self-harm signals gently point to real human help (BD: Kaan Pete Roi **09612-119911**) and never diagnose. **[safety — keep this line explicit and non-compressed]**
- Told the session is ~10 min; wrap up warmly when time is nearly up.
- Seed the student's written `problem` so the agent opens already aware of it.

### Routes (all under `src/app/api/support/`)
- `POST /session` — create waiting row (category, problem). Rate limit: max 3 sessions/user/day (count since UTC midnight, mirror english token route).
- `GET /queue?id=` — the advisory-lock claim transaction above; heartbeat + returns `{ status, position }`.
- `DELETE /session/[id]` — leave queue → `abandoned` (ownership-checked).
- `POST /token` — mint ephemeral Gemini token ONLY if the session is `active` AND owned by caller; lock `systemInstruction`/voice in `liveConnectConstraints`; enable `contextWindowCompression`; 10-min expiry.
- `PATCH /sessions/[id]/transcript` — transcript sync + heartbeat (reuse english pattern, `RouteContext<...>` typed, `await ctx.params`).
- `POST /sessions/[id]/end` — complete, free slot, award XP.
- `POST /sessions/[id]/feedback` — save `rating` (1–5) + `feedback`.

### Files
New: `src/lib/support/{prompt.ts, use-support.ts, screen-share.ts}`; `src/components/support/{support-lab, setup-screen, waiting-screen, green-room, live-screen, feedback-screen}.tsx`; `src/app/labs/support/page.tsx`; the 7 routes above.
Additive edits only: `prisma/schema.prisma` (new model + User relation), `src/lib/gamification/reasons.ts` (`supportXp` helper), `award.ts` + `badges.ts` (optional `support_completed` stat + a "Got Help"/"Reached Out" badge), `src/components/landing/labs-showcase.tsx` (5th card — grid already `lg:grid-cols-2`, add rose/teal accent branch). Reused read-only: `SpeakingOrb`, `MicCheck`, `CountdownRing`, `useAnalyserLevel`, `@/lib/interview/audio`, `@/lib/interview/errors`, `awardXp`.

### Things user didn't specify — added
- Stale-slot reclaim (45s heartbeat) so a dead tab can't hold a slot for 10 min.
- Visible 10-min countdown + 1-min warning + AI told to wrap up.
- Leave-queue button; waiting rows auto-expire to `abandoned` after no heartbeat.
- Daily rate limit (3/user/day) so the tiny 3-slot pool stays usable.
- Mental-health safety guardrail (BD helpline) in the prompt.
- Transcript saved (enables a `/labs/support/history` page in a later pass).
- Small XP + optional badge, consistent with the gamification layer.
- Context-window compression forced on (required for 10-min + video).

### Verification (end-to-end)
- **Queue:** open 4 browser sessions (or curl 4 `POST /session`) → 4th gets `status:'waiting'`, position 1; end one active → 4th promotes to `active` within one ~4s poll.
- **Stale reclaim:** start a session, kill the tab → within 45s the queue poll shows a freed slot (heartbeat stopped).
- **Screen share:** share a VS Code window with a visible error → confirm the AI verbally references it (proves `sendRealtimeInput({ video })` reaches the model; watch WS for close code 1011 = config-in-connect mistake).
- **10-min + compression:** run a full session past 2 min with screen share on → must NOT drop at the 2-min audio+video ceiling (confirms compression enabled).
- **Feedback + XP:** submit 4-star rating → row updates; `support_completed` XP awarded once (retry `end` POST → `awarded:false`).
- **Home card:** landing page shows 5 lab cards, Support card links `/labs/support`.

---


## ROUND 6 — AI-era skills, content formats, creator economy, competition

1. **AI-Collaboration Lab** — teach the #1 new job skill: writing specs for AI, reviewing AI output, catching hallucinations, when to trust vs verify. No platform teaches "how to work with AI" as curriculum.
2. **Spot-the-AI-Bug Daily** — daily snippet of AI-generated code with one subtle hallucinated bug; find it in 60 seconds. Trains exactly the review skill AI era demands.
3. **Code Shorts Feed** — TikTok-style vertical swipe feed: 30-second concept animations + one-tap quiz. Converts doomscrolling time into learning; mobile-native Gen Z format.
4. **Learner Creator Economy** — learners record voice explainer over visualizer steps, publish as lesson, earn points/revenue share when others learn from it. Best explainers surface; platform content grows itself.
5. **Ranked Ladder (code e-sports)** — ELO-rated 1v1 code duels, seasons, Bronze→Grandmaster ranks, spectate top matches. Valorant progression psychology applied to learning.
6. **Learning Wrapped** — monthly/yearly shareable recap: concepts mastered, streak, percentile, biggest comeback. Spotify-Wrapped viral loop.
7. **Interview Anxiety Trainer** — graded exposure therapy: friendly AI first, then neutral, then stern panel, then interruptions. Confidence is half the interview; nobody trains it.
8. **Bengali Voice-to-Code** — absolute beginner speaks intent in Bengali, code appears with explanation. Removes English barrier at entry point entirely.
9. **Comic Concept Series** — auto-generated comic strips explaining concepts with Bengali humor; shareable, printable for classrooms.
10. **30-Day Public Build Challenge** — cohort ships daily, public progress page, finishers featured. Accountability + portfolio + community in one.
11. **Learn-to-Earn Micro-Scholarships** — telco/company sponsors: milestone completion earns data packs, course credits. Removes cost barrier, sponsors get talent pipeline visibility.
12. **Skill Passport** — learner owns full record: export API, verifiable JSON, works with any employer/platform. Data ownership as trust signal.
13. **IoT Starter Lab** — cheap ESP32 kit pairs with browser lab via WebSerial; JS code blinks real LEDs. Physical results = strongest beginner motivation known.
14. **Accessibility Pack** — dyslexia-friendly fonts, tuned screen-reader flow for visualizer, colorblind-safe palettes, reduced-motion mode. Widens funnel, mostly one-time cost.

---

## ROUND 5 — AI-native frontier, teachers/institutions, new interfaces

1. **AI Apprentice (teach the agent)** — inversion of tutoring: learner TEACHES an AI agent that starts knowing nothing; agent may only use what learner taught it, then attempts test problems. Agent's score = proof of learner's understanding. Deeper than Feynman mode — knowledge actually executes.
2. **Curriculum Autopilot** — "make me a React dev in 90 days, 1 hour/day" → AI generates full personal course, adjusts daily based on performance, reroutes when learner falls behind. Course that rebuilds itself.
3. **Teacher Copilot (B2B)** — instructor uploads syllabus; AI generates visualizer examples, quizzes, assignments; live classroom dashboard shows which student is stuck on which step in real time. Sell to universities/bootcamps.
4. **Classroom Live Mode** — instructor projects visualizer, students follow on phones, live "predict output" polls, class understanding heatmap. Programming Hero instructor courses direct fit.
5. **Previous-Year Question Engine** — upload university past exam papers; AI builds targeted prep course + grades practice answers. Past-question culture is dominant in BD academia; huge demand, zero tools.
6. **YouTube-to-Lab Converter** — paste any coding tutorial URL; AI extracts the code, makes it runnable in visualizer, generates quiz. Captures learning that already happens on YouTube.
7. **Inter-University League** — BUET vs DU vs NSU coding league, seasonal standings, university pride leaderboards. Rivalry = self-sustaining engagement.
8. **Company Interview Database** — crowdsourced, verified real interview questions from BD + remote companies; AI practice mode per company. Glassdoor-for-BD + practice combined.
9. **Emotion-Aware Tutor** — detects frustration from voice tone/retry patterns, lowers difficulty, switches analogy, encourages in cultural context. Dropout prevention at the moment it happens.
10. **Personal Knowledge Wiki (auto second brain)** — every concept learned becomes an auto-linked note with your own examples/mistakes; searchable, exportable to Notion/Obsidian. Your learning becomes an asset you keep.
11. **Earbuds Course Mode** — full conversational audio courses: learn while walking/commuting, answer by voice, no screen. Distinct from session recaps — complete curriculum, hands-free.
12. **Lock-Screen Learning Widget** — one concept card / micro-quiz on phone lock screen per unlock. Dozens of micro-exposures daily, zero effort.
13. **AR Textbook Overlay** — point camera at printed code in a textbook; AR overlays live execution animation on the page. Paper textbooks still rule BD classrooms.
14. **Parent Dashboard + Family Plan** — weekly progress report for parents, sibling accounts. Parents drive education spending decisions in BD; give them visibility, they pay.

---

## ROUND 4 — Real-world / career / play angle

1. **Freelance Lab** — Upwork/Fiverr simulator: AI plays client, learner writes proposal, negotiates price, handles scope creep, delivers, gets reviewed. Bangladesh = world's #2 freelancing country; nobody trains the non-code half.
2. **Client Simulator** — AI non-technical client changes requirements mid-project, is vague, gets impatient. Learner practices requirement extraction + saying no. Voice-based (Gemini Live).
3. **Open-Source Launcher** — AI finds good-first-issues on GitHub matched to learner's skill graph, walks through fork → fix → PR → review. Real green squares on real resume.
4. **Codebase Tourism** — guided AI tours inside famous real repos (Express, Lodash, React) at learner's level: "here is how Express parses routes". Reading real code, safely guided.
5. **Project Incubator** — learner brings own app idea; AI scopes it into 2-week milestones, unblocks weekly, ships portfolio piece. Most personal projects die from bad scoping, not bad code.
6. **Legacy Refactor Gym** — real ugly legacy code, learner must add feature without breaking hidden tests. The actual day-1 job experience.
7. **Code Quest RPG** — story-driven adventure: repair the spaceship by writing real JS, unlock chapters by passing challenges. Narrative + code for teens/beginners; nobody does this well.
8. **AI Live Coding Streams** — Twitch-style: AI builds a project live with voice narration, viewers vote next step, anyone can pause and ask "why?". Passive-to-active learning bridge.
9. **Job Post Decoder** — paste any job ad; AI maps requirements against learner's skill graph, shows gap list + estimated prep time + auto-generated study plan.
10. **Cohort Pods** — auto-matched squads of 5 with shared weekly goal, pod streak, pod-vs-pod leaderboard. Peer pressure > willpower.
11. **Hackathon Weekends** — monthly 48h themed sprint, AI judges + human showcase, winners featured. Community heartbeat.
12. **Verifiable Credentials + Employer Portal** — proctored skill exams issue tamper-proof shareable certs; employers browse ranked job-ready learners, sponsor challenges. Closes loop: learn → prove → hired. Revenue stream.
13. **Career Market Compass** — live data: "learn TypeScript next: +40% of BD remote job posts require it, median salary X". Learning decisions driven by market data.
14. **Team Sprint Simulator** — 4 learners + AI product manager build one feature together for 2 weeks: standups, task split, merge conflicts. Only way to learn teamwork before first job.

---

## ROUND 3 — Learner-help ideas (different angle: habits, science, access, motivation)

1. **Feynman Mode (learn by teaching)** — learner explains concept by voice to AI "confused junior" persona who asks naive questions; AI grades explanation clarity + gaps. Teaching = strongest retention method known. Gemini Live infra exists.
2. **Error Translator (free standalone tool)** — paste any error/stack trace, get plain Bengali/English explanation, likely fix, prevention tip. SEO magnet + funnel into platform.
3. **Photo-to-Code** — snap phone photo of textbook page, whiteboard, or exam sheet; AI OCRs, explains, makes it runnable. Mobile-first; matches how BD students actually study (paper).
4. **WhatsApp/Telegram micro-lessons** — daily 2-minute lesson + one quiz question delivered in chat apps learners already open 50×/day. Streak kept via replies. No app visit needed.
5. **Audio Recap Podcast** — end of each session, AI generates 3-minute personalized recap episode ("today you learned closures, you struggled with..."); listen on bus commute. TTS available.
6. **Adaptive Placement GPS** — 10-minute diagnostic test → personal roadmap with "you are here" map and estimated days-to-job-ready at current pace; recalculates weekly.
7. **Rickshaw Analogies Engine** — every abstract concept auto-explained with local everyday analogy (event loop = rickshaw queue, closure = tiffin box) in Bengali/English, shareable meme-card visuals. Culture-native learning, viral on social.
8. **AI Study Group** — discuss a problem with 2–3 AI peers of different skill levels; one is wrong sometimes, learner must catch it and argue. Trains discussion + confidence for real teams.
9. **Muscle-Memory Drills (Code Karaoke)** — retype canonical patterns (fetch+await, map/filter/reduce, promise chains) against ghost cursor until fluent. Fluency ≠ understanding; both needed.
10. **Peer Mentor Matching** — advanced learners mentor beginners in-platform; mentors earn verified badges/certificates. Community scales support at zero cost.
11. **Low-Bandwidth Mode** — 2G-friendly text-only lesson variants, offline PWA caching. Connectivity is real barrier outside Dhaka.
12. **Job-Ready Score** — one number aggregating quiz mastery + interview scores + drills, shareable public link for employers. Motivation + hiring bridge.
13. **Focus Guardian** — detects grind patterns (late-night 4-hour sessions, falling accuracy), suggests breaks, offers streak-freeze. Prevents burnout dropout.
14. **Browser Extension** — highlight code on any website → "Open in Phi Lab" → visualizer/explainer. Meets learners where they read.

---

## NEW LABS (user request: beyond existing visualizer + interview)

### A. Ticket Lab — "First Job Simulator" ⭐ top pick
Simulated workplace: learner gets Jira-style ticket + small starter repo in browser (WebContainers/StackBlitz SDK), implements feature, opens PR, AI senior dev reviews line-by-line, requests changes, approves. Optional voice standup with AI teammates (Gemini Live reuse). Trains the actual job skill no course teaches. Nothing like it exists for beginners.

### B. English-for-Developers Lab (voice)
Bengali-speaking devs practice technical English by voice: explain code aloud, mock standup, salary negotiation roleplay. Gemini Live + Bengali support already built. Massive underserved BD/South-Asia market; direct Programming Hero audience fit.

### C. Debugging Dojo
Gallery of intentionally broken mini-apps (AI-generated, infinite supply). Learner fixes under optional timer; AI grades the *approach* (did they read the error? binary-search the cause?) not just the fix. Debugging = most undertrained skill.

### D. Code Review Lab
Learner is the reviewer: AI-planted PRs with subtle bugs, learner leaves comments, AI scores what they caught/missed. Trains reading + reviewing — interview-relevant, unique.

### E. Git Motion Lab
Interactive commit/branch/merge/rebase visualizer with real git commands (isomorphic-git in browser). Top-3 beginner pain point; fits "Motion Lab" brand family.

### F. Network Lab — "Watch the Request"
Animate real fetch: DNS → TCP → TLS → headers → CORS preflight → response. Learner fires requests at live sandbox endpoints, sees every hop. CORS/auth/cookies finally click.

### G. System Design Sandbox (advanced tier)
Drag components (LB, cache, DB, queue) onto canvas (`@xyflow/react` installed), simulate traffic load, watch bottlenecks glow red, AI critiques design by voice. Pairs with interview lab for seniors.

### H. Quiz Royale (live multiplayer)
Kahoot-style 100-player live code quiz, instructor-hosted or daily auto-run. Streaks, leaderboard. Community + retention engine for Programming Hero cohorts.

### I. AI Mentor with Memory (platform layer, not a lab)
Persistent tutor across all labs: remembers weaknesses, sends weekly progress email, plans "next 7 days" study path. DB + auth already exist; becomes the glue between labs.

### J. Career Toolkit
Resume builder with AI/ATS check, auto portfolio page from completed labs, job-application tracker. Monetizable; natural exit point of learning journey.

Quick-list extras: Regex engine visualizer (backtracking animation) • SQL query lab (joins animated) • TypeScript type-inference lab • Terminal/Linux lab with visual filesystem • typing-for-coders trainer • npm dependency-graph explorer • "build in public" project showcase with community votes.

---


## Context
Phi Lab = two labs today: Js Motion (custom step-through JS interpreter, quiz mode, share links) + Interview Lab (Gemini Live voice interview, EN/Bengali, scored reports in Postgres). Goal: ideas that make learning easier, faster, more modern. Grouped by impact; each notes what existing code it reuses.

## Tier 1 — Game-changers (unique moat)

### 1. AI Voice Tutor inside Js Motion Lab ("Talking Visualizer")
Gemini Live narrates each execution step aloud; learner interrupts by voice: "why did `x` become 5?" — AI answers using the interpreter's actual state snapshot at that step.
- Reuses: `gemini-live-feature` skill, `use-interview.ts` audio pipeline, `interpreter.ts` trace (feed current step's stack/heap as context).
- Matches tagline literally: "Watch it think. Say it out loud."
- Nobody has voice + real execution-state grounding. Python Tutor doesn't talk.

### 2. Closed learning loop: Interview → Weakness → Auto-lesson
Interview report's `improvements` array maps to js-motion topics. "You struggled with closures" → one-click opens visualizer preloaded with closure demo + quiz. After passing quiz → "retry interview on this topic".
- Reuses: report JSON already structured, `DEMO_EXAMPLES`, `quiz.ts`, retry button.
- Turns two separate labs into one product.

### 3. AI-generated custom visualizations ("Ask to See It")
Prompt box: "show me async/await with two fetches racing". Gemini generates runnable snippet, interpreter steps it, AI adds per-step annotations.
- Reuses: interpreter accepts arbitrary code already; Gemini structured output pattern from `api/interview/report`.
- Infinite lesson content, zero authoring cost.

### 4. What-if time travel (fork the timeline)
Pause at any step, edit a variable in the memory panel, execution forks; show both timelines side by side.
- Reuses: `interpreter.ts` snapshots; deterministic replay already exists.
- Teaches causality — the thing beginners lack most.

### 5. Predict-then-Step mode
Before each step (or key steps), learner types/picks predicted value of changed variable. Interpreter grades instantly. Wrong predictions become spaced-repetition cards (see #8).
- Reuses: quiz engine, trace diffing.
- Active recall > passive watching; this alone moves learning speed.

## Tier 2 — High impact

### 6. Skill Graph + Mastery Map
Concept nodes (hoisting, closures, event loop, async…) scored from quiz results + interview sub-scores. Radar/graph view (`recharts`, `@xyflow/react` already installed). Recommends next lab.
- New Prisma tables: `Concept`, `MasteryEvent`.

### 7. Daily Challenge + Streaks + Leaderboard
One predict-the-output snippet per day. Streak counter, confetti (exists), weekly leaderboard.
- Cheap: reuse quiz overlay + one cron/table. Retention engine.

### 8. Spaced repetition ("Mistake Bank")
Every wrong quiz answer / low interview rating saved; resurfaced on schedule (SM-2). Dashboard: "5 cards due today."

### 9. Duel mode (multiplayer predict-race)
Two learners, same snippet, race to predict output. Realtime via WebSocket/Pusher. Social + viral.

### 10. Creator mode / Guided walkthroughs
Teachers annotate steps (text per step index), publish as lesson with share URL; store in DB instead of hardcoded `examples.ts`. Community lesson gallery. Programming Hero instructors become content flywheel.

### 11. Resume-aware interview
Upload resume/paste job description; Gemini tailors questions. One prompt change in `topics.ts` system-instruction builder + file upload.

### 12. Behavioral + system-design interview modes
New topic categories; system design adds shared whiteboard (excalidraw embed) that Gemini "sees" via snapshots.

### 13. Bengali-first step narration
Interview already bilingual; add Bengali explanations to visualizer step descriptions + AI tutor. Huge for the core market — almost no Bengali code-visualization tools exist.

## Tier 3 — Quick wins / growth

### 14. Export step-through as video/GIF for social sharing (ffmpeg skill available). "Made with Phi Lab" watermark = free marketing.
### 15. Embeddable visualizer widget (iframe) for blogs and Programming Hero course pages.
### 16. Voice commands in visualizer ("step", "run", "show heap") — accessibility + mobile.
### 17. XP / levels / badges layer over both labs (confetti + score infra exists).
### 18. Certificates at milestones (topic mastered, interview score ≥ 80).
### 19. Company-track interviews (Google-style, local BD company style).
### 20. PWA/offline mode — interpreter is fully client-side already.
### 21. Third lab candidates: DOM/CSS Motion Lab (event bubbling, flexbox, render pipeline) or SQL Motion Lab.
### 22. "Explain my bug" — paste broken code + expected behavior; AI pinpoints exact step where state diverges.

## Recommended first build
#1 (Voice Tutor) or #2 (closed loop) — both mostly re-wire existing pieces, both are differentiators no competitor (Python Tutor, JS Visualizer 9000, LeetCode) has.
