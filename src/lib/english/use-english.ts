'use client'

// Live English-practice session hook. Forked from use-feynman so the other labs
// stay untouched. The AI is the coach/role-player and the human is the learner;
// input audio is the learner, output audio is the coach.
import { useCallback, useEffect, useRef, useState } from 'react'
import {
  GoogleGenAI,
  type LiveServerMessage,
  type Session,
} from '@google/genai'
import { characterById } from '@/lib/interview/topics'
import { createMicStream, createPlaybackQueue, type MicStream, type PlaybackQueue } from '@/lib/interview/audio'
import { ROUND_SECONDS } from './scenarios'
import type { EnglishReport } from './report-types'
import type { InterviewErrorCode } from '@/lib/interview/errors'
import { useLiveUsageReporter } from '@/lib/ai-usage/live-reporter'
import {
  beaconAbandon,
  END_OK_RESPONSE,
  minElapsedSeconds,
  TOO_EARLY_RESPONSE,
  waitForFarewell,
} from '@/lib/labs/end-session'

const LIVE_MODEL = 'gemini-3.1-flash-live-preview'
const WRAP_UP_AT = 15
const RECONNECT_WINDOW_MS = 60_000
const SYNC_INTERVAL_MS = 10_000

export type EnglishPhase =
  | 'idle'
  | 'greenroom'
  | 'connecting'
  | 'live'
  | 'reconnecting'
  | 'generating'
  | 'report'
  | 'error'

export type TranscriptRole = 'coach' | 'learner'
export interface TranscriptEntry {
  role: TranscriptRole
  text: string
}

export interface StartOptions {
  characterId: string
}

export interface UseEnglish {
  phase: EnglishPhase
  error: string | null
  errorCode: InterviewErrorCode | null
  secondsLeft: number
  /** The full round length this round started with — admin-tunable, so the countdown ring needs it, not the ROUND_SECONDS constant. */
  roundTotal: number
  transcript: TranscriptEntry[]
  report: EnglishReport | null
  muted: boolean
  coachSpeaking: boolean
  micAnalyser: AnalyserNode | null
  outputAnalyser: AnalyserNode | null
  scenario: string | null
  characterId: string
  canRetryReport: boolean
  enterGreenRoom: (scenario: string) => void
  start: (opts: StartOptions) => Promise<void>
  retryReport: () => Promise<void>
  endEarly: () => void
  toggleMute: () => void
  reset: () => void
}

async function readError(res: Response): Promise<{ code: InterviewErrorCode | null; message: string }> {
  const data = await res.json().catch(() => ({}))
  const code = (typeof data?.error === 'string' ? data.error : null) as InterviewErrorCode | null
  const message = typeof data?.message === 'string' ? data.message : `Request failed (${res.status})`
  return { code, message }
}

export function useEnglish(): UseEnglish {
  const [phase, setPhaseState] = useState<EnglishPhase>('idle')
  const [error, setError] = useState<string | null>(null)
  const [errorCode, setErrorCode] = useState<InterviewErrorCode | null>(null)
  const [secondsLeft, setSecondsLeft] = useState(ROUND_SECONDS)
  const [roundTotal, setRoundTotal] = useState(ROUND_SECONDS)
  const [transcript, setTranscript] = useState<TranscriptEntry[]>([])
  const [report, setReport] = useState<EnglishReport | null>(null)
  const [muted, setMuted] = useState(false)
  const [coachSpeaking, setCoachSpeaking] = useState(false)
  const [micAnalyser, setMicAnalyser] = useState<AnalyserNode | null>(null)
  const [outputAnalyser, setOutputAnalyser] = useState<AnalyserNode | null>(null)
  const [scenario, setScenario] = useState<string | null>(null)
  const [characterId, setCharacterId] = useState('nova')

  // Live token counts are only visible in the browser; this ships them home.
  const usageReporter = useLiveUsageReporter('ENGLISH')

  const phaseRef = useRef<EnglishPhase>('idle')
  const setPhase = useCallback((p: EnglishPhase) => {
    phaseRef.current = p
    setPhaseState(p)
  }, [])

  const sessionRef = useRef<Session | null>(null)
  const micRef = useRef<MicStream | null>(null)
  const playbackRef = useRef<PlaybackQueue | null>(null)
  const countdownRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const syncRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const mutedRef = useRef(false)
  const wrappedUpRef = useRef(false)
  const finishingRef = useRef(false)
  /** The coach has called end_session and is saying goodbye. */
  const endingRef = useRef(false)
  const intentionalCloseRef = useRef(false)
  const reconnectingRef = useRef(false)
  const resumeHandleRef = useRef<string | null>(null)
  const secondsLeftRef = useRef(ROUND_SECONDS)
  /** The session's full length, for the end_session guard. Mirrors roundTotal. */
  const roundTotalRef = useRef(ROUND_SECONDS)
  const sessionIdRef = useRef<string | null>(null)
  const transcriptRef = useRef<TranscriptEntry[]>([])
  const scenarioRef = useRef<string | null>(null)
  const characterRef = useRef('nova')

  const appendTranscript = useCallback((role: TranscriptRole, text: string) => {
    if (!text) return
    const entries = transcriptRef.current
    const last = entries[entries.length - 1]
    if (last && last.role === role) {
      last.text += text
    } else {
      entries.push({ role, text })
    }
    transcriptRef.current = entries
    setTranscript([...entries.map((e) => ({ ...e }))])
  }, [])

  const syncTranscript = useCallback(async (ended = false) => {
    const id = sessionIdRef.current
    if (!id) return
    const entries = transcriptRef.current.map((e) => ({ ...e }))
    try {
      await fetch(`/api/english/sessions/${id}/transcript`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ transcript: entries, ended }),
      })
    } catch {
      // Non-fatal; the next tick (or finish) will retry.
    }
  }, [])

  const stopTimers = useCallback(() => {
    if (countdownRef.current) { clearInterval(countdownRef.current); countdownRef.current = null }
    if (syncRef.current) { clearInterval(syncRef.current); syncRef.current = null }
  }, [])

  const teardown = useCallback(() => {
    // Unmounting mid-session (tab closed, navigated away) is the one exit that
    // produces no report — so it is the one that has to say so, or the row is
    // stranded at IN_PROGRESS forever. A session finishing is not abandoned.
    if (
      (phaseRef.current === 'live' || phaseRef.current === 'reconnecting') &&
      !finishingRef.current &&
      !endingRef.current
    ) {
      beaconAbandon('ENGLISH', sessionIdRef.current)
    }

    stopTimers()
    intentionalCloseRef.current = true
    micRef.current?.stop()
    micRef.current = null
    playbackRef.current?.close()
    playbackRef.current = null
    try { sessionRef.current?.close() } catch {}
    sessionRef.current = null
    setMicAnalyser(null)
    setOutputAnalyser(null)
    setCoachSpeaking(false)
  }, [stopTimers])

  const requestReport = useCallback(async () => {
    setPhase('generating')
    try {
      const res = await fetch('/api/english/report', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sessionId: sessionIdRef.current }),
      })
      if (!res.ok) {
        const { code, message } = await readError(res)
        setErrorCode(code)
        throw new Error(message)
      }
      const data = (await res.json()) as EnglishReport
      setReport(data)
      setErrorCode(null)
      setPhase('report')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to generate the report.')
      setErrorCode((prev) => prev ?? 'REPORT_FAILED')
      setPhase('error')
    }
  }, [setPhase])

  const finish = useCallback(async () => {
    if (finishingRef.current) return
    finishingRef.current = true
    reconnectingRef.current = false

    // Before the socket closes: ship the round's token totals.
    usageReporter.flush()

    stopTimers()
    intentionalCloseRef.current = true
    micRef.current?.stop()
    micRef.current = null
    setMicAnalyser(null)

    setPhase('generating')

    const playback = playbackRef.current
    const deadline = Date.now() + 3000
    while (playback && playback.pendingSeconds() > 0.05 && Date.now() < deadline) {
      await new Promise((r) => setTimeout(r, 150))
    }

    try { sessionRef.current?.close() } catch {}
    sessionRef.current = null
    playbackRef.current?.close()
    playbackRef.current = null
    setOutputAnalyser(null)
    setCoachSpeaking(false)

    await syncTranscript(true)
    await requestReport()
  }, [stopTimers, setPhase, syncTranscript, requestReport, usageReporter])

  const finishRef = useRef<() => Promise<void>>(() => Promise.resolve())
  useEffect(() => { finishRef.current = finish }, [finish])

  // The coach asked to end the session. Let it finish saying goodbye, THEN close —
  // finish() kills the socket, so calling it straight away would cut the farewell
  // off mid-word. The countdown stops first so the clock can't beat us to it.
  const gracefulFinish = useCallback(async () => {
    if (endingRef.current || finishingRef.current) return
    endingRef.current = true
    stopTimers()
    await waitForFarewell(() => playbackRef.current?.pendingSeconds() ?? 0)
    await finishRef.current()
  }, [stopTimers])

  const gracefulFinishRef = useRef<() => Promise<void>>(() => Promise.resolve())
  useEffect(() => { gracefulFinishRef.current = gracefulFinish }, [gracefulFinish])

  const handleMessage = useCallback((msg: LiveServerMessage) => {
    // Token counts for this round only reach us here — the socket is
    // browser-to-Google. Cumulative, so the reporter keeps the latest.
    usageReporter.observe(msg.usageMetadata)

    const resume = msg.sessionResumptionUpdate
    if (resume?.resumable && resume.newHandle) {
      resumeHandleRef.current = resume.newHandle
    }

    // The coach can end the session itself once the learner is done — but not in
    // the opening stretch, where a misread pause would cost them the whole round.
    // A refusal is not an error: the model just keeps the conversation going.
    for (const call of msg.toolCall?.functionCalls ?? []) {
      if (call.name !== 'end_session') continue
      const elapsed = roundTotalRef.current - secondsLeftRef.current
      const tooEarly = elapsed < minElapsedSeconds(roundTotalRef.current)
      try {
        sessionRef.current?.sendToolResponse({
          functionResponses: [
            { id: call.id, name: call.name, response: tooEarly ? TOO_EARLY_RESPONSE : END_OK_RESPONSE },
          ],
        })
      } catch {}
      if (!tooEarly) void gracefulFinishRef.current()
    }

    const content = msg.serverContent
    if (!content) return

    if (content.interrupted) {
      playbackRef.current?.flush()
      setCoachSpeaking(false)
    }

    const parts = content.modelTurn?.parts ?? []
    for (const part of parts) {
      const data = part.inlineData?.data
      if (data && part.inlineData?.mimeType?.startsWith('audio/')) {
        playbackRef.current?.enqueue(data)
        setCoachSpeaking(true)
      }
    }

    // Input audio is the human learner; output audio is the AI coach.
    if (content.inputTranscription?.text) appendTranscript('learner', content.inputTranscription.text)
    if (content.outputTranscription?.text) appendTranscript('coach', content.outputTranscription.text)

    if (content.turnComplete) {
      setTimeout(() => {
        if ((playbackRef.current?.pendingSeconds() ?? 0) <= 0.05) setCoachSpeaking(false)
      }, 200)
    }
  }, [appendTranscript, usageReporter])

  const startCountdown = useCallback(() => {
    if (countdownRef.current) return
    countdownRef.current = setInterval(() => {
      setSecondsLeft((prev) => {
        const next = prev - 1
        secondsLeftRef.current = next
        if (next === WRAP_UP_AT && !wrappedUpRef.current) {
          wrappedUpRef.current = true
          try {
            sessionRef.current?.sendClientContent({
              turns: [{ role: 'user', parts: [{ text: 'Time is almost up — wrap up warmly and stop asking new questions.' }] }],
              turnComplete: true,
            })
          } catch {}
        }
        if (next <= 0) {
          if (countdownRef.current) { clearInterval(countdownRef.current); countdownRef.current = null }
          void finishRef.current()
          return 0
        }
        return next
      })
    }, 1000)
  }, [])

  const connectSession = useCallback(async (resume: boolean) => {
    const tokenRes = await fetch('/api/english/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        scenario: scenarioRef.current,
        characterId: characterRef.current,
        ...(resume ? { resumeSessionId: sessionIdRef.current, resumeHandle: resumeHandleRef.current ?? undefined } : {}),
      }),
    })
    if (!tokenRes.ok) {
      const { code, message } = await readError(tokenRes)
      const e = new Error(message) as Error & { code?: InterviewErrorCode | null }
      e.code = code
      throw e
    }
    const { token, sessionId, roundSeconds } = (await tokenRes.json()) as {
      token: string
      sessionId: string
      roundSeconds: number
    }
    if (!token) throw new Error('Server did not return a session token.')
    if (sessionId) sessionIdRef.current = sessionId

    // The round length is admin-tunable, so the server is the authority — the
    // ROUND_SECONDS constant is only the pre-connect placeholder. On a resume
    // the countdown is already mid-flight; don't reset it.
    if (!resume && Number.isFinite(roundSeconds) && roundSeconds > 0) {
      secondsLeftRef.current = roundSeconds
      setSecondsLeft(roundSeconds)
      setRoundTotal(roundSeconds)
      roundTotalRef.current = roundSeconds
    }

    // Start the usage clock on a fresh round only. A reconnect continues the
    // same round, and re-beginning would reset its duration and drop the tokens
    // accumulated before the drop.
    if (!resume && sessionIdRef.current) usageReporter.begin(sessionIdRef.current)

    if (!playbackRef.current) {
      const playback = createPlaybackQueue()
      playbackRef.current = playback
      setOutputAnalyser(playback.analyser)
    }

    const ai = new GoogleGenAI({ apiKey: token, httpOptions: { apiVersion: 'v1alpha' } })
    intentionalCloseRef.current = false
    const session = await ai.live.connect({
      model: LIVE_MODEL,
      config: {},
      callbacks: {
        onmessage: handleMessage,
        onerror: () => { void handleDropRef.current() },
        onclose: () => { void handleDropRef.current() },
      },
    })
    sessionRef.current = session
    return session
  }, [handleMessage, usageReporter])

  const handleDrop = useCallback(async () => {
    if (intentionalCloseRef.current || finishingRef.current) return
    const p = phaseRef.current
    if (p !== 'live') return

    if (secondsLeftRef.current <= WRAP_UP_AT) { void finishRef.current(); return }

    reconnectingRef.current = true
    setPhase('reconnecting')
    if (countdownRef.current) { clearInterval(countdownRef.current); countdownRef.current = null }
    try { sessionRef.current?.close() } catch {}
    sessionRef.current = null

    const hadHandle = Boolean(resumeHandleRef.current)
    const deadline = Date.now() + RECONNECT_WINDOW_MS
    for (let attempt = 0; Date.now() < deadline; attempt++) {
      if (!reconnectingRef.current) return
      const delay = attempt === 0 ? 0 : Math.min(8000, 2000 * 2 ** (attempt - 1))
      if (delay) await new Promise((r) => setTimeout(r, delay))
      if (!reconnectingRef.current) return
      try {
        const session = await connectSession(true)
        reconnectingRef.current = false
        setPhase('live')
        startCountdown()
        if (!hadHandle) {
          try {
            session.sendClientContent({
              turns: [{ role: 'user', parts: [{ text: 'We had a brief connection glitch. Briefly recap where we were, then continue.' }] }],
              turnComplete: true,
            })
          } catch {}
        }
        return
      } catch {
        // keep retrying until the window closes
      }
    }
    reconnectingRef.current = false
    void finishRef.current()
  }, [connectSession, setPhase, startCountdown])

  const handleDropRef = useRef<() => Promise<void>>(() => Promise.resolve())
  // eslint-disable-next-line react-hooks/immutability
  useEffect(() => { handleDropRef.current = handleDrop }, [handleDrop])

  const enterGreenRoom = useCallback((scenarioId: string) => {
    setScenario(scenarioId)
    scenarioRef.current = scenarioId
    setError(null)
    setErrorCode(null)
    setPhase('greenroom')
  }, [setPhase])

  const start = useCallback(async (opts: StartOptions) => {
    if (phaseRef.current !== 'greenroom') return

    setError(null)
    setErrorCode(null)
    setReport(null)
    setTranscript([])
    transcriptRef.current = []
    setSecondsLeft(ROUND_SECONDS)
    secondsLeftRef.current = ROUND_SECONDS
    setRoundTotal(ROUND_SECONDS)
    roundTotalRef.current = ROUND_SECONDS
    setMuted(false)
    mutedRef.current = false
    wrappedUpRef.current = false
    finishingRef.current = false
    endingRef.current = false
    reconnectingRef.current = false
    resumeHandleRef.current = null
    sessionIdRef.current = null
    setCharacterId(opts.characterId)
    characterRef.current = opts.characterId
    void characterById(opts.characterId)
    setPhase('connecting')

    try {
      const session = await connectSession(false)

      const mic = await createMicStream((base64) => {
        if (mutedRef.current) return
        try {
          sessionRef.current?.sendRealtimeInput({ audio: { data: base64, mimeType: 'audio/pcm;rate=16000' } })
        } catch {
          // Session may be mid-reconnect; drop the chunk.
        }
      })
      micRef.current = mic
      setMicAnalyser(mic.analyser)

      session.sendClientContent({
        turns: [{ role: 'user', parts: [{ text: 'Begin: greet me in one sentence in your role and ask your first question.' }] }],
        turnComplete: true,
      })

      setPhase('live')
      startCountdown()

      syncRef.current = setInterval(() => { void syncTranscript(false) }, SYNC_INTERVAL_MS)
    } catch (err) {
      const e = err as Error & { code?: InterviewErrorCode | null }
      setError(e.message || 'Could not start the session.')
      setErrorCode(e.code ?? 'CONNECT_FAILED')
      teardown()
      setPhase('error')
    }
  }, [connectSession, setPhase, startCountdown, syncTranscript, teardown])

  const retryReport = useCallback(async () => {
    if (!sessionIdRef.current) return
    setError(null)
    setErrorCode(null)
    await requestReport()
  }, [requestReport])

  const endEarly = useCallback(() => {
    if (phaseRef.current === 'live' || phaseRef.current === 'reconnecting') {
      reconnectingRef.current = false
      void finishRef.current()
    }
  }, [])

  const toggleMute = useCallback(() => {
    setMuted((m) => {
      const next = !m
      mutedRef.current = next
      micRef.current?.setMuted(next)
      return next
    })
  }, [])

  const reset = useCallback(() => {
    reconnectingRef.current = false
    teardown()
    finishingRef.current = false
    endingRef.current = false
    wrappedUpRef.current = false
    sessionIdRef.current = null
    resumeHandleRef.current = null
    setPhase('idle')
    setError(null)
    setErrorCode(null)
    setReport(null)
    setTranscript([])
    transcriptRef.current = []
    setSecondsLeft(ROUND_SECONDS)
    secondsLeftRef.current = ROUND_SECONDS
    setRoundTotal(ROUND_SECONDS)
    roundTotalRef.current = ROUND_SECONDS
    setMuted(false)
    mutedRef.current = false
  }, [teardown, setPhase])

  useEffect(() => teardown, [teardown])

  return {
    phase,
    error,
    errorCode,
    secondsLeft,
    roundTotal,
    transcript,
    report,
    muted,
    coachSpeaking,
    micAnalyser,
    outputAnalyser,
    scenario,
    characterId,
    canRetryReport: errorCode === 'REPORT_FAILED',
    enterGreenRoom,
    start,
    retryReport,
    endEarly,
    toggleMute,
    reset,
  }
}
