# Hive — AI-Powered Helpdesk for PhiLab: Implementation Plan

All paths relative to `client/`. Grounded in: prisma/schema.prisma, src/app/api/analogies/generate/route.ts (canonical Gemini structured-output route), src/lib/gamification/{award,reasons,badges}.ts, src/lib/auth-server.ts, src/lib/support/queue.ts (advisory lock), src/lib/visualizer/share.ts (js-motion preload via `?code=` lz-string param), src/app/globals.css (CSS-var theme), package.json. Next.js `after()` confirmed available (node_modules/next/dist/docs/01-app/03-api-reference/04-functions/after.md) — runs post-response within route `maxDuration`.

## Key design decisions (answers to the 11 questions)

1. **Schema**: Announcements/encouragement = post `type` on one `HivePost` model (single feed, pinning trivial). KB archive = post `status ARCHIVED` (no separate model) + AI-distilled `kbSummary`; archived posts exempt from cleanup. Attempt log = AI replies themselves (`aiAttempt` field) + append-only `HivePostEvent` timeline. `Role` enum on User. Full schema below.
2. **Cleanup**: both. Lazy sweep on feed GET (cheap `deleteMany`, throttled) as primary; `vercel.json` daily cron hitting `POST /api/hive/cleanup` (Bearer `CRON_SECRET`) as belt. Works locally and on Vercel.
3. **Duplicate detection**: Postgres full-text search. Migration adds a generated `tsvector` column (title+body+kbSummary) + GIN index on `hive_post`; query with `websearch_to_tsquery` + `ts_rank` over RESOLVED/ARCHIVED posts via `$queryRaw`. No pgvector, no extra Gemini call for v1. Honeycomb search reuses the same index.
4. **Markdown**: render with `react-markdown` + `remark-gfm` + `rehype-highlight` (+ one highlight.js theme CSS scoped to `.hive-md`). Ignore the unused `prismjs` dep — rehype-highlight/lowlight is the maintained React-19-safe path. Editor = shadcn Textarea with Write/Preview tabs + small toolbar (code block, image) + drag-drop upload. No rich editor.
5. **Cloudinary**: **signed** upload, no SDK — sign params with `node:crypto` sha1 in `POST /api/hive/upload/sign`; client uploads directly to `https://api.cloudinary.com/v1_1/<cloud>/image/upload`. Env: `CLOUDINARY_CLOUD_NAME`, `CLOUDINARY_API_KEY`, `CLOUDINARY_API_SECRET` (folder fixed server-side to `philab/hive`). Max 4 images/post, 5MB each.
6. **Notifications**: `HiveNotification` model + bell client component polling `GET /api/hive/notifications` every 30s; `PATCH` marks read. No websockets.
7. **AI reply flow**: on `POST /api/hive/posts` → create post + `created` event → **triage inline** (fast structured call; needed to route sensitive topics + show tags immediately) → if sensitive: escalate + return; else set `AI_WORKING`, return post to client, and generate the answer inside `after()` (with `export const maxDuration = 60`). The post page shows "Bee is thinking…" and polls the post GET until the AI reply lands. Follow-up attempts and peer-answer verification also run in `after()`.
8. **Routes**: pages `/hive` (feed), `/hive/new`, `/hive/[id]`, `/hive/honeycomb`, `/hive/mentor`; APIs listed below.
9. **Bee theme**: `src/app/hive/layout.tsx` wraps children in `<div data-theme="hive">`; globals.css gets `[data-theme="hive"] { --primary: <amber oklch>; --ring/--accent/--chart-* … }` and a `.dark [data-theme="hive"]` block. shadcn components read CSS vars, so everything inside re-themes amber without touching the global pink. Extra tokens `--hive-honey`, `--hive-comb` + a hexagon-pattern utility class.
10. **XP/badges**: reasons `hive_post_created` 5, `hive_reply_posted` 5 (daily-capped), `hive_answer_approved` 25, `hive_answer_accepted` 40 (+10 to asker as `hive_question_resolved`), `hive_weekly_queen` 100. Badges: `worker-bee`, `pollinator`, `hive-hero`, `queen-bee`. Nectar reactions give no XP in v1 (spam-proof); they feed the leaderboard.
11. **Phases**: 5 mergeable increments below.

---

## 1. Prisma schema additions (one migration in Phase 1, FTS migration in Phase 4)

```prisma
enum Role { STUDENT MENTOR ADMIN }

// User: add
//   role Role @default(STUDENT)
//   + relations: hivePosts HivePost[] @relation("PostAuthor"), assignedHivePosts HivePost[] @relation("PostMentor"),
//     hiveReplies HiveReply[], hiveReactions HiveReaction[], hiveNotifications HiveNotification[], hiveFollows HiveFollow[]

enum HivePostType { QUESTION ANNOUNCEMENT ENCOURAGEMENT }
enum HivePostStatus { OPEN AI_WORKING ESCALATED RESOLVED ARCHIVED }

model HivePost {
  id             String         @id @default(cuid())
  authorId       String?        // null for AI-authored (encouragement) posts
  author         User?          @relation("PostAuthor", fields: [authorId], references: [id], onDelete: Cascade)
  type           HivePostType   @default(QUESTION)
  title          String
  body           String         // markdown
  images         String[]       @default([])   // cloudinary secure_urls
  tags           String[]       @default([])   // from triage
  topic          String?        // triage: e.g. "javascript", "css"
  milestone      String?        // triage: course milestone guess
  severity       String?        // 'low' | 'medium' | 'high'
  sensitive      Boolean        @default(false)
  status         HivePostStatus @default(OPEN)
  aiAttemptCount Int            @default(0)    // 0..3
  assignedMentorId String?
  assignedMentor User?          @relation("PostMentor", fields: [assignedMentorId], references: [id], onDelete: SetNull)
  acceptedReplyId String?       @unique        // plain unique string, no FK (avoids circular relation)
  pinned         Boolean        @default(false) // announcements
  kbSummary      String?        // AI-distilled summary written at archive time
  expiresAt      DateTime       // createdAt + 3 days (questions); far future for announcements
  resolvedAt     DateTime?
  archivedAt     DateTime?
  createdAt      DateTime       @default(now())
  updatedAt      DateTime       @updatedAt
  replies        HiveReply[]
  events         HivePostEvent[]
  reactions      HiveReaction[]
  follows        HiveFollow[]

  @@index([status, pinned, createdAt])
  @@index([expiresAt, status])
  @@index([authorId, createdAt])
  @@index([assignedMentorId, status])
  @@map("hive_post")
}

enum HiveAuthorType { STUDENT MENTOR AI }
enum HiveReplyKind { ANSWER CLARIFYING_QUESTION COMMENT }
enum HiveVerification { NONE PENDING APPROVED REJECTED }

model HiveReply {
  id           String           @id @default(cuid())
  postId       String
  post         HivePost         @relation(fields: [postId], references: [id], onDelete: Cascade)
  authorType   HiveAuthorType
  authorId     String?          // null when authorType == AI
  author       User?            @relation(fields: [authorId], references: [id], onDelete: Cascade)
  kind         HiveReplyKind    @default(COMMENT)
  body         String           // markdown
  images       String[]         @default([])
  aiAttempt    Int?             // 1|2|3 on AI answers — this IS the attempt log
  stillStuck   Boolean          @default(false) // student pressed "still stuck" with this reply
  verification HiveVerification @default(NONE)  // Bee-Approved pipeline for peer ANSWERs
  verifyNote   String?          // AI's one-line verdict note
  createdAt    DateTime         @default(now())
  reactions    HiveReaction[]

  @@index([postId, createdAt])
  @@index([authorId, createdAt])
  @@map("hive_reply")
}

// Append-only status timeline (audit spirit): created, triaged, ai_attempt_1..3,
// escalated, mentor_assigned, resolved, archived.
model HivePostEvent {
  id        String   @id @default(cuid())
  postId    String
  post      HivePost @relation(fields: [postId], references: [id], onDelete: Cascade)
  type      String
  meta      Json?
  createdAt DateTime @default(now())
  @@index([postId, createdAt])
  @@map("hive_post_event")
}

// Nectar reactions. targetKey = "post:<id>" | "reply:<id>" makes the unique
// constraint work despite nullable FKs (PG treats NULLs as distinct in uniques).
model HiveReaction {
  id        String     @id @default(cuid())
  userId    String
  user      User       @relation(fields: [userId], references: [id], onDelete: Cascade)
  postId    String?
  post      HivePost?  @relation(fields: [postId], references: [id], onDelete: Cascade)
  replyId   String?
  reply     HiveReply? @relation(fields: [replyId], references: [id], onDelete: Cascade)
  targetKey String
  createdAt DateTime   @default(now())
  @@unique([userId, targetKey])
  @@index([replyId])
  @@index([postId])
  @@map("hive_reaction")
}

model HiveFollow {
  id        String   @id @default(cuid())
  userId    String
  user      User     @relation(fields: [userId], references: [id], onDelete: Cascade)
  postId    String
  post      HivePost @relation(fields: [postId], references: [id], onDelete: Cascade)
  createdAt DateTime @default(now())
  @@unique([userId, postId])
  @@map("hive_follow")
}

// type: 'reply' | 'bee_approved' | 'accepted' | 'escalated' | 'mentor_assigned'
//     | 'announcement' | 'badge'
model HiveNotification {
  id        String    @id @default(cuid())
  userId    String
  user      User      @relation(fields: [userId], references: [id], onDelete: Cascade)
  type      String
  postId    String?   // no FK — must survive post auto-deletion
  title     String
  body      String?
  readAt    DateTime?
  createdAt DateTime  @default(now())
  @@index([userId, readAt, createdAt])
  @@map("hive_notification")
}
```

Mentor seeding: `HIVE_MENTOR_EMAILS` env (comma-separated). `src/lib/hive/roles.ts` exports `getHiveUser()` = `requireUser()` + lazy idempotent promotion to MENTOR when email matches; plus `requireMentor()`. No admin UI in v1.

## 2. Phase-4 FTS migration (hand-edited via `prisma migrate dev --create-only`)

```sql
ALTER TABLE "hive_post" ADD COLUMN "search" tsvector
  GENERATED ALWAYS AS (to_tsvector('english',
    coalesce(title,'') || ' ' || coalesce(body,'') || ' ' || coalesce("kbSummary",''))) STORED;
CREATE INDEX "hive_post_search_idx" ON "hive_post" USING GIN ("search");
```
Represent as `search Unsupported("tsvector")?` in the model so `migrate diff` stays clean. Query helper `src/lib/hive/search.ts` uses `prisma.$queryRaw` with `websearch_to_tsquery('english', $1)` + `ts_rank`.

## 3. API routes

| Route | Method | Responsibility |
|---|---|---|
| `/api/hive/posts` | GET | Feed: cursor pagination, filters tag/status/type/q; pinned announcements first; triggers throttled lazy cleanup |
| `/api/hive/posts` | POST | Create post → inline triage → sensitive? escalate : `after()` AI attempt 1. `export const maxDuration = 60` |
| `/api/hive/posts/[id]` | GET | Post + replies + events + reactions + my-follow (poll target while AI_WORKING) |
| `/api/hive/posts/[id]/replies` | POST | Add reply. Author+`stillStuck` → `after()` attempt 2/3 or escalate. Peer STUDENT ANSWER → `after()` verification. Notify followers. `maxDuration = 60` |
| `/api/hive/posts/[id]/escalate` | POST | "Need human": ESCALATED + event + notify mentors |
| `/api/hive/posts/[id]/accept` | POST | Author accepts reply → RESOLVED→ARCHIVED, `after()` kbSummary, XP awards, events, notifications |
| `/api/hive/posts/[id]/follow` | POST | Toggle follow |
| `/api/hive/posts/similar` | POST | Composer duplicate check: FTS top-5 over RESOLVED/ARCHIVED |
| `/api/hive/coach` | POST | Pre-post coach (structured Gemini, rate-limited 20/day, analogies pattern) |
| `/api/hive/honeycomb` | GET | KB search: q → FTS over ARCHIVED; empty q → recent archives |
| `/api/hive/reactions` | POST | Toggle nectar {targetType,targetId} (unique constraint = idempotent) |
| `/api/hive/notifications` | GET/PATCH | Bell list + unread count / mark read |
| `/api/hive/upload/sign` | POST | Cloudinary signature (timestamp+folder, sha1 via node:crypto) |
| `/api/hive/mentor/queue` | GET | Mentor-only: ESCALATED posts with attempt logs |
| `/api/hive/mentor/claim` | POST | Self-assign a post inside `pg_advisory_xact_lock` tx (support/queue.ts pattern) to prevent double-claim |
| `/api/hive/announcements` | POST | Mentor/admin: pinned ANNOUNCEMENT + notify all users (createMany) |
| `/api/hive/leaderboard` | GET | Weekly: nectar received + approved/accepted answers, top 10 |
| `/api/hive/cleanup` | POST | Cron: sweep expired; roll weekly Queen Bee (idempotent sourceId = ISO week); post encouragement if none in 48h. Auth: Bearer CRON_SECRET |

`vercel.json`: `{ "crons": [{ "path": "/api/hive/cleanup", "schedule": "0 3 * * *" }] }` (Vercel sends CRON_SECRET automatically when set).

Lazy cleanup (`src/lib/hive/cleanup.ts`): module-level in-memory throttle (run at most every 15 min per instance) + `deleteMany({ type: QUESTION, status: { in: [OPEN, AI_WORKING, ESCALATED] }, expiresAt: { lt: now } })` — cascades wipe replies/events/reactions/follows. Cron is the reliable path; lazy sweep keeps dev/local honest.

## 4. Lib modules (`src/lib/hive/`)

- `roles.ts` — `getHiveUser()`, `requireMentor()`
- `ai.ts` — Gemini wrappers (model `gemini-3.1-flash-lite`, structured output per analogies route): `triagePost`, `answerAttempt(post, thread, n)`, `verifyPeerAnswer`, `coachDraft`, `summarizeForKb`, `encouragementPost`
- `attempts.ts` — `runAiAttempt(postId, n)` (AI reply + event + status flips; escalates after 3), `escalatePost(postId, reason)`
- `notify.ts` — `notifyUser`, `notifyFollowers`, `notifyMentors`
- `search.ts` — FTS: `findSimilar(title, body)`, `searchHoneycomb(q)`
- `cleanup.ts` — sweep + cron body + weekly queen roll + encouragement
- `cloudinary.ts` — `signUpload()`
- `constants.ts` — `POST_TTL_MS = 3 days`, limits, curated tag list

## 5. AI prompt/schema sketches

- **Triage** (inline): schema `{ tags[≤3], topic, milestone, severity: low|medium|high, sensitive: bool, sensitiveReason? }`. Prompt: triage a bootcamp helpdesk post; sensitive=true for mental-health crises, harassment, academic-integrity, billing/account — anything a human must handle.
- **Answer attempt N** (`after()`): input = full thread incl. prior AI attempts. Schema `{ body (markdown), confidence 0-100, usedAngle }`. Attempt 1: direct complete fix with corrected code. Attempt 2: "previous answer didn't work (quoted) — take a DIFFERENT angle, question environment/assumptions, give a diagnostic step". Attempt 3: ask 2-3 targeted clarifying questions (kind=CLARIFYING_QUESTION).
- **Peer verification**: schema `{ verdict: approve|reject|unsure, note }` → approve = Bee-Approved + XP; else no mark, no shaming.
- **Coach**: schema `{ quality 0-100, suggestions: [{kind: add_error|add_code|clarify_goal|shorten|title, text}], improvedTitle? }`.
- **KB summary** (on accept): `{ kbTitle, kbSummary, keyTakeaways[] }` → stored joined in `kbSummary`.

## 6. Components (`src/components/hive/`)

`hive-nav.tsx`, `hive-feed.tsx` + `post-card.tsx`, `post-composer.tsx` (+ `coach-suggestions.tsx`, `similar-posts.tsx`, image upload hook), `post-thread.tsx` + `reply-item.tsx` (Still-stuck / Need-human / Accept buttons, AI-thinking poller), `markdown.tsx` (react-markdown + remark-gfm + rehype-highlight; custom `code` renderer adds **Open in Visualizer** on js blocks → `/labs/js-motion?code=${compressToEncodedURIComponent(code)}` — confirmed param `code` in src/lib/visualizer/share.ts `readCodeFromLocation()`), `status-timeline.tsx`, `bee-approved-badge.tsx`, `nectar-button.tsx`, `notification-bell.tsx` (30s poll), `honeycomb-search.tsx`, `mentor-queue.tsx`, `leaderboard-panel.tsx`.

## 7. Pages

- `src/app/hive/layout.tsx` — server: auth gate + `<div data-theme="hive">` + nav + bell
- `src/app/hive/page.tsx`, `hive/new/page.tsx`, `hive/[id]/page.tsx`, `hive/honeycomb/page.tsx`, `hive/mentor/page.tsx` (requireMentor) — all thin server pages per lab convention

## 8. Theme (globals.css additions)

```css
[data-theme='hive'] {
  --primary: oklch(0.769 0.155 74);          /* honey amber */
  --primary-foreground: oklch(0.28 0.06 60);
  --ring: oklch(0.769 0.155 74);
  --accent: oklch(0.96 0.05 85);
  --accent-foreground: oklch(0.35 0.08 60);
  /* chart-1..5: amber ramp */
  --hive-honey: oklch(0.82 0.16 80);
  --hive-comb: oklch(0.95 0.04 85);
}
.dark [data-theme='hive'] { /* darker amber variants */ }
.hive-hex-bg { /* subtle hexagon SVG pattern */ }
.hive-md pre code { /* scoped highlight.js theme */ }
```

## 9. Gamification additions

`reasons.ts`: `hivePostXp()=5`, `hiveReplyXp()=5` (route caps ≤5/day via XpEvent count), `hiveApprovedXp()=25`, `hiveAcceptedXp()=40`, `hiveResolvedAskerXp()=10`, `hiveQueenXp()=100` (sourceId `queen:2026-W28`, idempotent).
`badges.ts` + `award.ts getStats`: new stats `hiveReplies, hiveApproved, hiveAccepted, hiveQueenWeeks`; badges `worker-bee` (5 replies), `pollinator` (first Bee-Approved), `hive-hero` (5 accepted), `queen-bee` (weekly win).

## 10. New dependencies & env

Deps: `react-markdown remark-gfm rehype-highlight highlight.js`. No Cloudinary SDK.
Env: `HIVE_MENTOR_EMAILS`, `CLOUDINARY_CLOUD_NAME`, `CLOUDINARY_API_KEY`, `CLOUDINARY_API_SECRET`, `CRON_SECRET`.

## 11. Phased build order

**Phase 1 — Foundation (no AI)**: schema + migration + Role, roles/constants/cloudinary libs, posts/replies/upload-sign routes, hive layout+feed+new+[id] pages, composer/thread/markdown components, theme block, deps.
Verify: create markdown post with image → highlighted render on feed + detail; mentor email promoted; migration clean.

**Phase 2 — AI core**: ai/attempts/notify libs, triage+attempt-1 in posts POST (`after()`), still-stuck attempts 2-3 + escalation in replies POST, coach + escalate routes, status-timeline + coach UI, mentor page + queue/claim routes.
Verify: post → AI reply ~10s; still-stuck ×2 → new angle then clarifying question; 3rd fail / need-human / sensitive → mentor queue with full attempt log.

**Phase 3 — Community**: reactions/accept/leaderboard routes, peer verification, gamification extensions, nectar/bee-approved/leaderboard UI.
Verify: peer answer → Bee-Approved + 25 XP (idempotent); accept → 40/10 XP; nectar toggles; leaderboard ranks.

**Phase 4 — Honeycomb + lifecycle**: FTS migration, search/cleanup libs, honeycomb/similar/cleanup routes, honeycomb page, similar-posts in composer, vercel.json, kbSummary on accept.
Verify: accept archives + summary; honeycomb search hits; composer shows dupes; backdated expiresAt → deleted (archived survives).

**Phase 5 — Notifications + extras**: notifications/announcements/follow routes, bell, follows, encouragement in cron, open-in-visualizer, weekly queen roll, polish.
Verify: reply rings bell; announcement pins + notifies; encouragement appears; JS block opens preloaded in /labs/js-motion.

## 12. Risks / notes

- Next 16 breaking changes — read `node_modules/next/dist/docs/` for route-handler/`after()` details before coding (AGENTS.md). `headers()` is async.
- `after()` on Vercel needs `maxDuration` headroom on the two AI routes.
- Prisma 7 + `Unsupported("tsvector")`: generated column goes in hand-edited `--create-only` migration SQL.
- Notifications intentionally un-FK'd so bell history survives post deletion; everything else cascades so cleanup is one `deleteMany`.
- Reaction uniqueness via `targetKey` string sidesteps PG NULLs-are-distinct unique behavior.
