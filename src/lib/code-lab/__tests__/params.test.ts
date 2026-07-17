import { describe, it, expect } from 'vitest'
import { paramNames } from '../params'

describe('paramNames', () => {
  it('reads names from a function declaration', () => {
    expect(paramNames('function twoSum(nums, target) {}', 'twoSum')).toEqual(['nums', 'target'])
  })

  it('strips TS type annotations', () => {
    expect(paramNames('function sum(nums: number[]): number { return 0 }', 'sum')).toEqual(['nums'])
  })

  it('handles an arrow assignment', () => {
    expect(paramNames('const rotate = (matrix) => {}', 'rotate')).toEqual(['matrix'])
  })

  it('drops default values', () => {
    expect(paramNames('function f(a, b = 5) {}', 'f')).toEqual(['a', 'b'])
  })

  it('returns [] for no params or no fnName', () => {
    expect(paramNames('function go() {}', 'go')).toEqual([])
    expect(paramNames('function go() {}', null)).toEqual([])
  })
})
