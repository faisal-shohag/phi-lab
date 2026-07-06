'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import {
  GoogleGenAI,
  type LiveServerMessage,
  type Session,
} from '@google/genai'
import { ROUND_SECONDS, type LevelId } from './topics'
import { createMicStream, createPlaybackQueue, type MicStream, type PlaybackQueue } from './audio'
import type { InterviewReport } from '@/app/api/interview/report/route'

const LIVE_MODEL = 'gemini-3.1-flash-live-preview'
const WRAP_UP_AT = 15 // seconds remaining when we nudge the model to wrap up.

export type InterviewPhase = 'idle' | 'connecting' | 'live' | 'generating' | 'report' | 'error'

export type TranscriptRole = 'interviewer' | 'candidate'
export interface TranscriptEntry {
  role: TranscriptRole
  text: string
}

export interface UseInterview {
  phase: InterviewPhase
  error: string | null
  secondsLeft: number
  transcript: TranscriptEntry[]
  report: InterviewReport | null
  muted: boolean
  /** True while the model is actively speaking (audio queued). */
  modelSpeaking: boolean
  micAnalyser: AnalyserNode | null
  outputAnalyser: AnalyserNode | null
  topic: string | null
  level: LevelId | null
  start: (topic: string, level: LevelId) => Promise<void>
  endEarly: () => void
  toggleMute: () => void
  reset: () => void
}

export function useInterview(): UseInterview {
  const [phase, setPhase] = useState<InterviewPhase>('idle')
  const [error, setError] = useState<string | null>(null)
  const [secondsLeft, setSecondsLeft] = useState(ROUND_SECONDS)
  const [transcript, setTranscript] = useState<TranscriptEntry[]>([])
  const [report, setReport] = useState<InterviewReport | null>(null)
  const [muted, setMuted] = useState(false)
  const [modelSpeaking, setModelSpeaking] = useState(false)
  const [micAnalyser, setMicAnalyser] = useState<AnalyserNode | null>(null)
  const [outputAnalyser, setOutputAnalyser] = useState<AnalyserNode | null>(null)
  const [topic, setTopic] = useState<string | null>(null)
  const [level, setLevel] = useState<LevelId | null>(null)

  const sessionRef = useRef<Session | null>(null)
  const micRef = useRef<MicStream | null>(null)
  const playbackRef = useRef<PlaybackQueue | null>(null)
  const countdownRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const mutedRef = useRef(false)
  const wrappedUpRef = useRef(false)
  const finishingRef = useRef(false)
  // Transcript fragments arrive piecemeal; we coalesce consecutive same-role
  // fragments into a single entry as they stream in.
  const transcriptRef = useRef<TranscriptEntry[]>([])
  const topicRef = useRef<string | null>(null)
  const levelRef = useRef<LevelId | null>(null)

  const appendTranscript = useCallback((role: TranscriptRole, text: string) => {
    if (!text) return
    const entries = transcriptRef.current
    const last = entries[entries.length - 1]
    if (last && last.role === role) {
      last.text += text
    } else {
      entries.push({ role, text })
    }
    // New array reference so React re-renders; entries themselves are mutated in place.
    transcriptRef.current = entries
    setTranscript([...entries.map((e) => ({ ...e }))])
  }, [])

  const teardown = useCallback(() => {
    if (countdownRef.current) {
      clearInterval(countdownRef.current)
      countdownRef.current = null
    }
    micRef.current?.stop()
    micRef.current = null
    playbackRef.current?.close()
    playbackRef.current = null
    try { sessionRef.current?.close() } catch {}
    sessionRef.current = null
    setMicAnalyser(null)
    setOutputAnalyser(null)
    setModelSpeaking(false)
  }, [])

  // Stop capture, let the tail of the model's audio play out, close the session,
  // then request the report. Guarded so it only runs once per round.
  const finish = useCallback(async () => {
    if (finishingRef.current) return
    finishingRef.current = true

    if (countdownRef.current) {
      clearInterval(countdownRef.current)
      countdownRef.current = null
    }
    micRef.current?.stop()
    micRef.current = null
    setMicAnalyser(null)

    setPhase('generating')

    // Wait up to ~3s for any trailing model audio to finish playing.
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
    setModelSpeaking(false)

    const entries = transcriptRef.current.map((e) => ({ ...e }))
    try {
      const res = await fetch('/api/interview/report', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ topic: topicRef.current, level: levelRef.current, transcript: entries }),
      })
      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        throw new Error(data.error ?? `Report request failed (${res.status})`)
      }
      const data = (await res.json()) as InterviewReport
      setReport(data)
      setPhase('report')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to generate the report.')
      setPhase('error')
    }
  }, [])

  const finishRef = useRef(finish)
  useEffect(() => { finishRef.current = finish }, [finish])

  const handleMessage = useCallback((msg: LiveServerMessage) => {
    const content = msg.serverContent
    if (!content) return

    if (content.interrupted) {
      playbackRef.current?.flush()
      setModelSpeaking(false)
    }

    // Audio parts → playback queue.
    const parts = content.modelTurn?.parts ?? []
    for (const part of parts) {
      const data = part.inlineData?.data
      if (data && part.inlineData?.mimeType?.startsWith('audio/')) {
        playbackRef.current?.enqueue(data)
        setModelSpeaking(true)
      }
    }

    if (content.inputTranscription?.text) {
      appendTranscript('candidate', content.inputTranscription.text)
    }
    if (content.outputTranscription?.text) {
      appendTranscript('interviewer', content.outputTranscription.text)
    }

    if (content.turnComplete) {
      // Model finished this turn; the orb settles once audio drains.
      setTimeout(() => {
        if ((playbackRef.current?.pendingSeconds() ?? 0) <= 0.05) setModelSpeaking(false)
      }, 200)
    }
  }, [appendTranscript])

  const start = useCallback(async (topicId: string, lvl: LevelId) => {
    if (phase !== 'idle' && phase !== 'error' && phase !== 'report') return

    // Reset state for a fresh round.
    setError(null)
    setReport(null)
    setTranscript([])
    transcriptRef.current = []
    setSecondsLeft(ROUND_SECONDS)
    setMuted(false)
    mutedRef.current = false
    wrappedUpRef.current = false
    finishingRef.current = false
    setTopic(topicId)
    setLevel(lvl)
    topicRef.current = topicId
    levelRef.current = lvl
    setPhase('connecting')

    try {
      // 1. Mint an ephemeral token server-side. The token pins the full Live
      // config (voice, transcription, interviewer persona) for this topic/level.
      const tokenRes = await fetch('/api/interview/token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ topic: topicId, level: lvl }),
      })
      if (!tokenRes.ok) {
        const data = await tokenRes.json().catch(() => ({}))
        throw new Error(data.error ?? `Token request failed (${tokenRes.status})`)
      }
      const { token } = (await tokenRes.json()) as { token: string }
      if (!token) throw new Error('Server did not return an interview token.')

      // 2. Set up playback before connecting so the first audio has somewhere to go.
      const playback = createPlaybackQueue()
      playbackRef.current = playback
      setOutputAnalyser(playback.analyser)

      // 3. Connect to the Live API from the browser using the ephemeral token.
      // Ephemeral tokens are only supported on the v1alpha API surface, and the
      // config is already locked into the token — so we connect with an empty
      // config (passing it here instead triggers a server-side 1011 error).
      const ai = new GoogleGenAI({ apiKey: token, httpOptions: { apiVersion: 'v1alpha' } })
      const session = await ai.live.connect({
        model: LIVE_MODEL,
        config: {},
        callbacks: {
          onmessage: handleMessage,
          onerror: (e: ErrorEvent) => {
            setError(e.message || 'The live connection reported an error.')
            teardown()
            setPhase('error')
          },
          onclose: () => {
            // If the socket closes unexpectedly mid-round, wrap up gracefully.
            if (!finishingRef.current && phase !== 'report') {
              void finishRef.current()
            }
          },
        },
      })
      sessionRef.current = session

      // 4. Start the microphone stream.
      const mic = await createMicStream((base64) => {
        if (mutedRef.current) return
        try {
          sessionRef.current?.sendRealtimeInput({
            audio: { data: base64, mimeType: 'audio/pcm;rate=16000' },
          })
        } catch {
          // Session may have closed; ignore late chunks.
        }
      })
      micRef.current = mic
      setMicAnalyser(mic.analyser)

      // 5. Kick things off — ask the interviewer to greet and pose Q1.
      session.sendClientContent({
        turns: [{ role: 'user', parts: [{ text: 'Begin the interview: greet me in one sentence and ask the first question.' }] }],
        turnComplete: true,
      })

      setPhase('live')

      // 6. Countdown that drives the UI ring and the wrap-up nudge.
      countdownRef.current = setInterval(() => {
        setSecondsLeft((prev) => {
          const next = prev - 1
          if (next === WRAP_UP_AT && !wrappedUpRef.current) {
            wrappedUpRef.current = true
            try {
              sessionRef.current?.sendClientContent({
                turns: [{ role: 'user', parts: [{ text: 'Time is almost up — ask nothing new, just wrap up.' }] }],
                turnComplete: true,
              })
            } catch {}
          }
          if (next <= 0) {
            if (countdownRef.current) {
              clearInterval(countdownRef.current)
              countdownRef.current = null
            }
            void finishRef.current()
            return 0
          }
          return next
        })
      }, 1000)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not start the interview.')
      teardown()
      setPhase('error')
    }
  }, [phase, handleMessage, teardown])

  const endEarly = useCallback(() => {
    if (phase === 'live') void finishRef.current()
  }, [phase])

  const toggleMute = useCallback(() => {
    setMuted((m) => {
      const next = !m
      mutedRef.current = next
      micRef.current?.setMuted(next)
      return next
    })
  }, [])

  const reset = useCallback(() => {
    teardown()
    finishingRef.current = false
    wrappedUpRef.current = false
    setPhase('idle')
    setError(null)
    setReport(null)
    setTranscript([])
    transcriptRef.current = []
    setSecondsLeft(ROUND_SECONDS)
    setMuted(false)
    mutedRef.current = false
  }, [teardown])

  // Clean up on unmount.
  useEffect(() => teardown, [teardown])

  return {
    phase,
    error,
    secondsLeft,
    transcript,
    report,
    muted,
    modelSpeaking,
    micAnalyser,
    outputAnalyser,
    topic,
    level,
    start,
    endEarly,
    toggleMute,
    reset,
  }
}
