import { describe, it, expect } from 'vitest'
import { instrument } from '../instrument'
import { traceQjs } from '../trace-qjs'
import type { ValueSnapshot } from '../types'

function primOf(vs: ValueSnapshot): unknown {
  return vs.t === 'prim' ? vs.v : `#${vs.id}`
}
function refId(vs: ValueSnapshot): number | null {
  return vs.t === 'ref' ? vs.id : null
}

describe('instrument', () => {
  it('produces valid JS that references the recorder globals', () => {
    const out = instrument('let x = 1; x = x + 1;')
    expect(out).toContain('__rec(')
    expect(out).toContain('let x = 1')
  })
  it('wraps functions with __enter/__exit', () => {
    const out = instrument('function f(n){ return n*2 } f(3)')
    expect(out).toContain('__enter(')
    expect(out).toContain('__exit()')
  })
})

describe('traceQjs — core pipeline', () => {
  it('records steps for a simple assignment program', async () => {
    const { trace, error } = await traceQjs('let x = 1;\nx = x + 1;\nlet y = x * 10;')
    expect(error).toBeUndefined()
    expect(trace.steps.length).toBeGreaterThanOrEqual(3)

    // Final global frame should reflect x=2, y=20.
    const last = trace.steps[trace.steps.length - 1]
    const globals = Object.fromEntries(last.frames[0].vars.map((v) => [v.name, primOf(v.value)]))
    expect(globals.x).toBe(2)
    expect(globals.y).toBe(20)

    // Kinds are populated.
    expect(trace.steps.some((s) => s.kind === 'declare')).toBe(true)
    expect(trace.steps.some((s) => s.kind === 'assign')).toBe(true)
  })

  it('captures console.log output as steps + output text', async () => {
    const { trace } = await traceQjs('console.log("hi");\nconsole.log(1 + 2);')
    expect(trace.outputCount).toBe(2)
    const outs = trace.steps.filter((s) => s.kind === 'output').map((s) => s.output)
    expect(outs).toEqual(['hi', '3'])
  })

  it('builds a call stack with function frames + depth', async () => {
    const src = 'function dbl(n){ return n * 2 }\nlet r = dbl(21);'
    const { trace } = await traceQjs(src)
    // Some step must be inside dbl (depth 1, frame named dbl with param n=21).
    const inside = trace.steps.find((s) => s.depth === 1 && s.frames[1]?.name === 'dbl')
    expect(inside).toBeDefined()
    const n = inside!.frames[1].vars.find((v) => v.name === 'n')
    expect(primOf(n!.value)).toBe(21)
  })

  it('represents arrays on the heap with aliasing (shared id)', async () => {
    const src = 'let a = [1, 2, 3];\nlet b = a;\nb.push(4);'
    const { trace } = await traceQjs(src)
    const last = trace.steps[trace.steps.length - 1]
    const g = Object.fromEntries(last.frames[0].vars.map((v) => [v.name, v.value]))
    // a and b are refs to the SAME heap id.
    const aId = refId(g.a)
    const bId = refId(g.b)
    expect(aId).not.toBeNull()
    expect(aId).toBe(bId)
    const arr = last.heap.find((h) => h.id === aId)
    expect(arr?.kind).toBe('array')
    expect(arr?.cells?.map((c) => primOf(c))).toEqual([1, 2, 3, 4])
  })

  it('runs full-JS the legacy interpreter cannot (regex) and traces it', async () => {
    const { trace, error } = await traceQjs('let m = "a1b22".match(/\\d+/g);\nconsole.log(m.length);')
    expect(error).toBeUndefined()
    expect(trace.steps.some((s) => s.output === '2')).toBe(true)
  })

  it('loops produce per-iteration steps', async () => {
    const src = 'let s = 0;\nfor (let i = 0; i < 3; i++) {\n  s = s + i;\n}'
    const { trace } = await traceQjs(src)
    // The body assignment `s = s + i` should be stepped 3 times.
    const bodyAssigns = trace.steps.filter((s) => s.kind === 'assign' && s.description.includes('s = s + i'))
    expect(bodyAssigns.length).toBe(3)
  })

  it('emits an enter step with arg→param bindings + fnLoc', async () => {
    const src = 'function add(a, b){ return a + b }\nadd(2, 5);'
    const { trace } = await traceQjs(src)
    const enter = trace.steps.find((s) => s.kind === 'enter')
    expect(enter).toBeDefined()
    expect(enter!.fnLoc?.line).toBe(1)
    const binds = Object.fromEntries((enter!.bindings ?? []).map((b) => [b.name, b.value]))
    expect(binds).toEqual({ a: '2', b: '5' })
  })

  it('carries the returned value on the return step', async () => {
    const { trace } = await traceQjs('function sq(n){ return n * n }\nsq(6);')
    const ret = trace.steps.find((s) => s.kind === 'return')
    expect(ret).toBeDefined()
    expect(ret!.result).toBe(36)
  })

  it('records conditionResult on if statements', async () => {
    const src = 'let x = 5;\nif (x > 3) {\n  x = 100;\n} else {\n  x = 0;\n}'
    const { trace } = await traceQjs(src)
    const cond = trace.steps.find((s) => s.kind === 'condition')
    expect(cond).toBeDefined()
    expect(cond!.conditionResult).toBe(true)
    // the true branch ran
    const last = trace.steps[trace.steps.length - 1]
    expect(last.frames[0].vars.find((v) => v.name === 'x')!.value).toEqual({ t: 'prim', v: 100 })
  })

  it('attaches focus (varName + heapId) to assignments', async () => {
    const src = 'let arr = [1, 2];\narr.push(3);'
    const { trace } = await traceQjs(src)
    const focused = trace.steps.find((s) => s.focus?.varName === 'arr' && s.focus?.heapId != null)
    expect(focused).toBeDefined()
    const arr = focused!.heap.find((h) => h.id === focused!.focus!.heapId)
    expect(arr?.kind).toBe('array')
  })

  it('emits loop-start / loop-iter (with iteration index) / loop-end', async () => {
    const src = 'let s = 0;\nfor (let i = 0; i < 3; i++) {\n  s = s + i;\n}'
    const { trace } = await traceQjs(src)
    expect(trace.steps.filter((s) => s.kind === 'loop-start').length).toBe(1)
    const iters = trace.steps.filter((s) => s.kind === 'loop-iter')
    expect(iters.map((s) => s.iteration)).toEqual([0, 1, 2])
    expect(trace.steps.filter((s) => s.kind === 'loop-end').length).toBe(1)
    // loop var visible inside an iteration step
    const i1 = iters[1].frames[0].vars.find((v) => v.name === 'i')
    expect(primOf(i1!.value)).toBe(1)
  })

  it('resolves closure captures on returned functions', async () => {
    const src = 'function makeAdder(x){\n  return function (y){ return x + y };\n}\nlet add5 = makeAdder(5);\nlet r = add5(3);'
    const { trace } = await traceQjs(src)
    // Some heap function entry should report capturing x = 5.
    const withCap = trace.steps
      .flatMap((s) => s.heap)
      .find((h) => h.kind === 'function' && h.captures?.some((c) => c.name === 'x'))
    expect(withCap).toBeDefined()
    const cap = withCap!.captures!.find((c) => c.name === 'x')
    expect(cap!.value).toBe('5')
    // And the program still computes correctly (8).
    expect(trace.steps.some((s) => s.result === 8)).toBe(true)
  })

  it('does not report globals/builtins as captures', async () => {
    const src = 'let base = 10;\nfunction f(n){ return Math.abs(n) + base }\nf(-3);'
    const { trace } = await traceQjs(src)
    // f references Math (global) and base (global) — neither is an enclosing
    // function scope, so f has no captures.
    const fEntry = trace.steps
      .flatMap((s) => s.heap)
      .find((h) => h.kind === 'function' && h.label === 'f')
    expect(fEntry).toBeDefined()
    expect(fEntry!.captures).toBeUndefined()
  })

  it('models the event loop: sync → microtask → macrotask ordering', async () => {
    const src =
      'console.log("1: sync start");\n' +
      'setTimeout(function timer(){ console.log("4: macro"); }, 0);\n' +
      'Promise.resolve().then(function micro(){ console.log("3: micro"); });\n' +
      'console.log("2: sync end");'
    const { trace, error } = await traceQjs(src)
    expect(error).toBeUndefined()
    expect(trace.hasAsync).toBe(true)
    // Output order proves sync → microtask → macrotask.
    expect(trace.steps.filter((s) => s.kind === 'output').map((s) => s.output)).toEqual([
      '1: sync start', '2: sync end', '3: micro', '4: macro',
    ])
    // Event-loop transitions are recorded.
    expect(trace.steps.some((s) => s.kind === 'schedule')).toBe(true)
    expect(trace.steps.some((s) => s.kind === 'dequeue')).toBe(true)
    // Async snapshot is attached, and a microtask phase occurs.
    expect(trace.steps.some((s) => s.async?.phase === 'microtask')).toBe(true)
    const scheduled = trace.steps.find((s) => s.async && s.async.webApis.length > 0)
    expect(scheduled).toBeDefined()
  })

  it('builds a substitution exprTrail for a condition', async () => {
    const src = 'let nums = [14, 92, 7];\nlet max = nums[0];\nif (nums[1] > max) {\n  max = nums[1];\n}'
    const { trace } = await traceQjs(src)
    const cond = trace.steps.find((s) => s.kind === 'condition' && s.exprTrail)
    expect(cond).toBeDefined()
    // original → substituted-operands → final
    expect(cond!.exprTrail![0]).toBe('nums[1] > max')
    expect(cond!.exprTrail).toContain('92 > 14')
    expect(cond!.exprTrail![cond!.exprTrail!.length - 1]).toBe('true')
  })

  it('builds an exprTrail for a return value', async () => {
    const src = 'function f(a, b){ return a * b + 1 }\nf(6, 7);'
    const { trace } = await traceQjs(src)
    const ret = trace.steps.find((s) => s.kind === 'return' && s.exprTrail)
    expect(ret).toBeDefined()
    // Outermost non-overlapping sub-expression (a * b) is substituted as one, so
    // the operand stage is '42 + 1' — matching the legacy interpreter's trail.
    expect(ret!.exprTrail![0]).toBe('a * b + 1')
    expect(ret!.exprTrail).toContain('42 + 1')
    expect(ret!.exprTrail![ret!.exprTrail!.length - 1]).toBe('43')
  })

  it('builds an exprTrail for a declaration initializer', async () => {
    const src = 'let a = 6;\nlet b = 7;\nlet c = a * b;'
    const { trace } = await traceQjs(src)
    const d = trace.steps.find((s) => s.kind === 'declare' && s.description.includes('c = a * b') && s.exprTrail)
    expect(d).toBeDefined()
    expect(d!.exprTrail![0]).toBe('a * b')
    expect(d!.exprTrail).toContain('6 * 7')
    expect(d!.exprTrail![d!.exprTrail!.length - 1]).toBe('42')
  })

  it('builds an exprTrail for a reassignment RHS', async () => {
    const src = 'let a = 6;\nlet b = 7;\nlet c = 0;\nc = a * b;'
    const { trace } = await traceQjs(src)
    const asg = trace.steps.find((s) => s.kind === 'assign' && s.exprTrail)
    expect(asg).toBeDefined()
    expect(asg!.exprTrail![0]).toBe('a * b')
    expect(asg!.exprTrail![asg!.exprTrail!.length - 1]).toBe('42')
  })

  it('computes indexVars and focus.arrayIndex/indexVarName for array writes', async () => {
    const src = 'let nums = [0, 0, 0];\nfor (let i = 0; i < 3; i++) {\n  nums[i] = i * 2;\n}'
    const { trace } = await traceQjs(src)
    // Static index-var map for the array pointer markers.
    expect(trace.indexVars.nums).toContain('i')
    // A write step focuses nums with the concrete index.
    const write = trace.steps.find(
      (s) => s.focus?.varName === 'nums' && s.focus?.indexVarName === 'i' && s.focus?.arrayIndex === 2,
    )
    expect(write).toBeDefined()
  })

  it('summarizes the compile phase (hoisting + TDZ)', async () => {
    const src = 'function f(){ return 1 }\nvar a = 2;\nlet b = 3;\nconst c = 4;'
    const { trace } = await traceQjs(src)
    expect(trace.hoisting?.funcs).toEqual(['f'])
    expect(trace.hoisting?.vars).toEqual(['a'])
    expect(trace.hoisting?.tdz.map((t) => t.name)).toEqual(['b', 'c'])
  })

  it('surfaces static warnings (infinite loop, = in condition)', async () => {
    const inf = await traceQjs('let n = 0;\nif (n = 1) { n = 2; }')
    expect(inf.trace.warnings?.some((w) => w.includes('assignment inside a condition'))).toBe(true)
  })

  it('degrades gracefully on an infinite loop (budget, not a crash)', async () => {
    const { trace } = await traceQjs('let i = 0;\nwhile (true) { i = i + 1; }')
    expect(trace.truncated).toBe(true)
    expect(trace.steps.length).toBeGreaterThan(100)
  })
})
