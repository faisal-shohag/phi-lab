// ancestorsOf is what a passed jump-forward gate credits: the transitive
// prerequisites of the node you jumped to. Getting it wrong either over-credits
// (skips real gaps) or under-credits (leaves the node still locked), so pin it.
import { describe, expect, it } from 'vitest'
import { ancestorsOf, nodeById } from './curriculum'

describe('ancestorsOf', () => {
  it('is empty for a root node', () => {
    // conditionals is the first node — nothing before it.
    expect(ancestorsOf('conditionals')).toEqual([])
  })

  it('includes the direct prerequisite', () => {
    // loops requires conditionals.
    expect(ancestorsOf('loops')).toContain('conditionals')
  })

  it('walks the full chain, not just the direct parent', () => {
    // arrays ← loops ← conditionals: both must be credited.
    const anc = ancestorsOf('arrays')
    expect(anc).toContain('loops')
    expect(anc).toContain('conditionals')
  })

  it('never includes the node itself', () => {
    expect(ancestorsOf('closures')).not.toContain('closures')
  })

  it('returns ids in curriculum (prerequisite-safe) order', () => {
    // Every ancestor must appear before any node that requires it, so banking in
    // this order never violates a prerequisite.
    const anc = ancestorsOf('objects-oop')
    const pos = new Map(anc.map((id, i) => [id, i]))
    for (const id of anc) {
      for (const req of nodeById(id)!.requires) {
        if (pos.has(req)) expect(pos.get(req)!).toBeLessThan(pos.get(id)!)
      }
    }
  })
})
