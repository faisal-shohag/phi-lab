import { describe, it, expect } from 'vitest'
import { DEMO_EXAMPLES } from '../examples'
import { interpret } from '../interpreter'
import { traceQjs } from '../trace-qjs'
import type { Trace } from '../types'

// Parity harness: every curriculum demo, run through the new QuickJS trace
// producer, must print the same console output as the legacy interpreter — a
// strong end-to-end correctness check on real programs (not toy snippets).
//
// All 19 demos now reach output parity (event-loop included, via the P4 async
// shim). Kept as a hook for any future known-divergent demo.
const KNOWN_DIVERGENT = new Set<string>([])

function outputsOf(trace: Trace): string[] {
  return trace.steps.filter((s) => s.kind === 'output').map((s) => s.output ?? '')
}

describe('demo parity: traceQjs vs legacy interpreter', () => {
  for (const demo of DEMO_EXAMPLES) {
    const known = KNOWN_DIVERGENT.has(demo.id)
    it(`${demo.id}${known ? ' (known divergent)' : ''}`, async () => {
      const legacyOut = outputsOf(interpret(demo.code, { maxSteps: 8000 }))
      const { trace, error } = await traceQjs(demo.code)

      if (known) {
        // Still must run + produce a partial trace, just not full parity yet.
        expect(trace.steps.length).toBeGreaterThan(0)
        return
      }

      expect(error).toBeUndefined()
      expect(trace.steps.length).toBeGreaterThan(0)
      expect(outputsOf(trace)).toEqual(legacyOut)
    })
  }
})
