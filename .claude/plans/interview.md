# AI Live Technical Interview (Gemini 3.1 Flash Live)

## Context

New feature for the phi-lab client (Next.js 16 App Router, React 19, Tailwind 4, shadcn, framer-motion): a live, voice-based technical interview. The user picks a topic (HTML, CSS, JS, TS, React, Next.js, Node.js, Express, JWT, MongoDB) and a level (easy / medium / expert), talks to the AI interviewer for one **2-minute round**, then gets a generated report (scores, strengths, suggestions, summary). No persistence for now — report is session-only. `GEMINI_API_KEY` already exists in `client/.env`.

**Model & API facts (verified from docs):**
- Model: `gemini-3.1-flash-live-preview` — audio-to-audio, Live API (WebSocket) via `@google/genai`; audio-only sessions allow up to 15 min (2-min round is well within).
- Audio: input raw PCM 16-bit LE @ **16kHz** (`mimeType: 'audio/pcm;rate=16000'` via `session.sendRealtimeInput({audio:{data:base64,...}})`); output PCM @ **24kHz** in `serverContent.modelTurn.parts[].inlineData`.
- Transcripts: enable `inputAudioTranscription: {}` / `outputAudioTranscription: {}` in config; arrive as `serverContent.inputTranscription/outputTranscription`. Handle `serverContent.interrupted` (flush playback) and `turnComplete`.
- Browser auth: **ephemeral tokens** — server mints via `client.authTokens.create({config:{uses:1, expireTime, newSessionExpireTime, liveConnectConstraints:{model}, httpOptions:{apiVersion:'v1alpha'}}})`; browser uses `new GoogleGenAI({apiKey: token.name})` then `ai.live.connect(...)`. API key never reaches the client.
- Voice via `speechConfig.voiceConfig.prebuiltVoiceConfig.voiceName` (default to "Kore").

**Note:** `client/AGENTS.md` warns this Next.js differs from training data — check `client/node_modules/next/dist/docs/` route-handler conventions before writing the API routes.

## New package

`@google/genai` (used both server-side for token minting + report, and client-side for `ai.live.connect`).

## Files

### 1. `src/lib/interview/topics.ts` (new)
- `TOPICS`: id, label, icon, blurb for the 10 topics; `LEVELS`: easy/medium/expert with descriptions.
- `buildSystemInstruction(topic, level)` — interviewer persona: friendly but rigorous senior engineer; ask ONE short question at a time on {topic} at {level}; brief follow-ups on the candidate's answer; never lecture, keep each reply under ~15 seconds of speech; the round lasts 2 minutes; when told time is up, thank the candidate and stop.
- `ROUND_SECONDS = 120`.

### 2. `src/app/api/interview/token/route.ts` (new)
POST → creates ephemeral token with `GoogleGenAI({apiKey: process.env.GEMINI_API_KEY})`:
`uses: 1`, `expireTime: now+5min`, `newSessionExpireTime: now+2min`, `liveConnectConstraints: { model: 'gemini-3.1-flash-live-preview' }`, `httpOptions: {apiVersion: 'v1alpha'}`. Returns `{ token: token.name }`. Return 500 with a clear message if the key is missing.

### 3. `src/app/api/interview/report/route.ts` (new)
POST `{ topic, level, transcript: {role:'interviewer'|'candidate', text}[] }` → calls `generateContent` (standard REST model, constant `REPORT_MODEL = 'gemini-flash-latest'` so it's easy to swap) with `responseMimeType: 'application/json'` + `responseSchema`:
`{ overallScore: 0-100, verdict, scores: {communication, technicalDepth, accuracy}: 0-10, strengths: string[], improvements: string[], perQuestion: {question, feedback, rating}[], suggestions: string[], summary }`. Returns parsed JSON. Guard: transcript too short (< 2 candidate turns) → return a "not enough signal" report shape.

### 4. `src/lib/interview/audio.ts` (new)
- `createMicStream(onChunk)` — `getUserMedia({audio:{channelCount:1, echoCancellation:true, noiseSuppression:true}})`, `AudioContext({sampleRate:16000})`, inline **AudioWorklet** (registered from a Blob URL) posting Float32 blocks (~2048 samples) → Int16 → base64 → `onChunk(base64)`. Returns `{ stop(), analyser }` (AnalyserNode for the mic level meter).
- `createPlaybackQueue()` — `AudioContext({sampleRate:24000})`; `enqueue(base64)` decodes PCM16 → AudioBuffer, schedules sequentially with a running `nextStartTime`; `flush()` stops sources + resets (for `interrupted`); exposes an output AnalyserNode too (for the speaking orb).

### 5. `src/lib/interview/use-interview.ts` (new hook — keeps the page thin)
State machine `idle → connecting → live → generating → report | error`.
- `start(topic, level)`: fetch token → `ai.live.connect({ model, config: { responseModalities:[Modality.AUDIO], speechConfig(Kore), inputAudioTranscription:{}, outputAudioTranscription:{}, systemInstruction }, callbacks })` → start mic → kick off with `sendClientContent({turns:[{role:'user',parts:[{text:'Begin the interview: greet me in one sentence and ask the first question.'}]}], turnComplete:true})`.
- `onmessage`: enqueue audio parts; accumulate transcript entries (coalesce consecutive same-role fragments); on `interrupted` → `playback.flush()`.
- 120s countdown (drives UI ring). At **T-15s** send a text nudge: "Time is almost up — ask nothing new, wrap up." At **0** → stop mic, wait ≤3s for tail audio, `session.close()` → POST transcript to report route → `report` state.
- Also: `endEarly()`, `toggleMute()` (stop sending chunks while muted), cleanup on unmount, error surface (mic denied / token fail / ws close).

### 6. `src/app/labs/interview/page.tsx` (new, `'use client'`) + `src/components/interview/*`
Three screens, same visual language as js-motion lab (rounded-xl cards, amber accents, dark-mode aware):
- **Setup** (`setup-screen.tsx`): topic grid (10 cards with icons), level segmented control with descriptions, mic-permission check button with live level meter, big "Start interview" CTA. 2-min round + "voice conversation" notice.
- **Live** (`live-screen.tsx`): centered **speaking orb** (framer-motion scale/glow driven by output analyser; distinct color when user is talking via mic analyser), countdown ring (SVG stroke-dashoffset, turns rose in last 15s), topic/level badge, live transcript feed (auto-scroll, interviewer vs candidate bubbles — reuse chat-ish styling from `components/ui/message.tsx` if it fits, else simple bubbles), Mute and **End interview** buttons.
- **Report** (`report-screen.tsx`): overall score ring + verdict, three sub-score bars, strengths / improvements two-column lists, per-question feedback accordion (`components/ui/accordion.tsx`), suggestions list, summary paragraph, buttons: "New interview" (reset) and "Retry same topic".

## Implementation order
1. `npm i @google/genai` in `client/`; skim `node_modules/next/dist/docs/` route-handler doc.
2. topics.ts → token route → audio.ts → use-interview.ts → page + screens → report route → polish.

## Verification
1. `npx tsc --noEmit` + `npm run lint` in `client/`.
2. `curl -X POST localhost:3000/api/interview/token` returns a token name; report route returns valid JSON for a sample transcript.
3. Drive `http://localhost:3000/labs/interview` with the `webapp-testing` skill (use Python at `C:\Users\User\AppData\Local\Programs\Python\Python314\python.exe`; grant mic via Chromium launch args `--use-fake-ui-for-media-stream --use-fake-device-for-media-stream`): select topic/level, start, confirm state transitions, timer ring, transcript entries appear (fake mic sends tone; model replies regardless), and that the report screen renders after 2 min (or End early). Screenshot each screen incl. dark mode.
4. Manual sanity check by the user with a real microphone for full-duplex audio quality (headless fake-audio can't verify echo/latency).
