// The two pieces of the graceful ending that are pure logic, and therefore the
// two that are worth pinning: how long the model must wait before it may hang up,
// and how we decide its goodbye has finished playing.
import { describe, expect, it, vi } from 'vitest'
import { endingInstruction, minElapsedSeconds, waitForFarewell } from './end-session'

describe('minElapsedSeconds', () => {
  it('holds the model off for the first minute of a normal round', () => {
    expect(minElapsedSeconds(180)).toBe(60) // interview / feynman / english
  })

  it('does not scale the guard up on a long call', () => {
    // The whole point of the cap. A flat 40% of a ten-minute support call would
    // trap a learner whose problem was solved after two minutes.
    expect(minElapsedSeconds(600)).toBe(60)
  })

  it('falls back to a fraction when a minute would be most of the round', () => {
    expect(minElapsedSeconds(60)).toBe(24)
    expect(minElapsedSeconds(30)).toBe(12)
  })
})

describe('waitForFarewell', () => {
  it('waits for the goodbye to finish, not for a fixed guess', async () => {
    vi.useFakeTimers()
    // Two seconds of audio still queued, draining as it plays.
    let pending = 2
    const timer = setInterval(() => { pending = Math.max(0, pending - 0.5) }, 100)

    const done = vi.fn()
    const wait = waitForFarewell(() => pending).then(done)

    await vi.advanceTimersByTimeAsync(300)
    expect(done).not.toHaveBeenCalled() // still speaking — must not hang up

    await vi.advanceTimersByTimeAsync(1200) // audio drains, then 500ms of quiet
    await wait
    expect(done).toHaveBeenCalled()

    clearInterval(timer)
    vi.useRealTimers()
  })

  it('treats a gap between chunks as speech, not as the end', async () => {
    vi.useFakeTimers()
    // Silent, then more audio arrives 300ms later: a pause mid-sentence.
    let pending = 0
    setTimeout(() => { pending = 1 }, 300)
    setTimeout(() => { pending = 0 }, 900)

    const done = vi.fn()
    const wait = waitForFarewell(() => pending).then(done)

    // A 500ms quiet window that a chunk lands inside must NOT resolve.
    await vi.advanceTimersByTimeAsync(600)
    expect(done).not.toHaveBeenCalled()

    await vi.advanceTimersByTimeAsync(1000)
    await wait
    expect(done).toHaveBeenCalled()

    vi.useRealTimers()
  })

  it('gives up at the cap, so a silent model cannot strand the learner', async () => {
    vi.useFakeTimers()
    const done = vi.fn()
    // Never drains: the model called the tool and then kept talking forever.
    const wait = waitForFarewell(() => 5, { capMs: 10_000 }).then(done)

    await vi.advanceTimersByTimeAsync(9_000)
    expect(done).not.toHaveBeenCalled()

    await vi.advanceTimersByTimeAsync(2_000)
    await wait
    expect(done).toHaveBeenCalled()

    vi.useRealTimers()
  })

  it('returns promptly when the model called the tool having said nothing', async () => {
    vi.useFakeTimers()
    const done = vi.fn()
    const wait = waitForFarewell(() => 0).then(done)

    await vi.advanceTimersByTimeAsync(700) // one quiet window, not the 10s cap
    await wait
    expect(done).toHaveBeenCalled()

    vi.useRealTimers()
  })
})

describe('endingInstruction', () => {
  it('names the tool and demands the goodbye come first', () => {
    const text = endingInstruction(180)
    expect(text).toContain('end_session')
    expect(text).toMatch(/3 minutes/)
    // The ordering is the load-bearing part: a tool call with nothing said ends
    // the round in silence.
    expect(text.indexOf('goodbye')).toBeLessThan(text.lastIndexOf('end_session'))
  })
})
