'use client'

// Live support-session hook. Forked from use-english so the other labs stay
// untouched. The AI is the supporter and the human is the student; input audio
// is the student, output audio is the supporter. Adds a queue/waiting phase (3
// active sessions platform-wide), an optional screen share, a 10-minute cap, and
// a rating step instead of an AI-graded report.
import { useCallback, useEffect, useRef, useState } from 'react'
import {
  GoogleGenAI,
  type LiveServerMessage,
  type Session,
} from '@google/genai'
import { characterById } from '@/lib/interview/topics'
import { createMicStream, createPlaybackQueue, type MicStream, type PlaybackQueue } from '@/lib/interview/audio'
import { startScreenShare, type ScreenShare } from './screen-share'
import { SUPPORT_SECONDS } from './prompt'
import type { InterviewErrorCode } from '@/lib/interview/errors'
import { useLiveUsageReporter } from '@/lib/ai-usage/live-reporter'

const LIVE_MODEL = 'gemini-3.1-flash-live-preview'
const WRAP_UP_AT = 40
const RECONNECT_WINDOW_MS = 60_000
const SYNC_INTERVAL_MS = 10_000
const QUEUE_POLL_MS = 4_000

export type SupportPhase =
  | 'idle'
  | 'waiting'
  | 'greenroom'
  | 'connecting'
  | 'live'
  | 'reconnecting'
  | 'feedback'
  | 'error'

export type TranscriptRole = 'agent' | 'student'
export interface TranscriptEntry {
  role: TranscriptRole
  text: string
}

export interface StartOptions {
  characterId: string
}

export interface UseSupport {
  phase: SupportPhase
  error: string | null
  errorCode: InterviewErrorCode | null
  secondsLeft: number
  /** The full session length this session started with — admin-tunable, so the countdown ring needs it, not the SUPPORT_SECONDS constant. */
  roundTotal: number
  transcript: TranscriptEntry[]
  muted: boolean
  agentSpeaking: boolean
  micAnalyser: AnalyserNode | null
  outputAnalyser: AnalyserNode | null
  category: string | null
  problem: string
  characterId: string
  queuePosition: number
  sharing: boolean
  feedbackSent: boolean
  submitProblem: (category: string, problem: string, language: string) => Promise<void>
  leaveQueue: () => Promise<void>
  start: (opts: StartOptions) => Promise<void>
  sendText: (text: string) => void
  toggleShare: () => Promise<void>
  endEarly: () => void
  toggleMute: () => void
  submitFeedback: (rating: number, comment: string) => Promise<void>
  reset: () => void
}

async function readError(res: Response): Promise<{ code: InterviewErrorCode | null; message: string }> {
  const data = await res.json().catch(() => ({}))
  const code = (typeof data?.error === 'string' ? data.error : null) as InterviewErrorCode | null
  const message = typeof data?.message === 'string' ? data.message : `Request failed (${res.status})`
  return { code, message }
}

export function useSupport(): UseSupport {
  const [phase, setPhaseState] = useState<SupportPhase>('idle')
  const [error, setError] = useState<string | null>(null)
  const [errorCode, setErrorCode] = useState<InterviewErrorCode | null>(null)
  const [secondsLeft, setSecondsLeft] = useState(SUPPORT_SECONDS)
  const [roundTotal, setRoundTotal] = useState(SUPPORT_SECONDS)
  const [transcript, setTranscript] = useState<TranscriptEntry[]>([])
  const [muted, setMuted] = useState(false)
  const [agentSpeaking, setAgentSpeaking] = useState(false)
  const [micAnalyser, setMicAnalyser] = useState<AnalyserNode | null>(null)
  const [outputAnalyser, setOutputAnalyser] = useState<AnalyserNode | null>(null)
  const [category, setCategory] = useState<string | null>(null)
  const [problem, setProblem] = useState('')
  const [characterId, setCharacterId] = useState('nova')
  const [queuePosition, setQueuePosition] = useState(0)
  const [sharing, setSharing] = useState(false)
  const [feedbackSent, setFeedbackSent] = useState(false)

  // Live token counts are only visible in the browser; this ships them home.
  const usageReporter = useLiveUsageReporter('SUPPORT')

  const phaseRef = useRef<SupportPhase>('idle')
  const setPhase = useCallback((p: SupportPhase) => {
    phaseRef.current = p
    setPhaseState(p)
  }, [])

  const sessionRef = useRef<Session | null>(null)
  const micRef = useRef<MicStream | null>(null)
  const playbackRef = useRef<PlaybackQueue | null>(null)
  const shareRef = useRef<ScreenShare | null>(null)
  const countdownRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const syncRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const queueRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const mutedRef = useRef(false)
  const wrappedUpRef = useRef(false)
  const finishingRef = useRef(false)
  const intentionalCloseRef = useRef(false)
  const reconnectingRef = useRef(false)
  const resumeHandleRef = useRef<string | null>(null)
  const secondsLeftRef = useRef(SUPPORT_SECONDS)
  const sessionIdRef = useRef<string | null>(null)
  const transcriptRef = useRef<TranscriptEntry[]>([])
  const categoryRef = useRef<string | null>(null)
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
      await fetch(`/api/support/sessions/${id}/transcript`, {
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
    if (queueRef.current) { clearInterval(queueRef.current); queueRef.current = null }
  }, [])

  const stopShare = useCallback(() => {
    shareRef.current?.stop()
    shareRef.current = null
    setSharing(false)
  }, [])

  const teardown = useCallback(() => {
    stopTimers()
    intentionalCloseRef.current = true
    stopShare()
    micRef.current?.stop()
    micRef.current = null
    playbackRef.current?.close()
    playbackRef.current = null
    try { sessionRef.current?.close() } catch {}
    sessionRef.current = null
    setMicAnalyser(null)
    setOutputAnalyser(null)
    setAgentSpeaking(false)
  }, [stopTimers, stopShare])

  const finish = useCallback(async () => {
    if (finishingRef.current) return
    finishingRef.current = true
    reconnectingRef.current = false

    // Before the socket closes: ship the session's token totals. Support has no
    // report route, so this is the ONLY token signal this lab ever produces.
    usageReporter.flush()

    stopTimers()
    intentionalCloseRef.current = true
    stopShare()
    micRef.current?.stop()
    micRef.current = null
    setMicAnalyser(null)

    // Let any final supporter audio play out briefly.
    const playback = playbackRef.current
    const deadline = Date.now() + 2500
    while (playback && playback.pendingSeconds() > 0.05 && Date.now() < deadline) {
      await new Promise((r) => setTimeout(r, 150))
    }

    try { sessionRef.current?.close() } catch {}
    sessionRef.current = null
    playbackRef.current?.close()
    playbackRef.current = null
    setOutputAnalyser(null)
    setAgentSpeaking(false)

    await syncTranscript(true)

    // Free the slot + award XP. Best-effort — the user still reaches feedback.
    const id = sessionIdRef.current
    if (id) {
      try {
        await fetch(`/api/support/sessions/${id}/end`, { method: 'POST' })
      } catch {
        // ignore; the stale-heartbeat reclaim will free the slot anyway
      }
    }

    setPhase('feedback')
  }, [stopTimers, stopShare, syncTranscript, setPhase, usageReporter])

  const finishRef = useRef<() => Promise<void>>(() => Promise.resolve())
  useEffect(() => { finishRef.current = finish }, [finish])

  const handleMessage = useCallback((msg: LiveServerMessage) => {
    // Token counts for this session only reach us here — the socket is
    // browser-to-Google. Cumulative, so the reporter keeps the latest.
    usageReporter.observe(msg.usageMetadata)

    const resume = msg.sessionResumptionUpdate
    if (resume?.resumable && resume.newHandle) {
      resumeHandleRef.current = resume.newHandle
    }

    // The supporter can end the call itself when the learner is done.
    const calls = msg.toolCall?.functionCalls ?? []
    for (const call of calls) {
      if (call.name === 'end_session') {
        try {
          sessionRef.current?.sendToolResponse({
            functionResponses: [{ id: call.id, name: call.name, response: { ok: true } }],
          })
        } catch {}
        // Let any final goodbye audio play, then hang up gracefully.
        setTimeout(() => { void finishRef.current() }, 400)
      }
    }

    const content = msg.serverContent
    if (!content) return

    if (content.interrupted) {
      playbackRef.current?.flush()
      setAgentSpeaking(false)
    }

    const parts = content.modelTurn?.parts ?? []
    for (const part of parts) {
      const data = part.inlineData?.data
      if (data && part.inlineData?.mimeType?.startsWith('audio/')) {
        playbackRef.current?.enqueue(data)
        setAgentSpeaking(true)
      }
    }

    // Input audio is the human student; output audio is the AI supporter.
    if (content.inputTranscription?.text) appendTranscript('student', content.inputTranscription.text)
    if (content.outputTranscription?.text) appendTranscript('agent', content.outputTranscription.text)

    if (content.turnComplete) {
      setTimeout(() => {
        if ((playbackRef.current?.pendingSeconds() ?? 0) <= 0.05) setAgentSpeaking(false)
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
              turns: [{ role: 'user', parts: [{ text: 'We are almost out of time — help me land on a next step or a kind closing thought, then wrap up warmly.' }] }],
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
    const tokenRes = await fetch('/api/support/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        sessionId: sessionIdRef.current,
        characterId: characterRef.current,
        ...(resume ? { resumeHandle: resumeHandleRef.current ?? undefined } : {}),
      }),
    })
    if (!tokenRes.ok) {
      const { code, message } = await readError(tokenRes)
      const e = new Error(message) as Error & { code?: InterviewErrorCode | null }
      e.code = code
      throw e
    }
    const { token, roundSeconds } = (await tokenRes.json()) as { token: string; roundSeconds: number }
    if (!token) throw new Error('Server did not return a session token.')

    // The session length is admin-tunable, so the server is the authority — the
    // SUPPORT_SECONDS constant is only the pre-connect placeholder. On a resume
    // the countdown is already mid-flight; don't reset it.
    if (!resume && Number.isFinite(roundSeconds) && roundSeconds > 0) {
      secondsLeftRef.current = roundSeconds
      setSecondsLeft(roundSeconds)
      setRoundTotal(roundSeconds)
    }

    // Start the usage clock on a fresh session only. A reconnect continues the
    // same session, and re-beginning would reset its duration and drop the
    // tokens accumulated before the drop.
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

  // Poll the queue while waiting for a slot. The poll doubles as a heartbeat, so
  // the server keeps this session's `lastSeenAt` fresh and won't reclaim it.
  const pollQueue = useCallback(async () => {
    const id = sessionIdRef.current
    if (!id) return
    try {
      const res = await fetch(`/api/support/queue?id=${encodeURIComponent(id)}`)
      if (!res.ok) return
      const data = (await res.json()) as { status: string; position: number }
      if (data.status === 'active') {
        setQueuePosition(0)
        // First time we see a slot: stop polling and move to the green room.
        if (phaseRef.current === 'waiting') {
          if (queueRef.current) { clearInterval(queueRef.current); queueRef.current = null }
          setPhase('greenroom')
        }
      } else if (data.status === 'waiting') {
        setQueuePosition(data.position)
      } else {
        // abandoned/completed unexpectedly — bail out.
        if (queueRef.current) { clearInterval(queueRef.current); queueRef.current = null }
      }
    } catch {
      // transient; try again next tick
    }
  }, [setPhase])

  const submitProblem = useCallback(async (cat: string, prob: string, language: string) => {
    const p = prob.trim()
    if (!p) return
    setError(null)
    setErrorCode(null)
    setCategory(cat)
    categoryRef.current = cat
    setProblem(p)

    try {
      const res = await fetch('/api/support/session', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ category: cat, problem: p, language }),
      })
      if (!res.ok) {
        const { code, message } = await readError(res)
        setError(message)
        setErrorCode(code ?? 'SERVER_ERROR')
        setPhase('error')
        return
      }
      const data = (await res.json()) as { sessionId: string; status: string; position: number }
      sessionIdRef.current = data.sessionId
      setQueuePosition(data.position ?? 0)

      if (data.status === 'active') {
        setPhase('greenroom')
      } else {
        setPhase('waiting')
        void pollQueue()
        queueRef.current = setInterval(() => { void pollQueue() }, QUEUE_POLL_MS)
      }
    } catch {
      setError('Could not reach the support queue. Check your connection and try again.')
      setErrorCode('CONNECT_FAILED')
      setPhase('error')
    }
  }, [setPhase, pollQueue])

  const leaveQueue = useCallback(async () => {
    stopTimers()
    const id = sessionIdRef.current
    sessionIdRef.current = null
    if (id) {
      try { await fetch(`/api/support/session/${id}`, { method: 'DELETE' }) } catch {}
    }
    reset()
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [stopTimers])

  const start = useCallback(async (opts: StartOptions) => {
    if (phaseRef.current !== 'greenroom') return

    setError(null)
    setErrorCode(null)
    setTranscript([])
    transcriptRef.current = []
    setSecondsLeft(SUPPORT_SECONDS)
    secondsLeftRef.current = SUPPORT_SECONDS
    setRoundTotal(SUPPORT_SECONDS)
    setMuted(false)
    mutedRef.current = false
    wrappedUpRef.current = false
    finishingRef.current = false
    reconnectingRef.current = false
    resumeHandleRef.current = null
    setFeedbackSent(false)
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
        turns: [{ role: 'user', parts: [{ text: 'Begin: greet me warmly, show you understand what I came here for, and gently open the conversation.' }] }],
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

  const sendText = useCallback((text: string) => {
    const t = text.trim()
    if (!t) return
    if (phaseRef.current !== 'live') return
    try {
      sessionRef.current?.sendRealtimeInput({ text: t })
    } catch {
      return
    }
    // Show what the learner typed in the transcript (as their own turn).
    appendTranscript('student', (transcriptRef.current.at(-1)?.role === 'student' ? '\n' : '') + t)
  }, [appendTranscript])

  const toggleShare = useCallback(async () => {
    if (shareRef.current) {
      stopShare()
      return
    }
    try {
      const share = await startScreenShare({
        onFrame: (base64) => {
          try {
            sessionRef.current?.sendRealtimeInput({ video: { data: base64, mimeType: 'image/jpeg' } })
          } catch {
            // session mid-reconnect; drop the frame
          }
        },
        onEnded: () => { stopShare() },
      })
      shareRef.current = share
      setSharing(true)
      try {
        sessionRef.current?.sendClientContent({
          turns: [{ role: 'user', parts: [{ text: "I'm now sharing my screen — please take a look and tell me what you notice." }] }],
          turnComplete: true,
        })
      } catch {}
    } catch {
      // user cancelled the picker, or capture is unavailable — no-op
    }
  }, [stopShare])

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

  const submitFeedback = useCallback(async (rating: number, comment: string) => {
    const id = sessionIdRef.current
    if (!id) { setFeedbackSent(true); return }
    try {
      await fetch(`/api/support/sessions/${id}/feedback`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ rating, feedback: comment }),
      })
    } catch {
      // best-effort; still thank the user
    }
    setFeedbackSent(true)
  }, [])

  const reset = useCallback(() => {
    reconnectingRef.current = false
    teardown()
    finishingRef.current = false
    wrappedUpRef.current = false
    sessionIdRef.current = null
    resumeHandleRef.current = null
    setPhase('idle')
    setError(null)
    setErrorCode(null)
    setTranscript([])
    transcriptRef.current = []
    setSecondsLeft(SUPPORT_SECONDS)
    secondsLeftRef.current = SUPPORT_SECONDS
    setRoundTotal(SUPPORT_SECONDS)
    setMuted(false)
    mutedRef.current = false
    setCategory(null)
    categoryRef.current = null
    setProblem('')
    setQueuePosition(0)
    setSharing(false)
    setFeedbackSent(false)
  }, [teardown, setPhase])

  useEffect(() => teardown, [teardown])

  return {
    phase,
    error,
    errorCode,
    secondsLeft,
    roundTotal,
    transcript,
    muted,
    agentSpeaking,
    micAnalyser,
    outputAnalyser,
    category,
    problem,
    characterId,
    queuePosition,
    sharing,
    feedbackSent,
    submitProblem,
    leaveQueue,
    start,
    sendText,
    toggleShare,
    endEarly,
    toggleMute,
    submitFeedback,
    reset,
  }
}
