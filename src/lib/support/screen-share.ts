// Screen-share capture for the Support lab. Grabs the user's screen via
// getDisplayMedia, then samples it at a low frame rate, downscales each frame to
// a JPEG, and hands the base64 (no data: prefix) to a callback so the caller can
// forward it to the Gemini Live session as a `video` realtime input.
//
// Frames are intentionally slow (~1 fps) and downscaled: the Live API bills all
// video frames, and a shared screen doesn't need motion — one readable snapshot
// a second is plenty for the AI to read an error.

export interface ScreenShare {
  /** The underlying display stream, for a local preview if desired. */
  stream: MediaStream
  /** Stops sampling and releases the display capture. */
  stop: () => void
}

interface StartScreenShareOptions {
  /** Called with base64 JPEG (no `data:` prefix) for each sampled frame. */
  onFrame: (base64Jpeg: string) => void
  /** Called if the user stops sharing via the browser's own UI. */
  onEnded?: () => void
  /** Frames per second to sample. Default 1. */
  fps?: number
  /** Longest edge of the downscaled frame, in px. Default 1024. */
  maxEdge?: number
  /** JPEG quality 0–1. Default 0.6. */
  quality?: number
}

export async function startScreenShare(opts: StartScreenShareOptions): Promise<ScreenShare> {
  const { onFrame, onEnded, fps = 1, maxEdge = 1024, quality = 0.6 } = opts

  const stream = await navigator.mediaDevices.getDisplayMedia({
    video: { frameRate: { ideal: fps, max: fps } },
    audio: false,
  })

  const video = document.createElement('video')
  video.muted = true
  video.playsInline = true
  video.srcObject = stream
  await video.play().catch(() => {})

  const canvas = document.createElement('canvas')
  const ctx = canvas.getContext('2d')

  let stopped = false
  let timer: ReturnType<typeof setInterval> | null = null

  const sample = () => {
    if (stopped || !ctx) return
    const vw = video.videoWidth
    const vh = video.videoHeight
    if (!vw || !vh) return

    const scale = Math.min(1, maxEdge / Math.max(vw, vh))
    const w = Math.max(1, Math.round(vw * scale))
    const h = Math.max(1, Math.round(vh * scale))
    if (canvas.width !== w) canvas.width = w
    if (canvas.height !== h) canvas.height = h

    ctx.drawImage(video, 0, 0, w, h)
    const dataUrl = canvas.toDataURL('image/jpeg', quality)
    const base64 = dataUrl.slice(dataUrl.indexOf(',') + 1)
    if (base64) onFrame(base64)
  }

  const stop = () => {
    if (stopped) return
    stopped = true
    if (timer) { clearInterval(timer); timer = null }
    for (const track of stream.getTracks()) track.stop()
    video.srcObject = null
  }

  // The user can stop sharing from the browser's native "Stop sharing" bar.
  const track = stream.getVideoTracks()[0]
  if (track) {
    track.addEventListener('ended', () => {
      stop()
      onEnded?.()
    })
  }

  timer = setInterval(sample, Math.max(200, Math.round(1000 / fps)))
  // Grab one frame right away so the AI sees the screen without a 1s lag.
  sample()

  return { stream, stop }
}
