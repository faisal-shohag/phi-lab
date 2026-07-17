import { describe, it, expect } from 'vitest'
import { stableSerialize, STABLE_SERIALIZE_SRC, normalizeStdout } from '../serialize'

// Build the guest implementation in this same JS engine so we can assert it
// agrees byte-for-byte with the TS one. This is the pin that stops the two
// copies (TS here, source string injected into QuickJS) from drifting.
const guest = new Function(`${STABLE_SERIALIZE_SRC}\nreturn __stableSerialize;`)() as (v: unknown) => string

const CASES: unknown[] = [
  undefined,
  null,
  NaN,
  Infinity,
  -Infinity,
  -0,
  0,
  42,
  -7,
  3.14,
  'hello',
  '',
  'quote"inside',
  true,
  false,
  [1, 2, 3],
  [],
  [NaN, -0, undefined],
  { b: 1, a: 2 },
  { a: { z: 1, y: 2 }, b: [3, 2, 1] },
  { nested: { deep: [{ k: 'v' }] } },
  [{ b: 2, a: 1 }, { d: 4, c: 3 }],
]

describe('stableSerialize', () => {
  it('TS and guest implementations agree on every case', () => {
    for (const c of CASES) {
      expect(guest(c)).toBe(stableSerialize(c))
    }
  })

  it('sorts object keys so equal objects compare equal', () => {
    expect(stableSerialize({ a: 1, b: 2 })).toBe(stableSerialize({ b: 2, a: 1 }))
  })

  it('distinguishes -0 from 0', () => {
    expect(stableSerialize(-0)).toBe('-0')
    expect(stableSerialize(0)).toBe('0')
    expect(stableSerialize(-0)).not.toBe(stableSerialize(0))
  })

  it('tags NaN and Infinities', () => {
    expect(stableSerialize(NaN)).toBe('NaN')
    expect(stableSerialize(Infinity)).toBe('Infinity')
    expect(stableSerialize(-Infinity)).toBe('-Infinity')
  })

  it('preserves array order (order matters)', () => {
    expect(stableSerialize([1, 2])).not.toBe(stableSerialize([2, 1]))
  })
})

describe('normalizeStdout', () => {
  it('drops trailing newline and trailing spaces per line', () => {
    expect(normalizeStdout('42\n')).toBe('42')
    expect(normalizeStdout('a  \nb\t\n')).toBe('a\nb')
  })
  it('keeps interior blank lines and order', () => {
    expect(normalizeStdout('1\n\n2')).toBe('1\n\n2')
    expect(normalizeStdout('1\n2')).not.toBe(normalizeStdout('2\n1'))
  })
})
