// Procedural, opt-in ambient audio for the visualizer. No audio assets: every
// sound is synthesised with the Web Audio API, so it stays tiny and tweakable.
//
// The goal is *soothing*, not arcade — very low gain, soft sine/triangle tones
// on a warm pentatonic scale, short decays. One gentle blip per step, a nicer
// two-note chime for console output and function returns.

import type { StepKind } from './types'

let ctx: AudioContext | null = null

function audio(): AudioContext | null {
  if (typeof window === 'undefined') return null
  const AC = window.AudioContext || (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext
  if (!AC) return null
  if (!ctx) ctx = new AC()
  // Autoplay policy: the context starts "suspended" until a user gesture. We
  // call this from within click/keydown handlers, so resume is allowed.
  if (ctx.state === 'suspended') void ctx.resume()
  return ctx
}

// Call from a user gesture (Run click / Space) to unlock audio up front, so the
// very first step's sound isn't swallowed by the autoplay policy.
export function unlockAudio(): void {
  audio()
}

// A soft C-major pentatonic, low octaves — no harsh intervals.
const C = 261.63
const NOTES = {
  c: C, d: C * 9 / 8, e: C * 5 / 4, g: C * 3 / 2, a: C * 5 / 3,
  cLow: C / 2, gLow: (C * 3 / 2) / 2, cHigh: C * 2,
}

function tone(freq: number, when: number, dur: number, gain: number, type: OscillatorType = 'sine'): void {
  const ac = ctx
  if (!ac) return
  const osc = ac.createOscillator()
  const amp = ac.createGain()
  osc.type = type
  osc.frequency.value = freq
  // Quick attack, smooth exponential decay — a soft mallet, not a beep.
  amp.gain.setValueAtTime(0.0001, when)
  amp.gain.exponentialRampToValueAtTime(gain, when + 0.012)
  amp.gain.exponentialRampToValueAtTime(0.0001, when + dur)
  osc.connect(amp).connect(ac.destination)
  osc.start(when)
  osc.stop(when + dur + 0.02)
}

// Map a step kind onto a small, calm sound. Kept intentionally quiet.
export function playStepSound(kind: StepKind): void {
  const ac = audio()
  if (!ac) return
  const t = ac.currentTime
  switch (kind) {
    case 'output':
      // A pleasant two-note "ping" for printed output.
      tone(NOTES.e, t, 0.18, 0.06)
      tone(NOTES.a, t + 0.06, 0.22, 0.05)
      break
    case 'return':
      // Falling pair — "coming back".
      tone(NOTES.g, t, 0.16, 0.045)
      tone(NOTES.c, t + 0.05, 0.2, 0.04)
      break
    case 'call':
    case 'enter':
      // Rising pair — "going in".
      tone(NOTES.c, t, 0.14, 0.04)
      tone(NOTES.g, t + 0.05, 0.18, 0.04)
      break
    case 'condition':
    case 'branch':
      tone(NOTES.d, t, 0.14, 0.04, 'triangle')
      break
    case 'assign':
    case 'declare':
    case 'write':
      tone(NOTES.g, t, 0.12, 0.035)
      break
    case 'read':
      tone(NOTES.a, t, 0.1, 0.03)
      break
    case 'loop-start':
    case 'loop-end':
      tone(NOTES.cLow, t, 0.16, 0.04, 'triangle')
      break
    case 'loop-check':
    case 'loop-iter':
      // Very soft tick so long loops don't get fatiguing.
      tone(NOTES.gLow, t, 0.08, 0.022)
      break
    default:
      tone(NOTES.c, t, 0.09, 0.025)
  }
}

// A warm three-note resolve when the whole run finishes.
export function playFinishSound(): void {
  const ac = audio()
  if (!ac) return
  const t = ac.currentTime
  tone(NOTES.c, t, 0.25, 0.05)
  tone(NOTES.e, t + 0.09, 0.28, 0.045)
  tone(NOTES.cHigh, t + 0.18, 0.4, 0.05)
}

// ── Arena sounds ───────────────────────────────────────────────────────────
// Punchier than the calm learn-mode set: these are the "moments" of Challenge
// Mode. Still procedural, still bounded gain. Fired from FX components which
// already gate on reduced-motion / calm mode, so no extra guard here.

// One low thump per countdown number (3 · 2 · 1).
export function playCountdownBeat(): void {
  const ac = audio()
  if (!ac) return
  const t = ac.currentTime
  tone(NOTES.cLow, t, 0.18, 0.06, 'triangle')
  tone(NOTES.c, t, 0.1, 0.03, 'sine')
}

// The "GO!" — a bright rising sting.
export function playGoSting(): void {
  const ac = audio()
  if (!ac) return
  const t = ac.currentTime
  tone(NOTES.g, t, 0.14, 0.06, 'sawtooth')
  tone(NOTES.cHigh, t + 0.06, 0.24, 0.06, 'sawtooth')
  tone(NOTES.cHigh * 1.5, t + 0.12, 0.3, 0.05, 'triangle')
}

// Triumphant fanfare on a win.
export function playVictoryFanfare(): void {
  const ac = audio()
  if (!ac) return
  const t = ac.currentTime
  tone(NOTES.c, t, 0.18, 0.06)
  tone(NOTES.e, t + 0.1, 0.18, 0.06)
  tone(NOTES.g, t + 0.2, 0.2, 0.06)
  tone(NOTES.cHigh, t + 0.32, 0.5, 0.07, 'triangle')
}

// A soft, low descending thud on a loss — never harsh.
export function playDefeatThud(): void {
  const ac = audio()
  if (!ac) return
  const t = ac.currentTime
  tone(NOTES.g / 2, t, 0.3, 0.05, 'sine')
  tone(NOTES.cLow, t + 0.12, 0.4, 0.045, 'sine')
}

// A brittle crack when a "try" pip shatters after a failed submit.
export function playShatter(): void {
  const ac = audio()
  if (!ac) return
  const t = ac.currentTime
  tone(NOTES.cHigh * 1.5, t, 0.06, 0.05, 'square')
  tone(NOTES.a, t + 0.03, 0.08, 0.035, 'square')
}

// A quick coin blip — used to tick the XP counter up on a win.
export function playCoin(): void {
  const ac = audio()
  if (!ac) return
  const t = ac.currentTime
  tone(NOTES.e, t, 0.05, 0.04, 'square')
  tone(NOTES.cHigh, t + 0.03, 0.08, 0.04, 'square')
}

// A dry clock tick — one per second in the last 10 seconds of a timed round.
// Very short and quiet so it reads as tension, not alarm.
export function playTick(): void {
  const ac = audio()
  if (!ac) return
  const t = ac.currentTime
  tone(NOTES.gLow, t, 0.04, 0.03, 'square')
}

// A rising hum while the Submit button charges (hold-to-fire). `frac` 0..1 maps
// to pitch so the pitch climbs as the ring fills. Call in short bursts.
export function playCharge(frac: number): void {
  const ac = audio()
  if (!ac) return
  const t = ac.currentTime
  tone(NOTES.c * (1 + frac), t, 0.06, 0.025, 'triangle')
}

// A rising blip per passed test segment in the combo-bar reveal. `index` is the
// segment position (0-based); pitch climbs step by step like a slot machine.
export function playComboBlip(index: number): void {
  const ac = audio()
  if (!ac) return
  const t = ac.currentTime
  tone(C * Math.pow(2, index / 12), t, 0.08, 0.05, 'square')
}

// A soft chime as an XP mote lands on the balance badge.
export function playMote(): void {
  const ac = audio()
  if (!ac) return
  const t = ac.currentTime
  tone(NOTES.cHigh, t, 0.06, 0.03, 'sine')
}

// A crisp click when selecting a difficulty/mode card in the setup screen.
export function playSelect(): void {
  const ac = audio()
  if (!ac) return
  const t = ac.currentTime
  tone(NOTES.g, t, 0.04, 0.035, 'triangle')
  tone(NOTES.cHigh, t + 0.02, 0.06, 0.03, 'sine')
}
