import { describe, it, expect } from 'vitest'
import { contestStatus, isRunning, secondsToTransition } from '../contest-status'

const start = new Date('2026-01-10T12:00:00Z')
const end = new Date('2026-01-10T14:00:00Z')

describe('contestStatus', () => {
  it('is UPCOMING before the window', () => {
    expect(contestStatus(new Date('2026-01-10T11:59:59Z'), start, end)).toBe('UPCOMING')
  })

  it('is RUNNING exactly at startsAt (inclusive)', () => {
    expect(contestStatus(start, start, end)).toBe('RUNNING')
  })

  it('is RUNNING mid-window', () => {
    expect(contestStatus(new Date('2026-01-10T13:00:00Z'), start, end)).toBe('RUNNING')
  })

  it('is FINISHED exactly at endsAt (exclusive)', () => {
    expect(contestStatus(end, start, end)).toBe('FINISHED')
  })

  it('is FINISHED after the window', () => {
    expect(contestStatus(new Date('2026-01-10T14:00:01Z'), start, end)).toBe('FINISHED')
  })

  it('isRunning matches', () => {
    expect(isRunning(new Date('2026-01-10T13:00:00Z'), start, end)).toBe(true)
    expect(isRunning(end, start, end)).toBe(false)
  })
})

describe('secondsToTransition', () => {
  it('counts down to the start while upcoming', () => {
    expect(secondsToTransition(new Date('2026-01-10T11:59:00Z'), start, end)).toBe(60)
  })

  it('counts down to the end while running', () => {
    expect(secondsToTransition(new Date('2026-01-10T13:59:30Z'), start, end)).toBe(30)
  })

  it('is 0 once finished', () => {
    expect(secondsToTransition(end, start, end)).toBe(0)
  })
})
