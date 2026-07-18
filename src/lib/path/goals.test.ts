import { describe, expect, it } from 'vitest'
import { goalModuleIds, goalNodes, nodeInGoal } from './goals'
import { MODULES } from './curriculum'

describe('goals — module filtering', () => {
  it('FULLSTACK covers every module', () => {
    expect(goalModuleIds('FULLSTACK')).toEqual(MODULES.map((m) => m.id))
  })

  it('FRONTEND drops the backend module but keeps the finish line', () => {
    const ids = goalModuleIds('FRONTEND')
    expect(ids).not.toContain('backend')
    expect(ids).toContain('web')
    expect(ids).toContain('react')
    expect(ids).toContain('job-ready')
  })

  it('nodeInGoal follows the module filter', () => {
    // node-express lives in the backend module.
    expect(nodeInGoal('node-express', 'FULLSTACK')).toBe(true)
    expect(nodeInGoal('node-express', 'FRONTEND')).toBe(false)
    // react-core is on every road.
    expect(nodeInGoal('react-core', 'FRONTEND')).toBe(true)
  })

  it('FRONTEND is a strict subset of FULLSTACK by node count', () => {
    expect(goalNodes('FRONTEND').length).toBeLessThan(goalNodes('FULLSTACK').length)
  })

  it('an unknown goal falls back to the full map', () => {
    // @ts-expect-error deliberately passing an invalid goal
    expect(goalModuleIds('NONSENSE')).toEqual(MODULES.map((m) => m.id))
  })
})
