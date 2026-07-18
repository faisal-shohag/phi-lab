'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { motion } from 'framer-motion'
import { Play, Pause, RotateCcw, Volume2, VolumeX, Download, Radio } from 'lucide-react'
import { getRecording } from '@/lib/interview/recorder'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'

interface AudioReplayProps {
  sessionId: string
  className?: string
}

function formatTime(sec: number): string {
  if (!Number.isFinite(sec) || sec < 0) return '0:00'
  const m = Math.floor(sec / 60)
  const s = Math.floor(sec % 60)
  return `${m}:${s.toString().padStart(2, '0')}`
}

export function AudioReplay({ sessionId, className }: AudioReplayProps) {
  const [loading, setLoading] = useState(true)
  const [available, setAvailable] = useState(false)
  const [playing, setPlaying] = useState(false)
  const [currentTime, setCurrentTime] = useState(0)
  const [duration, setDuration] = useState(0)
  const [volume, setVolume] = useState(0.8)
  const [muted, setMuted] = useState(false)

  const micAudioRef = useRef<HTMLAudioElement | null>(null)
  const aiAudioRef = useRef<HTMLAudioElement | null>(null)
  const animRef = useRef<number>(0)

  // Load recordings from IndexedDB on mount.
  useEffect(() => {
    let cancelled = false
    getRecording(sessionId)
      .then((rec) => {
        if (cancelled) return
        if (!rec) {
          setAvailable(false)
          setLoading(false)
          return
        }

        const micUrl = URL.createObjectURL(rec.micWav)
        const aiUrl = URL.createObjectURL(rec.aiWav)

        const micAudio = new Audio(micUrl)
        const aiAudio = new Audio(aiUrl)
        micAudio.preload = 'auto'
        aiAudio.preload = 'auto'

        micAudioRef.current = micAudio
        aiAudioRef.current = aiAudio

        const syncTime = () => {
          setCurrentTime(micAudio.currentTime)
        }

        const onLoaded = () => {
          setDuration(Math.max(micAudio.duration || 0, aiAudio.duration || 0))
          setAvailable(true)
          setLoading(false)
        }

        micAudio.addEventListener('loadedmetadata', onLoaded)
        aiAudio.addEventListener('loadedmetadata', onLoaded)
        micAudio.addEventListener('timeupdate', syncTime)
        micAudio.addEventListener('ended', () => setPlaying(false))

        return () => {
          cancelled = true
          micAudio.removeEventListener('loadedmetadata', onLoaded)
          aiAudio.removeEventListener('loadedmetadata', onLoaded)
          micAudio.removeEventListener('timeupdate', syncTime)
          micAudio.pause()
          aiAudio.pause()
          URL.revokeObjectURL(micUrl)
          URL.revokeObjectURL(aiUrl)
        }
      })
      .catch(() => {
        if (!cancelled) { setAvailable(false); setLoading(false) }
      })

    return () => { cancelled = true }
  }, [sessionId])

  // Sync volume.
  useEffect(() => {
    if (micAudioRef.current) micAudioRef.current.volume = muted ? 0 : volume
    if (aiAudioRef.current) aiAudioRef.current.volume = muted ? 0 : volume
  }, [volume, muted])

  const togglePlay = useCallback(() => {
    const mic = micAudioRef.current
    const ai = aiAudioRef.current
    if (!mic || !ai) return

    if (playing) {
      mic.pause()
      ai.pause()
      setPlaying(false)
      cancelAnimationFrame(animRef.current)
    } else {
      const pos = mic.currentTime || 0
      mic.currentTime = pos
      ai.currentTime = pos
      mic.play().catch(() => {})
      ai.play().catch(() => {})
      setPlaying(true)

      const tick = () => {
        setCurrentTime(mic.currentTime)
        animRef.current = requestAnimationFrame(tick)
      }
      animRef.current = requestAnimationFrame(tick)
    }
  }, [playing])

  const seek = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    const rect = e.currentTarget.getBoundingClientRect()
    const pct = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width))
    const time = pct * duration
    if (micAudioRef.current) micAudioRef.current.currentTime = time
    if (aiAudioRef.current) aiAudioRef.current.currentTime = time
    setCurrentTime(time)
  }, [duration])

  const restart = useCallback(() => {
    if (micAudioRef.current) micAudioRef.current.currentTime = 0
    if (aiAudioRef.current) aiAudioRef.current.currentTime = 0
    setCurrentTime(0)
    if (!playing) {
      togglePlay()
    }
  }, [playing, togglePlay])

  const downloadWav = useCallback(async () => {
    const rec = await getRecording(sessionId)
    if (!rec) return
    const blob = await mixWavs(rec.micWav, rec.aiWav)
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `interview-recording-${sessionId.slice(0, 8)}.wav`
    a.click()
    URL.revokeObjectURL(url)
  }, [sessionId])

  if (loading) {
    return (
      <div className={cn('flex items-center justify-center rounded-2xl border-2 border-border bg-card p-6 shadow-sm', className)}>
        <div className="h-5 w-5 animate-spin rounded-full border-2 border-muted border-t-primary" />
        <span className="ml-2 text-sm text-muted-foreground">Loading recording…</span>
      </div>
    )
  }

  if (!available) return null

  const progress = duration > 0 ? (currentTime / duration) * 100 : 0

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      className={cn('rounded-2xl border-2 border-border bg-card p-5 shadow-sm', className)}
    >
      <div className="mb-3 flex items-center gap-2">
        <Radio className="h-4 w-4 text-amber-500" />
        <h3 className="text-sm font-semibold">Audio Replay</h3>
      </div>

      {/* Progress bar */}
      <div
        className="relative mb-2 h-10 cursor-pointer rounded-lg bg-muted/50"
        onClick={seek}
        role="slider"
        aria-label="Seek"
        aria-valuenow={Math.round(currentTime)}
        aria-valuemax={Math.round(duration)}
        tabIndex={0}
      >
        <div
          className="absolute inset-y-0 left-0 rounded-lg bg-gradient-to-r from-rose-200 to-violet-200 dark:from-rose-900/40 dark:to-violet-900/40 transition-colors"
          style={{ width: `${progress}%` }}
        />
        <div
          className="absolute top-1/2 h-3.5 w-3.5 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-white bg-primary shadow-md"
          style={{ left: `${progress}%` }}
        />
      </div>

      {/* Controls */}
      <div className="flex items-center gap-3">
        <span className="w-10 text-right font-mono text-xs text-muted-foreground">{formatTime(currentTime)}</span>

        <button onClick={restart} className="rounded-full p-1.5 text-muted-foreground hover:bg-muted" title="Restart">
          <RotateCcw className="h-4 w-4" />
        </button>

        <button
          onClick={togglePlay}
          className="flex h-9 w-9 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-md transition-transform hover:scale-105"
        >
          {playing ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4 ml-0.5" />}
        </button>

        <span className="w-10 font-mono text-xs text-muted-foreground">{formatTime(duration)}</span>

        <div className="ml-auto flex items-center gap-1">
          <button onClick={() => setMuted(!muted)} className="rounded-full p-1.5 text-muted-foreground hover:bg-muted" title={muted ? 'Unmute' : 'Mute'}>
            {muted ? <VolumeX className="h-4 w-4" /> : <Volume2 className="h-4 w-4" />}
          </button>
          <input
            type="range"
            min={0}
            max={1}
            step={0.05}
            value={muted ? 0 : volume}
            onChange={(e) => { setVolume(parseFloat(e.target.value)); setMuted(false) }}
            className="h-1 w-16 cursor-pointer accent-primary"
          />
          <Button variant="ghost" size="sm" onClick={downloadWav} title="Download recording">
            <Download className="h-3.5 w-3.5" />
          </Button>
        </div>
      </div>
    </motion.div>
  )
}

// ── WAV mixing ──────────────────────────────────────────────────────────────

async function mixWavs(micBlob: Blob, aiBlob: Blob): Promise<Blob> {
  const ctx = new OfflineAudioContext({ numberOfChannels: 1, length: 1, sampleRate: 48000 })

  const [micBuf, aiBuf] = await Promise.all([
    decodeWav(ctx, micBlob),
    decodeWav(ctx, aiBlob),
  ])

  const length = Math.max(micBuf.length, aiBuf.length)
  const offline = new OfflineAudioContext({ numberOfChannels: 1, length, sampleRate: 48000 })

  const micSource = offline.createBufferSource()
  micSource.buffer = micBuf
  micSource.connect(offline.destination)
  micSource.start(0)

  const aiSource = offline.createBufferSource()
  aiSource.buffer = aiBuf
  aiSource.connect(offline.destination)
  aiSource.start(0)

  const mixed = await offline.startRendering()
  return audioBufferToWav(mixed)
}

async function decodeWav(ctx: OfflineAudioContext, blob: Blob): Promise<AudioBuffer> {
  const arrayBuffer = await blob.arrayBuffer()
  return ctx.decodeAudioData(arrayBuffer)
}

function audioBufferToWav(buffer: AudioBuffer): Blob {
  const numChannels = 1
  const sampleRate = buffer.sampleRate
  const bitsPerSample = 16
  const samples = buffer.getChannelData(0)
  const dataSize = samples.length * (bitsPerSample / 8)
  const headerSize = 44
  const arrayBuffer = new ArrayBuffer(headerSize + dataSize)
  const view = new DataView(arrayBuffer)

  writeString(view, 0, 'RIFF')
  view.setUint32(4, 36 + dataSize, true)
  writeString(view, 8, 'WAVE')
  writeString(view, 12, 'fmt ')
  view.setUint32(16, 16, true)
  view.setUint16(20, 1, true)
  view.setUint16(22, numChannels, true)
  view.setUint32(24, sampleRate, true)
  view.setUint32(28, sampleRate * numChannels * (bitsPerSample / 8), true)
  view.setUint16(32, numChannels * (bitsPerSample / 8), true)
  view.setUint16(34, bitsPerSample, true)
  writeString(view, 36, 'data')
  view.setUint32(40, dataSize, true)

  const int16 = new Int16Array(arrayBuffer, headerSize)
  for (let i = 0; i < samples.length; i++) {
    const s = Math.max(-1, Math.min(1, samples[i]))
    int16[i] = s < 0 ? s * 0x8000 : s * 0x7fff
  }

  return new Blob([arrayBuffer], { type: 'audio/wav' })
}

function writeString(view: DataView, offset: number, str: string) {
  for (let i = 0; i < str.length; i++) view.setUint8(offset + i, str.charCodeAt(i))
}
