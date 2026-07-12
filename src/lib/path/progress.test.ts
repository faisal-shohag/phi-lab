// The gating engine is the heart of The Path: it decides, from evidence the labs
// recorded, which nodes are locked/available/mastered. It is pure given an
// Evidence object, so these tests pin the rules that matter without a DB — most
// importantly the two that are easy to get subtly wrong: unlock propagation and
// the fungible-challenge-win accounting.
import { describe, expect, it } from 'vitest'
import { evaluate, activeNodeId, type Evidence } from './progress'

function emptyEvidence(over: Partial<Evidence> = {}): Evidence {
  return {
    vizConcepts: new Map(),
    wins: [],
    losses: 0,
    feynman: [],
    english: [],
    interview: [],
    analogies: [],
    mastered: new Map(),
    ...over,
  }
}

const state = (nodes: ReturnType<typeof evaluate>, id: string) => nodes.find((n) => n.nodeId === id)?.state

describe('evaluate — unlocking', () => {
  it('opens only the first node for a brand-new learner', () => {
    const nodes = evaluate(emptyEvidence())
    expect(state(nodes, 'conditionals')).toBe('available')
    expect(state(nodes, 'loops')).toBe('locked')
    expect(activeNodeId(nodes)).toBe('conditionals')
  })

  it('masters a node when its evidence is present, and unlocks the next', () => {
    const nodes = evaluate(
      emptyEvidence({
        vizConcepts: new Map([['conditionals', new Date()]]),
        wins: [{ id: 'w1', difficulty: 'easy', mode: 'retries', createdAt: new Date() }],
      }),
    )
    expect(state(nodes, 'conditionals')).toBe('mastered')
    expect(state(nodes, 'loops')).toBe('available')
  })
})

describe('evaluate — challenge wins are fungible and consumed once', () => {
  it('does not let one win satisfy two different nodes', () => {
    // Both `conditionals` and `loops` want an easy win. With their viz steps done
    // and exactly ONE win banked, only the first-walked node may spend it.
    const nodes = evaluate(
      emptyEvidence({
        vizConcepts: new Map([
          ['conditionals', new Date()],
          ['loops', new Date()],
        ]),
        wins: [{ id: 'w1', difficulty: 'easy', mode: 'retries', createdAt: new Date() }],
      }),
    )
    expect(state(nodes, 'conditionals')).toBe('mastered')
    // loops' viz steps are done but its build step is unpaid → not mastered.
    expect(state(nodes, 'loops')).not.toBe('mastered')
  })

  it('accepts a higher-tier win for a lower-tier requirement', () => {
    // A hard win pays an easy build step (rank >=). Difficulty is a floor.
    const nodes = evaluate(
      emptyEvidence({
        vizConcepts: new Map([['conditionals', new Date()]]),
        wins: [{ id: 'w1', difficulty: 'hard', mode: 'oneshot', createdAt: new Date() }],
      }),
    )
    expect(state(nodes, 'conditionals')).toBe('mastered')
  })
})

describe('evaluate — struggle signal', () => {
  it('flags a node whose scored step fell short twice', () => {
    // `functions` requires a Feynman "scope" teach-back clearing 60. Two runs at
    // 40 should mark it in-progress AND struggling — the signal the weekly
    // re-planner reads.
    const early = { vizConcepts: new Map([['conditionals', new Date()], ['loops', new Date()], ['arrays', new Date()], ['functions', new Date()]]) }
    const wins = [
      { id: 'a', difficulty: 'easy', mode: 'retries', createdAt: new Date() },
      { id: 'b', difficulty: 'easy', mode: 'retries', createdAt: new Date() },
      { id: 'c', difficulty: 'easy', mode: 'retries', createdAt: new Date() },
      { id: 'd', difficulty: 'medium', mode: 'retries', createdAt: new Date() },
    ]
    const nodes = evaluate(
      emptyEvidence({
        ...early,
        wins,
        feynman: [
          { key: 'scope', score: 40, createdAt: new Date() },
          { key: 'scope', score: 41, createdAt: new Date() },
        ],
      }),
    )
    const fn = nodes.find((n) => n.nodeId === 'functions')!
    expect(fn.state).toBe('in-progress')
    expect(fn.struggling).toBe(true)
    const step = fn.steps.find((s) => s.id === 'explain-scope')!
    expect(step.done).toBe(false)
    expect(step.bestScore).toBe(41)
  })

  it('clears the scored step once a run beats the bar', () => {
    const nodes = evaluate(
      emptyEvidence({
        feynman: [{ key: 'scope', score: 72, createdAt: new Date() }],
      }),
    )
    const step = nodes.find((n) => n.nodeId === 'functions')!.steps.find((s) => s.id === 'explain-scope')!
    expect(step.done).toBe(true)
    expect(step.evidence).toContain('72/100')
  })
})

describe('evaluate — banked mastery is sticky', () => {
  it('keeps a node mastered from the PathProgress receipt even without live evidence', () => {
    const nodes = evaluate(emptyEvidence({ mastered: new Map([['conditionals', new Date()]]) }))
    expect(state(nodes, 'conditionals')).toBe('mastered')
    expect(state(nodes, 'loops')).toBe('available')
  })
})
