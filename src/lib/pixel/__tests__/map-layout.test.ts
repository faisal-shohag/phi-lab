import { describe, expect, it } from 'vitest'

import { ALL_CHALLENGES } from '../challenges'
import { mapLayout, travelled } from '../map-layout'

describe('mapLayout', () => {
  const layout = mapLayout()

  it('puts every challenge on the board', () => {
    expect(layout.nodes.map((n) => n.id)).toEqual(ALL_CHALLENGES.map((c) => c.id))
  })

  // The failure this catches is the one hand-drawn coordinates actually produce:
  // two nodes stacked on the same spot, one of them unreachable.
  it('never stacks two nodes on the same spot', () => {
    const spots = layout.nodes.map((n) => `${n.x},${n.y}`)
    expect(new Set(spots).size).toBe(spots.length)
  })

  it('keeps every node inside the board it reports', () => {
    for (const node of layout.nodes) {
      expect(node.x, node.id).toBeGreaterThanOrEqual(0)
      expect(node.x, node.id).toBeLessThanOrEqual(layout.width)
      expect(node.y, node.id).toBeGreaterThanOrEqual(0)
      expect(node.y, node.id).toBeLessThanOrEqual(layout.height)
    }
  })

  it('starts the path on the first node', () => {
    expect(layout.d.startsWith(`M ${layout.nodes[0].x} ${layout.nodes[0].y}`)).toBe(true)
  })

  // A Catmull-Rom spline passes through its points; a plain bézier does not.
  // That is the whole reason for the spline, so assert the road actually reaches
  // each stop rather than curving near it.
  it('ends every segment exactly on a node', () => {
    const ends = [...layout.d.matchAll(/C [^,]+, [^,]+, ([\d.-]+) ([\d.-]+)/g)].map((m) => `${m[1]},${m[2]}`)
    const expected = layout.nodes.slice(1).map((n) => `${n.x},${n.y}`)
    expect(ends).toEqual(expected)
  })

  it('winds back and forth rather than running off the side', () => {
    // Row 0 runs left-to-right, row 1 right-to-left. Without the serpentine the
    // board would be 27 columns wide and unreadable.
    const row0 = layout.nodes.filter((n) => n.y === layout.nodes[0].y)
    const row1 = layout.nodes.filter((n) => n.y === layout.nodes[4]?.y)
    expect(row0.map((n) => n.x)).toEqual([...row0.map((n) => n.x)].sort((a, b) => a - b))
    expect(row1.map((n) => n.x)).toEqual([...row1.map((n) => n.x)].sort((a, b) => b - a))
  })

  it('flags the last challenge of each topic as a milestone', () => {
    const topics = new Set(ALL_CHALLENGES.map((c) => c.topicId))
    expect(layout.nodes.filter((n) => n.milestone)).toHaveLength(topics.size - 1)
  })

  it('flags the first challenge of each topic, so a gate label has somewhere to hang', () => {
    const topics = new Set(ALL_CHALLENGES.map((c) => c.topicId))
    expect(layout.nodes.filter((n) => n.topicStart)).toHaveLength(topics.size)
  })

  it('lays out a catalog nobody has written yet', () => {
    // The point of computing rather than drawing: adding a challenge must not
    // require touching this file.
    const grown = mapLayout([...ALL_CHALLENGES, { ...ALL_CHALLENGES[0], id: 'brand-new' }])
    expect(grown.nodes).toHaveLength(ALL_CHALLENGES.length + 1)
    expect(new Set(grown.nodes.map((n) => `${n.x},${n.y}`)).size).toBe(grown.nodes.length)
    // …and must not move the ones already there.
    expect(grown.nodes.slice(0, ALL_CHALLENGES.length).map((n) => `${n.x},${n.y}`)).toEqual(
      layout.nodes.map((n) => `${n.x},${n.y}`),
    )
  })

  it('handles an empty catalog without producing a broken path', () => {
    expect(mapLayout([]).d).toBe('')
  })

  it('handles a single challenge', () => {
    const one = mapLayout([ALL_CHALLENGES[0]])
    expect(one.nodes).toHaveLength(1)
    expect(one.d).toMatch(/^M [\d.]+ [\d.]+$/)
  })
})

describe('travelled', () => {
  it('is nothing at the start and everything at the end', () => {
    expect(travelled(0, 27)).toBe(0)
    expect(travelled(26, 27)).toBe(1)
  })

  it('does not overshoot past the end of the road', () => {
    expect(travelled(27, 27)).toBe(1)
  })

  it('reports the fraction of the road behind you', () => {
    expect(travelled(13, 27)).toBeCloseTo(0.5, 6)
  })

  it('does not divide by zero on a one-challenge catalog', () => {
    expect(travelled(0, 1)).toBe(0)
    expect(travelled(1, 1)).toBe(1)
  })

  // It takes a position, not a tally. A ledger from before the gate existed has
  // scattered clears, and "6 cleared" says nothing about where on a sequential
  // road you are standing.
  it('is monotonic in position rather than in how many are cleared', () => {
    expect(travelled(3, 27)).toBeLessThan(travelled(4, 27))
  })
})
