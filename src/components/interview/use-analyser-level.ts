'use client'

import { useEffect, useRef, useState } from 'react'

/**
 * Reads a normalized 0..1 volume level from an AnalyserNode on every animation
 * frame. Returns a ref (for animation-loop reads that shouldn't re-render) and a
 * throttled state value (for React-driven visuals). When `active` is false or
 * there is no analyser, the level decays to 0.
 */
export function useAnalyserLevel(analyser: AnalyserNode | null, active = true) {
  const levelRef = useRef(0)
  const [level, setLevel] = useState(0)

  useEffect(() => {
    if (!analyser || !active) {
      levelRef.current = 0
      // Resetting to a resting level when the source goes quiet/inactive.
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setLevel(0)
      return
    }

    const data = new Uint8Array(analyser.frequencyBinCount)
    let raf = 0
    let frame = 0

    const tick = () => {
      analyser.getByteTimeDomainData(data)
      // RMS around the 128 midpoint → rough loudness.
      let sum = 0
      for (let i = 0; i < data.length; i++) {
        const v = (data[i] - 128) / 128
        sum += v * v
      }
      const rms = Math.sqrt(sum / data.length)
      // Boost + clamp; speech RMS is fairly small.
      const next = Math.min(1, rms * 3.2)
      levelRef.current = next
      // Only push to React ~every 3rd frame to keep renders cheap.
      if (frame++ % 3 === 0) setLevel(next)
      raf = requestAnimationFrame(tick)
    }
    raf = requestAnimationFrame(tick)

    return () => {
      cancelAnimationFrame(raf)
      levelRef.current = 0
    }
  }, [analyser, active])

  return { level, levelRef }
}
