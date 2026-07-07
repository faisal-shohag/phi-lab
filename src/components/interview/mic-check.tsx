'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { Mic, MicOff } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'

export type MicState = 'unknown' | 'checking' | 'granted' | 'denied'

interface MicCheckProps {
  /** Notifies the parent when permission state changes (e.g. to enable Start). */
  onStateChange?: (state: MicState) => void
  /** Auto-request the mic on mount. */
  autoStart?: boolean
  className?: string
}

/**
 * Self-contained microphone permission + live level meter. Opens its own
 * getUserMedia stream and AnalyserNode purely for the pre-flight check; it stops
 * the stream on unmount so it never competes with the live interview's mic.
 */
export function MicCheck({ onStateChange, autoStart = false, className }: MicCheckProps) {
  const [micState, setMicState] = useState<MicState>('unknown')
  const [micLevel, setMicLevel] = useState(0)
  const cleanupRef = useRef<(() => void) | null>(null)

  const setState = useCallback((s: MicState) => {
    setMicState(s)
    onStateChange?.(s)
  }, [onStateChange])

  const checkMic = useCallback(async () => {
    if (cleanupRef.current) { cleanupRef.current(); cleanupRef.current = null }
    setState('checking')
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      const AC = (window.AudioContext ?? (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext)
      const ctx = new AC()
      const src = ctx.createMediaStreamSource(stream)
      const analyser = ctx.createAnalyser()
      analyser.fftSize = 512
      src.connect(analyser)
      const data = new Uint8Array(analyser.frequencyBinCount)
      let raf = 0
      const tick = () => {
        analyser.getByteTimeDomainData(data)
        let sum = 0
        for (let i = 0; i < data.length; i++) { const v = (data[i] - 128) / 128; sum += v * v }
        setMicLevel(Math.min(1, Math.sqrt(sum / data.length) * 3.2))
        raf = requestAnimationFrame(tick)
      }
      raf = requestAnimationFrame(tick)
      setState('granted')
      cleanupRef.current = () => {
        cancelAnimationFrame(raf)
        for (const t of stream.getTracks()) t.stop()
        void ctx.close().catch(() => {})
      }
    } catch {
      setState('denied')
    }
  }, [setState])

  useEffect(() => {
    // Defer out of the effect body so the first setState doesn't cascade-render.
    const t = autoStart ? setTimeout(() => { void checkMic() }, 0) : undefined
    return () => {
      if (t) clearTimeout(t)
      cleanupRef.current?.()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  return (
    <div className={cn('flex flex-col gap-3 rounded-xl border-2 border-border bg-card p-4 sm:flex-row sm:items-center', className)}>
      <Button
        variant={micState === 'granted' ? 'secondary' : 'outline'}
        onClick={checkMic}
        disabled={micState === 'checking'}
      >
        {micState === 'denied' ? <MicOff className="mr-1.5 text-rose-500" /> : <Mic className="mr-1.5" />}
        {micState === 'granted' ? 'Mic ready' : micState === 'checking' ? 'Requesting…' : 'Test microphone'}
      </Button>

      <div className="flex flex-1 items-center gap-2">
        <div className="flex h-6 flex-1 items-center gap-0.5">
          {Array.from({ length: 24 }).map((_, i) => {
            const on = micLevel * 24 > i
            return (
              <div
                key={i}
                className={cn(
                  'h-full flex-1 rounded-full transition-colors duration-75',
                  on ? (i > 18 ? 'bg-rose-500' : i > 12 ? 'bg-amber-500' : 'bg-emerald-500') : 'bg-muted',
                )}
                style={{ opacity: on ? 1 : 0.4 }}
              />
            )
          })}
        </div>
      </div>

      {micState === 'denied' && (
        <p className="text-xs text-rose-500">Mic blocked — allow access in your browser to speak.</p>
      )}
    </div>
  )
}
