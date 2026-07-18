// Audio recording for the interview lab: captures mic (16 kHz PCM16) and AI
// output (24 kHz PCM16) as raw chunks, converts to WAV on stop, and persists
// to IndexedDB so recordings survive page refreshes.
//
// Browser-only — every function touches Web Audio / IndexedDB.

const DB_NAME = 'interview-recordings'
const DB_VERSION = 1
const STORE_NAME = 'recordings'

interface StoredRecording {
  sessionId: string
  micWav: Blob
  aiWav: Blob
  createdAt: number
}

// ── IndexedDB helpers ──────────────────────────────────────────────────────

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION)
    req.onupgradeneeded = () => {
      const db = req.result
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME, { keyPath: 'sessionId' })
      }
    }
    req.onsuccess = () => resolve(req.result)
    req.onerror = () => reject(req.error)
  })
}

/** Persist both WAV blobs for a session. */
export async function saveRecording(sessionId: string, micWav: Blob, aiWav: Blob): Promise<void> {
  const db = await openDb()
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readwrite')
    tx.objectStore(STORE_NAME).put({ sessionId, micWav, aiWav, createdAt: Date.now() })
    tx.oncomplete = () => { db.close(); resolve() }
    tx.onerror = () => { db.close(); reject(tx.error) }
  })
}

/** Retrieve recordings for a session. Returns null if not found. */
export async function getRecording(sessionId: string): Promise<{ micWav: Blob; aiWav: Blob } | null> {
  const db = await openDb()
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readonly')
    const req = tx.objectStore(STORE_NAME).get(sessionId)
    req.onsuccess = () => {
      db.close()
      const row = req.result as StoredRecording | undefined
      resolve(row ? { micWav: row.micWav, aiWav: row.aiWav } : null)
    }
    req.onerror = () => { db.close(); reject(req.error) }
  })
}

/** Delete a recording. */
export async function deleteRecording(sessionId: string): Promise<void> {
  const db = await openDb()
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readwrite')
    tx.objectStore(STORE_NAME).delete(sessionId)
    tx.oncomplete = () => { db.close(); resolve() }
    tx.onerror = () => { db.close(); reject(tx.error) }
  })
}

// ── WAV encoding ───────────────────────────────────────────────────────────

function pcm16ToWav(samples: Int16Array, sampleRate: number): Blob {
  const numChannels = 1
  const bitsPerSample = 16
  const byteRate = sampleRate * numChannels * (bitsPerSample / 8)
  const blockAlign = numChannels * (bitsPerSample / 8)
  const dataSize = samples.length * (bitsPerSample / 8)
  const headerSize = 44
  const buffer = new ArrayBuffer(headerSize + dataSize)
  const view = new DataView(buffer)

  // RIFF header
  writeString(view, 0, 'RIFF')
  view.setUint32(4, 36 + dataSize, true)
  writeString(view, 8, 'WAVE')

  // fmt chunk
  writeString(view, 12, 'fmt ')
  view.setUint32(16, 16, true) // chunk size
  view.setUint16(20, 1, true) // PCM format
  view.setUint16(22, numChannels, true)
  view.setUint32(24, sampleRate, true)
  view.setUint32(28, byteRate, true)
  view.setUint16(32, blockAlign, true)
  view.setUint16(34, bitsPerSample, true)

  // data chunk
  writeString(view, 36, 'data')
  view.setUint32(40, dataSize, true)

  // PCM samples (already Int16, just copy the bytes)
  const int8 = new Int8Array(buffer, headerSize)
  const src = new Int8Array(samples.buffer, samples.byteOffset, samples.byteLength)
  int8.set(src)

  return new Blob([buffer], { type: 'audio/wav' })
}

function writeString(view: DataView, offset: number, str: string) {
  for (let i = 0; i < str.length; i++) view.setUint8(offset + i, str.charCodeAt(i))
}

// ── AudioRecorder ──────────────────────────────────────────────────────────

/**
 * Collects PCM16 base64 chunks from the mic and AI output streams,
 * then converts them to WAV blobs on stop, and persists to IndexedDB
 * so recordings survive page refreshes.
 *
 * The AI stream only receives chunks when the model is speaking. To keep the
 * AI WAV on the same timeline as the continuous mic WAV, `pushAi` tracks
 * wall-clock timestamps and inserts silence padding between chunks.
 *
 * Usage:
 *   const rec = new AudioRecorder()
 *   // in the mic onChunk callback: rec.pushMic(base64)
 *   // in the AI audio handler:     rec.pushAi(base64)
 *   // when finished:               const { micWav, aiWav } = rec.stop()
 */
export class AudioRecorder {
  private micChunks: Int16Array[] = []
  private aiChunks: Int16Array[] = []
  private stopped = false

  private startTime = 0
  private lastAiTime = 0

  /** Push a base64-encoded PCM16 chunk from the microphone (16 kHz). */
  pushMic(base64: string) {
    if (this.stopped) return
    const now = performance.now()
    if (!this.startTime) this.startTime = now
    this.micChunks.push(base64ToInt16(base64))
  }

  /** Push a base64-encoded PCM16 chunk from the AI output (24 kHz). */
  pushAi(base64: string) {
    if (this.stopped) return
    const now = performance.now()
    if (!this.startTime) this.startTime = now

    // Insert silence for the gap since the last AI chunk (or since recording
    // started) so the AI WAV stays on the same real-time timeline as the mic.
    if (this.lastAiTime) {
      const gapMs = now - this.lastAiTime
      if (gapMs > 20) {
        const gapSamples = Math.round((gapMs / 1000) * 24000)
        this.aiChunks.push(new Int16Array(gapSamples))
      }
    } else if (this.startTime && now - this.startTime > 20) {
      const leadingSilence = Math.round(((now - this.startTime) / 1000) * 24000)
      this.aiChunks.push(new Int16Array(leadingSilence))
    }

    this.lastAiTime = now
    this.aiChunks.push(base64ToInt16(base64))
  }

  /** Stop recording and return WAV blobs. */
  stop(): { micWav: Blob; aiWav: Blob } {
    if (this.stopped) return { micWav: new Blob(), aiWav: new Blob() }
    this.stopped = true

    const micWav = concatAndEncode(this.micChunks, 16000)
    const aiWav = concatAndEncode(this.aiChunks, 24000)
    this.micChunks = []
    this.aiChunks = []
    return { micWav, aiWav }
  }

  /** Discard all collected data without producing WAVs. */
  discard() {
    this.stopped = true
    this.micChunks = []
    this.aiChunks = []
  }
}

function concatAndEncode(chunks: Int16Array[], sampleRate: number): Blob {
  if (chunks.length === 0) return new Blob([new ArrayBuffer(44)], { type: 'audio/wav' })
  const totalLen = chunks.reduce((sum, c) => sum + c.length, 0)
  const merged = new Int16Array(totalLen)
  let offset = 0
  for (const chunk of chunks) {
    merged.set(chunk, offset)
    offset += chunk.length
  }
  return pcm16ToWav(merged, sampleRate)
}

function base64ToInt16(base64: string): Int16Array {
  const binary = atob(base64)
  const bytes = new Uint8Array(binary.length)
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i)
  return new Int16Array(bytes.buffer, 0, Math.floor(bytes.byteLength / 2))
}
