// Loop semantics, held to the real engine.
//
// Both engines are checked against EACH OTHER rather than against hand-written
// expectations, because the failure mode that matters is drift: the learner
// reads a trace from one engine and is graded by the other. Two bugs found this
// way, neither of which any existing test could see (no demo or problem happens
// to use `break` in a loop, or close over a loop variable):
//
//   1. The instrumenter re-parsed the `if` rewrite standalone, so `if (x) break`
//      inside ANY loop failed to instrument at all — on the default engine.
//   2. The legacy interpreter shared one binding across iterations of
//      `for…of` / `for…in`, so closures captured the last value.

import { describe, it, expect } from 'vitest'
import { interpret } from '../interpreter'
import { traceQjs } from '../trace-qjs'

function outputOf(steps: { kind: string; output?: string }[]): string[] {
  return steps.filter((s) => s.kind === 'output' && typeof s.output === 'string').map((s) => s.output as string)
}

function legacy(code: string): string[] {
  const t = interpret(code, { maxSteps: 5000 })
  expect(t.truncated, 'legacy truncated').toBeFalsy()
  return outputOf(t.steps)
}

async function qjs(code: string): Promise<string[]> {
  const { trace, error } = await traceQjs(code)
  expect(error ?? null, 'real engine error').toBeNull()
  return outputOf(trace?.steps ?? [])
}

// [name, code, expected] — expected is spelled out so a case can't silently
// agree on the WRONG answer across both engines.
const CASES: [string, string, string[]][] = [
  // Per-iteration bindings: a closure made in the body must capture that pass.
  ['for-of closure', `const f=[]; for (const x of [1,2,3]) f.push(function(){return x;}); for (const g of f) console.log(g());`, ['1', '2', '3']],
  ['for-in closure', `const f=[]; for (const k in {a:1,b:2}) f.push(function(){return k;}); for (const g of f) console.log(g());`, ['a', 'b']],
  ['classic-for closure', `const f=[]; for (let i=0;i<3;i++) f.push(function(){return i;}); for (const g of f) console.log(g());`, ['0', '1', '2']],
  // `var` deliberately shares one binding — every closure sees the final value.
  // That difference IS the lesson in bug-12, so it must not get "fixed".
  ['var shares one binding', `const f=[]; for (var i=0;i<3;i++) f.push(function(){return i;}); for (const g of f) console.log(g());`, ['3', '3', '3']],

  // break / continue, in every loop form, from inside an `if`.
  ['for-of break', `for (const x of [1,2,3]) { if (x===3) break; console.log(x); }`, ['1', '2']],
  ['for-of continue', `for (const x of [1,2,3]) { if (x===2) continue; console.log(x); }`, ['1', '3']],
  ['for-in break', `for (const k in {a:1,b:2}) { if (k==='b') break; console.log(k); }`, ['a']],
  ['classic-for break', `for (let i=0;i<3;i++) { if (i===2) break; console.log(i); }`, ['0', '1']],
  ['classic-for continue', `for (let i=0;i<3;i++) { if (i===1) continue; console.log(i); }`, ['0', '2']],
  ['while break', `let i=0; while(true){ if(i===2) break; console.log(i); i++; }`, ['0', '1']],
  ['do-while break', `let i=0; do { if(i===2) break; console.log(i); i++; } while(true);`, ['0', '1']],
  ['nested loop break', `for (const x of [1,2]) { for (const y of [3,4]) { if (y===4) break; console.log(x+''+y); } }`, ['13', '23']],
  ['break in a block', `for (const x of [1,2,3]) { if (x===3) { break; } console.log(x); }`, ['1', '2']],
  ['switch break', `const x=2; switch(x){ case 2: console.log('two'); break; default: console.log('no'); }`, ['two']],

  // Body mutation and destructuring still behave.
  ['loop var mutated in body', `for (let x of [1,2,3]) { x = x*10; console.log(x); }`, ['10', '20', '30']],
  ['destructured for-of', `for (const [k,v] of [['a',1],['b',2]]) console.log(k+'='+v);`, ['a=1', 'b=2']],
  ['outer var accumulates', `let s=''; for (const x of [1,2,3]) s = s+x; console.log(s);`, ['123']],
]

describe('loop semantics — legacy interpreter', () => {
  it.each(CASES)('%s', (_name, code, expected) => {
    expect(legacy(code)).toEqual(expected)
  })
})

describe('loop semantics — real engine (QuickJS)', () => {
  it.each(CASES)('%s', async (_name, code, expected) => {
    expect(await qjs(code)).toEqual(expected)
  })
})
