// Browser audio plumbing for the live interview: a 16kHz PCM16 microphone
// capture stream (via an inline AudioWorklet) and a 24kHz PCM16 playback queue
// for the model's voice. Both expose an AnalyserNode so the UI can visualise
// levels (mic meter + speaking orb).
//
// This module only runs in the browser — every entry point touches Web Audio /
// getUserMedia, so callers must guard against SSR.

export interface MicStream {
  stop: () => void
  analyser: AnalyserNode
  setMuted: (muted: boolean) => void
}

export interface PlaybackQueue {
  enqueue: (base64Pcm: string) => void
  flush: () => void
  close: () => void
  analyser: AnalyserNode
  /** Approximate seconds of audio still queued to play. */
  pendingSeconds: () => number
}

// The worklet runs on the audio render thread. It buffers incoming Float32
// samples into ~2048-sample blocks and posts each block back to the main thread,
// where we downconvert to PCM16 + base64. Registered from a Blob URL so we don't
// need a separate static asset.
const WORKLET_SOURCE = `
class MicCaptureProcessor extends AudioWorkletProcessor {
  constructor() {
    super()
    this._buf = new Float32Array(2048)
    this._offset = 0
    this._muted = false
    this.port.onmessage = (e) => {
      if (e.data && e.data.type === 'mute') this._muted = !!e.data.value
    }
  }
  process(inputs) {
    const input = inputs[0]
    if (!input || input.length === 0) return true
    const channel = input[0]
    if (!channel) return true
    if (this._muted) return true
    for (let i = 0; i < channel.length; i++) {
      this._buf[this._offset++] = channel[i]
      if (this._offset === this._buf.length) {
        this.port.postMessage(this._buf.slice(0))
        this._offset = 0
      }
    }
    return true
  }
}
registerProcessor('mic-capture', MicCaptureProcessor)
`

function floatTo16BitPCM(input: Float32Array): ArrayBuffer {
  const out = new ArrayBuffer(input.length * 2)
  const view = new DataView(out)
  for (let i = 0; i < input.length; i++) {
    let s = Math.max(-1, Math.min(1, input[i]))
    s = s < 0 ? s * 0x8000 : s * 0x7fff
    view.setInt16(i * 2, s, true) // little-endian
  }
  return out
}

function arrayBufferToBase64(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer)
  let binary = ''
  const chunk = 0x8000
  for (let i = 0; i < bytes.length; i += chunk) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunk))
  }
  return btoa(binary)
}

function base64ToInt16(base64: string): Int16Array {
  const binary = atob(base64)
  const bytes = new Uint8Array(binary.length)
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i)
  // The PCM stream is 16-bit; reinterpret the byte buffer as Int16.
  return new Int16Array(bytes.buffer, 0, Math.floor(bytes.byteLength / 2))
}

// AudioContext isn't in the default TS DOM lib under some configs; keep a
// minimal local alias for the webkit-prefixed fallback.
type AudioContextCtor = typeof AudioContext

function getAudioContextCtor(): AudioContextCtor {
  const w = window as unknown as { AudioContext?: AudioContextCtor; webkitAudioContext?: AudioContextCtor }
  const Ctor = w.AudioContext ?? w.webkitAudioContext
  if (!Ctor) throw new Error('Web Audio API is not available in this browser.')
  return Ctor
}

/**
 * Open the microphone and start streaming 16kHz PCM16 base64 chunks to
 * `onChunk`. Returns handles to stop the stream and to read the input level.
 */
export async function createMicStream(onChunk: (base64: string) => void): Promise<MicStream> {
  const stream = await navigator.mediaDevices.getUserMedia({
    audio: { channelCount: 1, echoCancellation: true, noiseSuppression: true },
  })

  const Ctor = getAudioContextCtor()
  const ctx = new Ctor({ sampleRate: 16000 })
  // Resume in case the context starts suspended (autoplay policies).
  if (ctx.state === 'suspended') await ctx.resume()

  const blob = new Blob([WORKLET_SOURCE], { type: 'application/javascript' })
  const url = URL.createObjectURL(blob)
  try {
    await ctx.audioWorklet.addModule(url)
  } finally {
    URL.revokeObjectURL(url)
  }

  const source = ctx.createMediaStreamSource(stream)
  const analyser = ctx.createAnalyser()
  analyser.fftSize = 1024
  analyser.smoothingTimeConstant = 0.6

  const worklet = new AudioWorkletNode(ctx, 'mic-capture')
  worklet.port.onmessage = (e: MessageEvent) => {
    const floats = e.data as Float32Array
    const pcm = floatTo16BitPCM(floats)
    onChunk(arrayBufferToBase64(pcm))
  }

  source.connect(analyser)
  source.connect(worklet)
  // Do NOT connect the worklet to the destination — we don't want to hear our
  // own mic. The analyser also stays off the output path.

  let stopped = false
  return {
    analyser,
    setMuted: (muted: boolean) => {
      worklet.port.postMessage({ type: 'mute', value: muted })
    },
    stop: () => {
      if (stopped) return
      stopped = true
      try { worklet.port.onmessage = null } catch {}
      try { worklet.disconnect() } catch {}
      try { source.disconnect() } catch {}
      try { analyser.disconnect() } catch {}
      for (const track of stream.getTracks()) track.stop()
      void ctx.close().catch(() => {})
    },
  }
}

/**
 * A playback queue that decodes 24kHz PCM16 base64 chunks and schedules them
 * back-to-back so the model's voice plays without gaps. `flush()` stops
 * everything immediately (used when the model is interrupted).
 */
export function createPlaybackQueue(): PlaybackQueue {
  const Ctor = getAudioContextCtor()
  const ctx = new Ctor({ sampleRate: 24000 })
  const analyser = ctx.createAnalyser()
  analyser.fftSize = 1024
  analyser.smoothingTimeConstant = 0.6
  analyser.connect(ctx.destination)

  let nextStartTime = 0
  const sources = new Set<AudioBufferSourceNode>()

  const enqueue = (base64: string) => {
    if (ctx.state === 'suspended') void ctx.resume().catch(() => {})
    const int16 = base64ToInt16(base64)
    if (int16.length === 0) return

    const buffer = ctx.createBuffer(1, int16.length, 24000)
    const channel = buffer.getChannelData(0)
    for (let i = 0; i < int16.length; i++) channel[i] = int16[i] / 0x8000

    const src = ctx.createBufferSource()
    src.buffer = buffer
    src.connect(analyser)

    const now = ctx.currentTime
    // If we've fallen behind (queue drained), start slightly in the future.
    const startAt = Math.max(now + 0.02, nextStartTime)
    src.start(startAt)
    nextStartTime = startAt + buffer.duration

    sources.add(src)
    src.onended = () => { sources.delete(src) }
  }

  const flush = () => {
    for (const src of sources) {
      try { src.onended = null; src.stop() } catch {}
    }
    sources.clear()
    nextStartTime = 0
  }

  const pendingSeconds = () => Math.max(0, nextStartTime - ctx.currentTime)

  const close = () => {
    flush()
    try { analyser.disconnect() } catch {}
    void ctx.close().catch(() => {})
  }

  return { enqueue, flush, close, analyser, pendingSeconds }
}
