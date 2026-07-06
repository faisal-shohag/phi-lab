---
name: gemini-live-feature
description: Use when building a feature that streams audio to/from Gemini Live API (voice agents, live interviews, voice assistants). Covers ephemeral token minting, PCM audio worklet setup, playback queue, and report generation pattern.
---

# Gemini Live Feature Builder

## Steps
1. Server: mint ephemeral token via `client.authTokens.create()` — never expose API key to browser
2. Client audio in: 16kHz PCM16, AudioWorklet, base64 chunks via `sendRealtimeInput`
3. Client audio out: 24kHz PCM16, sequential AudioBuffer playback queue, flush on `interrupted`
4. Transcript: enable input/output transcription in session config, coalesce fragments by role
5. Report/analysis: separate REST call (not Live model) with `responseSchema` for structured JSON output
6. Verify: tsc + lint, curl API routes, drive UI headless w/ fake mic flags

<!-- ## Design reference
Check `/public/ui` folder for proposed UI mockup image before build screens. Take concept of designing the interview screen. You have right to do free style. Try to make like this. -->

## Gotchas
- Ephemeral token single-use — mint fresh per session
- Don't reuse AudioContext sample rate for both in/out — 16kHz in, 24kHz out
- **Lock the full Live config into the token** at mint time via `liveConnectConstraints.config` (responseModalities, speechConfig, transcription, systemInstruction). Passing the config at `ai.live.connect()` time with an ephemeral token instead fails with a server-side WS close `1011 Internal error` for `gemini-3.1-flash-live-preview`. Connect from the browser with `config: {}`.
- Browser `new GoogleGenAI({ apiKey: token, httpOptions: { apiVersion: 'v1alpha' } })` — ephemeral tokens are v1alpha only; without it the socket closes immediately.
- Next.js App Router: an `_`-prefixed route folder is a private folder (excluded from routing → 404). Use a normal name for throwaway preview pages.