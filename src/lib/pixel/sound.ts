// The lab's noises.
//
// ── Why not lib/visualizer/sound.ts ──
// That one synthesises every sound from oscillators and ships no assets, which
// is right for a step-debugger that needs a different blip per step kind. Pixel
// Lab has two recorded stings and needs them played, so this is an
// HTMLAudioElement and nothing more. No AudioContext: it buys graph routing and
// sample-accurate scheduling that a one-shot on a button press has no use for.
//
// ── Why cloneNode per play ──
// Calling `.play()` on an element already playing restarts it. Score twice
// quickly and the first sting would be cut off mid-note. A clone per play lets
// them overlap, which is what a game does.
//
// ── Autoplay ──
// Both sounds fire from a click (Score, or opening the map after an unlock), so
// the gesture requirement is already satisfied and there is no need for the
// unlock-on-first-interaction dance. `.play()` still returns a promise that can
// reject — on an unsupported codec, or if a browser disagrees — and a rejected
// sound effect must never surface as an error to someone who is mid-challenge.

export type SoundName = 'score' | 'unlock'

const SOURCES: Record<SoundName, string> = {
  /** A score landed and banked tiers. */
  score: '/audio/pixel-lab/score.mp3',
  /** A challenge opened. Played louder when it crossed a topic gate. */
  unlock: '/audio/pixel-lab/unlock.mp3',
}

/**
 * Whether sound plays is a *setting*, and lives with the other settings.
 *
 * It used to own a `pixel-lab:muted` key of its own, which was fine while a
 * speaker button in the header was the only way to change it. Once the lab grew
 * a settings menu, two stores for one preference is two places to disagree.
 *
 * Default on — see lib/pixel/settings.ts. Briefly: the visualizer ships its
 * sound off because it is *ambient*; these are one-shot replies to a button the
 * learner pressed, and silence-by-default means most people never find out the
 * feedback exists.
 */
import { getSettings } from './settings'

const cache = new Map<SoundName, HTMLAudioElement>()

/**
 * Warm the files so the first score is not silent while it downloads.
 *
 * Cheap: 66KB for both. Call it once the lab mounts.
 */
export function preloadSounds(): void {
  if (typeof window === 'undefined') return
  for (const name of Object.keys(SOURCES) as SoundName[]) {
    if (cache.has(name)) continue
    const audio = new Audio(SOURCES[name])
    audio.preload = 'auto'
    cache.set(name, audio)
  }
}

export function playSound(name: SoundName, volume = 0.6): void {
  if (typeof window === 'undefined' || !getSettings().sound) return

  const source = cache.get(name) ?? new Audio(SOURCES[name])
  cache.set(name, source)

  const node = source.cloneNode() as HTMLAudioElement
  node.volume = Math.min(1, Math.max(0, volume))
  // A sound effect that fails is not an error the learner needs to hear about.
  void node.play().catch(() => {})
}
