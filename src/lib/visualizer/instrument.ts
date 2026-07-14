// Instruments user JS so a real engine (QuickJS) runs it while emitting a Step
// trace. We parse with acorn (already a dep; ESTree), inject calls to the
// in-guest recorder (`__enter`/`__exit`/`__rec`) around statements and function
// bodies, then re-generate source with astring. The recorder (recorder-prelude)
// builds the trace inside the sandbox.
//
// Scope handling: at each injection point we emit a thunk `() => ({a, b, ...})`
// listing the locals VISIBLE and already-declared there, so referencing them is
// TDZ-safe. Function scopes start fresh (params only) so a frame shows its own
// locals, not the caller's — matching how the legacy interpreter snapshots the
// call stack.
//
// P2 slice: statement-level stepping + function frames. Not yet closure-capture
// vars, exprTrail (P3), or async ordering (P4).

import { parse } from 'acorn'
import { generate } from 'astring'
import type { HoistingInfo } from './types'
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Node = any

const MAX_DESC = 80

function lineOf(node: Node): number {
  return node.loc?.start?.line ?? 0
}

function descOf(src: string, node: Node): string {
  const raw = src.slice(node.start, node.end).replace(/\s+/g, ' ').trim()
  return raw.length > MAX_DESC ? raw.slice(0, MAX_DESC - 1) + '…' : raw
}

// Collect the identifier names bound by a declaration/param pattern.
function collectNames(node: Node, out: string[]): void {
  if (!node) return
  switch (node.type) {
    case 'Identifier': out.push(node.name); break
    case 'AssignmentPattern': collectNames(node.left, out); break
    case 'RestElement': collectNames(node.argument, out); break
    case 'ArrayPattern': for (const el of node.elements) collectNames(el, out); break
    case 'ObjectPattern':
      for (const p of node.properties) {
        if (p.type === 'RestElement') collectNames(p.argument, out)
        else collectNames(p.value, out)
      }
      break
  }
}

function declaredNames(stmt: Node): string[] {
  const out: string[] = []
  if (stmt.type === 'VariableDeclaration') {
    for (const d of stmt.declarations) collectNames(d.id, out)
  } else if (stmt.type === 'FunctionDeclaration' || stmt.type === 'ClassDeclaration') {
    if (stmt.id) out.push(stmt.id.name)
  }
  return out
}

// Parse a snippet into a single statement/expression node we can splice in.
// `allowReturnOutsideFunction` lets us build `return`-carrying wrapper blocks
// (they end up inside a function body after splicing).
function stmtFromCode(code: string): Node {
  return (parse(code, { ecmaVersion: 2023, allowReturnOutsideFunction: true }) as Node).body[0]
}

// A `() => ({a: a, b: b})` thunk over the given visible names.
function thunkSrc(names: string[]): string {
  if (!names.length) return 'function(){return {}}'
  const body = names.map((n) => JSON.stringify(n) + ':' + n).join(',')
  return 'function(){return {' + body + '}}'
}

function recStmt(line: number, kind: string, desc: string, names: string[], extraSrc?: string): Node {
  const extra = extraSrc ? ',' + extraSrc : ''
  return stmtFromCode(`__rec(${line},${JSON.stringify(kind)},${JSON.stringify(desc)},${thunkSrc(names)}${extra});`)
}

// What a statement draws the eye to: the variable name, plus the index variable
// when it writes/reads an array cell like nums[i] (for focus.arrayIndex markers).
interface Focus { name: string; indexName?: string }
function focusTarget(stmt: Node): Focus | null {
  const fromTarget = (target: Node): Focus | null => {
    if (!target) return null
    if (target.type === 'Identifier') return { name: target.name }
    if (target.type === 'MemberExpression' && target.object.type === 'Identifier') {
      const f: Focus = { name: target.object.name }
      if (target.computed && target.property.type === 'Identifier') f.indexName = target.property.name
      return f
    }
    return null
  }
  if (stmt.type === 'VariableDeclaration') {
    const names: string[] = []
    if (stmt.declarations[0]) collectNames(stmt.declarations[0].id, names)
    return names[0] ? { name: names[0] } : null
  }
  if (stmt.type === 'ExpressionStatement') {
    const e = stmt.expression
    if (e.type === 'AssignmentExpression') return fromTarget(e.left)
    if (e.type === 'UpdateExpression') return fromTarget(e.argument)
  }
  return null
}

// Compose a __rec `extra` object literal from a focus + optional extra fields.
function buildExtra(focus: Focus | null, more?: string): string | undefined {
  const parts: string[] = []
  if (focus) {
    parts.push(`focusName:${JSON.stringify(focus.name)}`)
    if (focus.indexName) parts.push(`focusIndexName:${JSON.stringify(focus.indexName)}`)
  }
  if (more) parts.push(more)
  return parts.length ? `{${parts.join(',')}}` : undefined
}

// Static pass: which variables are used to index into each array (arr[i], arr[j])
// → drives the array view's pointer markers (Trace.indexVars).
export function computeIndexVars(source: string): Record<string, string[]> {
  const out: Record<string, string[]> = {}
  const add = (arr: string, idx: string) => {
    if (!out[arr]) out[arr] = []
    if (!out[arr].includes(idx)) out[arr].push(idx)
  }
  const walk = (node: Node): void => {
    if (!node || typeof node !== 'object') return
    if (Array.isArray(node)) { for (const c of node) walk(c); return }
    if (typeof node.type !== 'string') return
    if (node.type === 'MemberExpression' && node.computed && node.object.type === 'Identifier' && node.property.type === 'Identifier') {
      add(node.object.name, node.property.name)
    }
    for (const k of Object.keys(node)) {
      if (k === 'loc' || k === 'start' || k === 'end') continue
      walk(node[k])
    }
  }
  try { walk(parse(source, { ecmaVersion: 2023 }) as Node) } catch { /* parse error — no markers */ }
  return out
}

// Static compile-phase summary for the global scope: hoisted functions + vars,
// and let/const bindings that sit in the TDZ until they execute. Mirrors the
// legacy interpreter's computeHoisting.
export function computeHoisting(source: string): HoistingInfo | undefined {
  let ast: Node
  try { ast = parse(source, { ecmaVersion: 2023, locations: true }) as Node } catch { return undefined }
  const funcs: string[] = []
  const vars: string[] = []
  const tdz: { name: string; line: number; kind: 'let' | 'const' }[] = []
  for (const stmt of ast.body ?? []) {
    if (stmt.type === 'FunctionDeclaration' && stmt.id) {
      funcs.push(stmt.id.name)
    } else if (stmt.type === 'VariableDeclaration') {
      for (const d of stmt.declarations) {
        if (d.id.type !== 'Identifier') continue
        if (stmt.kind === 'var') vars.push(d.id.name)
        else tdz.push({ name: d.id.name, line: d.loc?.start.line ?? 1, kind: stmt.kind })
      }
    }
  }
  if (!funcs.length && !vars.length && !tdz.length) return undefined
  return { funcs, vars, tdz }
}

// Cheap, conservative static hints (non-blocking). Mirrors the legacy
// computeWarnings: infinite loops with no exit, and `if (x = y)` typos.
export function computeWarnings(source: string): string[] {
  let ast: Node
  try { ast = parse(source, { ecmaVersion: 2023 }) as Node } catch { return [] }
  const warnings: string[] = []
  const seen = new Set<string>()
  const add = (msg: string) => { if (!seen.has(msg)) { seen.add(msg); warnings.push(msg) } }

  // A break/return/throw that could exit the current loop (stops at nested loops
  // and function bounds).
  const hasLoopExit = (node: Node): boolean => {
    if (!node || typeof node !== 'object') return false
    if (Array.isArray(node)) return node.some(hasLoopExit)
    if (typeof node.type !== 'string') return false
    if (node.type === 'BreakStatement' || node.type === 'ReturnStatement' || node.type === 'ThrowStatement') return true
    if (
      node.type === 'FunctionDeclaration' || node.type === 'FunctionExpression' || node.type === 'ArrowFunctionExpression' ||
      node.type === 'ForStatement' || node.type === 'WhileStatement' || node.type === 'DoWhileStatement' ||
      node.type === 'ForOfStatement' || node.type === 'ForInStatement'
    ) return false
    for (const k of Object.keys(node)) {
      if (k === 'loc' || k === 'start' || k === 'end' || k === 'type') continue
      if (hasLoopExit(node[k])) return true
    }
    return false
  }
  const isTruthyLiteral = (t: Node): boolean =>
    (t?.type === 'Literal' && !!t.value) || (t?.type === 'Identifier' && t.name === 'true')

  const walk = (node: Node): void => {
    if (!node || typeof node !== 'object') return
    if (Array.isArray(node)) { node.forEach(walk); return }
    if (typeof node.type !== 'string') return
    if ((node.type === 'WhileStatement' && isTruthyLiteral(node.test)) || (node.type === 'ForStatement' && !node.test)) {
      if (!hasLoopExit(node.body)) add('Infinite loop: this loop has no exit condition and no break/return. Add a stopping condition or a break.')
    }
    if (node.type === 'IfStatement' && node.test?.type === 'AssignmentExpression' && node.test.operator === '=') {
      add('Possible mistake: "=" is assignment inside a condition. Did you mean "===" for comparison?')
    }
    for (const k of Object.keys(node)) {
      if (k === 'loc' || k === 'start' || k === 'end' || k === 'type') continue
      walk(node[k])
    }
  }
  walk(ast)
  return warnings
}

// Map a steppable statement to a StepKind + where the snapshot goes:
//  'after'  — effect-bearing leaf (declare/assign/call/expr): snapshot the state
//             the line produced, so the last statement's result is captured.
//  'before' — control headers + exits (condition/loop/return/break/throw): the
//             snapshot must precede the transfer of control.
function stepInfo(stmt: Node): { kind: string; where: 'before' | 'after' } | null {
  switch (stmt.type) {
    case 'VariableDeclaration': return { kind: 'declare', where: 'after' }
    case 'ExpressionStatement': {
      const e = stmt.expression
      if (e.type === 'AssignmentExpression' || e.type === 'UpdateExpression') return { kind: 'assign', where: 'after' }
      if (e.type === 'CallExpression') return { kind: 'call', where: 'after' }
      return { kind: 'expr', where: 'after' }
    }
    case 'IfStatement': return { kind: 'condition', where: 'before' }
    case 'SwitchStatement': return { kind: 'condition', where: 'before' }
    case 'ForStatement':
    case 'ForInStatement':
    case 'ForOfStatement':
    case 'WhileStatement':
    case 'DoWhileStatement': return { kind: 'loop-start', where: 'before' }
    case 'ReturnStatement': return { kind: 'return', where: 'before' }
    case 'BreakStatement':
    case 'ContinueStatement':
    case 'ThrowStatement': return { kind: 'expr', where: 'before' }
    default: return null // blocks, function/class decls, try — recurse, don't step
  }
}

// ---- expression-trail wrapping ---------------------------------------------
// Wrap primitive-valued sub-expressions of a "headline" expression in
// __t(start, end, value) so the recorder can capture a substitution trail.
const WRAPPABLE = new Set([
  'Identifier', 'MemberExpression', 'BinaryExpression', 'LogicalExpression',
  'UnaryExpression', 'CallExpression', 'ConditionalExpression', 'UpdateExpression',
])

function callT(node: Node): Node {
  const c = stmtFromCode(`__t(${node.start},${node.end},0)`).expression
  c.arguments[2] = node
  return c
}

function wrapNode(node: Node): Node {
  if (!node || typeof node.type !== 'string') return node
  wrapChildren(node)
  if (WRAPPABLE.has(node.type) && typeof node.start === 'number' && typeof node.end === 'number') return callT(node)
  return node
}

// Replace wrappable descendants in value positions, skipping lvalues (assignment
// targets, update args), call callees (preserve `this`), and nested functions.
function wrapChildren(node: Node): void {
  switch (node.type) {
    case 'FunctionExpression':
    case 'ArrowFunctionExpression':
    case 'FunctionDeclaration':
      return
    case 'MemberExpression':
      node.object = wrapNode(node.object)
      if (node.computed) node.property = wrapNode(node.property)
      return
    case 'CallExpression':
    case 'NewExpression':
      node.arguments = node.arguments.map((a: Node) => (a && a.type === 'SpreadElement' ? a : wrapNode(a)))
      return
    case 'AssignmentExpression':
      node.right = wrapNode(node.right)
      return
    case 'UpdateExpression':
      return
    case 'Property':
      node.value = wrapNode(node.value)
      return
  }
  for (const k of Object.keys(node)) {
    if (k === 'loc' || k === 'start' || k === 'end') continue
    const c = node[k]
    if (Array.isArray(c)) {
      for (let i = 0; i < c.length; i++) if (c[i] && typeof c[i].type === 'string') c[i] = wrapNode(c[i])
    } else if (c && typeof c.type === 'string') {
      node[k] = wrapNode(c)
    }
  }
}

function isLoop(stmt: Node): boolean {
  return (
    stmt.type === 'ForStatement' ||
    stmt.type === 'ForInStatement' ||
    stmt.type === 'ForOfStatement' ||
    stmt.type === 'WhileStatement' ||
    stmt.type === 'DoWhileStatement'
  )
}

// Names referenced in value positions within a subtree (over-approximate: also
// picks up declaration ids, which callers filter out). Skips non-computed member
// `.property` and object-literal keys, which are not variable references.
function referencedNames(node: Node, out: Set<string>): void {
  if (!node || typeof node !== 'object') return
  if (Array.isArray(node)) { for (const c of node) referencedNames(c, out); return }
  if (typeof node.type !== 'string') return
  if (node.type === 'Identifier') { out.add(node.name); return }
  if (node.type === 'MemberExpression') {
    referencedNames(node.object, out)
    if (node.computed) referencedNames(node.property, out)
    return
  }
  if (node.type === 'Property' && !node.computed) { referencedNames(node.value, out); return }
  for (const k of Object.keys(node)) {
    if (k === 'loc' || k === 'start' || k === 'end') continue
    referencedNames(node[k], out)
  }
}

// Names DECLARED in a function's own scope (params + var/let/const/function/
// class/catch), NOT descending into nested function bodies (their own scope).
function collectScopeDecls(node: Node, out: Set<string>): void {
  if (!node || typeof node !== 'object') return
  if (Array.isArray(node)) { for (const c of node) collectScopeDecls(c, out); return }
  if (typeof node.type !== 'string') return
  switch (node.type) {
    case 'FunctionDeclaration': if (node.id) out.add(node.id.name); return // don't recurse into body
    case 'FunctionExpression':
    case 'ArrowFunctionExpression': return // nested scope
    case 'ClassDeclaration': if (node.id) out.add(node.id.name); return
    case 'VariableDeclaration': {
      const names: string[] = []
      for (const d of node.declarations) { collectNames(d.id, names); if (d.init) collectScopeDecls(d.init, out) }
      for (const n of names) out.add(n)
      return
    }
    case 'CatchClause': {
      if (node.param) { const names: string[] = []; collectNames(node.param, names); for (const n of names) out.add(n) }
      collectScopeDecls(node.body, out)
      return
    }
  }
  for (const k of Object.keys(node)) {
    if (k === 'loc' || k === 'start' || k === 'end') continue
    collectScopeDecls(node[k], out)
  }
}

// A function's captured free variables = names it references that are declared
// in an ENCLOSING function scope (not its own, not globals). Intersecting with
// `enclosing` also guarantees every captured name is lexically in scope at the
// definition site, so the emitted __cap thunk can never throw.
function captureNames(fn: Node, enclosing: Set<string>): string[] {
  const refs = new Set<string>()
  referencedNames(fn.body, refs)
  const own = new Set<string>()
  for (const p of fn.params) { const names: string[] = []; collectNames(p, names); for (const n of names) own.add(n) }
  collectScopeDecls(fn.body, own)
  const self = fn.id?.name
  const caps: string[] = []
  for (const n of refs) if (enclosing.has(n) && !own.has(n) && n !== self && !caps.includes(n)) caps.push(n)
  return caps
}

// `__tag(<fn>, function(){return {a:a}})` wrapping a function node with its
// capture thunk, so the recorder can read the closed-over values.
function tagNode(fnNode: Node, capNames: string[]): Node {
  const call = stmtFromCode(`__tag(0,${thunkSrc(capNames)});`).expression
  call.arguments[0] = fnNode
  return call
}

interface Ctx { src: string; enclosing: Set<string> }

// Ensure a statement position holds a BlockStatement so we can instrument its
// body (turns `if (x) y();` into `if (x) { y(); }`).
function asBlock(node: Node): Node {
  if (!node) return node
  if (node.type === 'BlockStatement') return node
  return { type: 'BlockStatement', body: [node], start: node.start, end: node.end, loc: node.loc }
}

// Recurse into a statement's nested bodies (control flow / functions).
// `visible` = names in scope at this statement, so nested blocks in the SAME
// frame (if/for/while bodies) keep showing the enclosing locals. Function
// bodies deliberately reset to their own params (a new call-stack frame).
function transformStatement(stmt: Node, ctx: Ctx, visible: string[]): void {
  switch (stmt.type) {
    case 'IfStatement':
      stmt.consequent = asBlock(stmt.consequent)
      transformBlock(stmt.consequent, ctx, visible)
      if (stmt.alternate) {
        if (stmt.alternate.type === 'IfStatement') transformStatement(stmt.alternate, ctx, visible)
        else { stmt.alternate = asBlock(stmt.alternate); transformBlock(stmt.alternate, ctx, visible) }
      }
      break
    case 'ForStatement':
    case 'ForInStatement':
    case 'ForOfStatement':
    case 'WhileStatement':
    case 'DoWhileStatement': {
      // Loop-header bindings (e.g. `for (let i…)`, `for (const x of …)`) are in
      // scope inside the body.
      const bodyScope = [...visible]
      if (stmt.type === 'ForStatement' && stmt.init?.type === 'VariableDeclaration') {
        for (const d of stmt.init.declarations) collectNames(d.id, bodyScope)
      } else if ((stmt.type === 'ForInStatement' || stmt.type === 'ForOfStatement') && stmt.left?.type === 'VariableDeclaration') {
        for (const d of stmt.left.declarations) collectNames(d.id, bodyScope)
      }
      stmt.body = asBlock(stmt.body)
      transformBlock(stmt.body, ctx, bodyScope)
      break
    }
    case 'BlockStatement':
      transformBlock(stmt, ctx, visible)
      break
    case 'TryStatement':
      transformBlock(stmt.block, ctx, visible)
      if (stmt.handler) {
        const hs = [...visible]
        if (stmt.handler.param) collectNames(stmt.handler.param, hs)
        transformBlock(stmt.handler.body, ctx, hs)
      }
      if (stmt.finalizer) transformBlock(stmt.finalizer, ctx, visible)
      break
    case 'FunctionDeclaration':
      transformFunction(stmt, ctx)
      break
    case 'ClassDeclaration':
      for (const m of stmt.body.body) if (m.value && m.value.type.includes('Function')) transformFunction(m.value, ctx)
      break
    default:
      // Also descend into function expressions / arrows nested in this stmt.
      transformNestedFunctions(stmt, ctx)
  }
}

// Wrap a function body with __enter/try-finally __exit and instrument it as a
// fresh scope (params visible).
function transformFunction(fn: Node, ctx: Ctx): void {
  const name = fn.id?.name || (fn.type === 'ArrowFunctionExpression' ? 'arrow' : 'fn')
  const params: string[] = []
  for (const p of fn.params) collectNames(p, params)

  // Captures resolved against the CURRENT enclosing scope (before we add this
  // function's own names). Stored for the caller to tag the definition site.
  fn.__caps = captureNames(fn, ctx.enclosing)

  // Arrow with expression body → give it a block that returns the expression.
  if (fn.type === 'ArrowFunctionExpression' && fn.body.type !== 'BlockStatement') {
    const expr = fn.body
    fn.body = {
      type: 'BlockStatement',
      body: [{ type: 'ReturnStatement', argument: expr, start: expr.start, end: expr.end, loc: expr.loc }],
      start: expr.start, end: expr.end, loc: expr.loc,
    }
  }

  // Descend with this function's own names added to the enclosing scope so
  // nested closures can capture them.
  const savedEnclosing = ctx.enclosing
  const own = new Set(savedEnclosing)
  for (const p of params) own.add(p)
  collectScopeDecls(fn.body, own)
  ctx.enclosing = own
  transformBlock(fn.body, ctx, params)
  ctx.enclosing = savedEnclosing

  const fnLine = lineOf(fn)
  const fnEnd = fn.loc?.end?.line ?? fnLine
  const enter = stmtFromCode(`__enter(${JSON.stringify(name)},null,${fnLine},${fnEnd},${thunkSrc(params)}());`)
  const inner = fn.body.body
  const tryStmt = stmtFromCode(`try{}finally{__exit();}`)
  tryStmt.block.body = inner
  fn.body.body = [enter, tryStmt]
}

// Find function expressions / arrows nested inside an arbitrary statement/expr
// and transform them (e.g. array.map(x => ...)).
function transformNestedFunctions(node: Node, ctx: Ctx): void {
  if (!node || typeof node !== 'object') return
  for (const key of Object.keys(node)) {
    if (key === 'loc' || key === 'start' || key === 'end') continue
    const child = node[key]
    if (Array.isArray(child)) {
      for (let i = 0; i < child.length; i++) {
        const c = child[i]
        if (c && typeof c.type === 'string') {
          if (c.type === 'FunctionExpression' || c.type === 'ArrowFunctionExpression') {
            transformFunction(c, ctx)
            if (c.__caps?.length) child[i] = tagNode(c, c.__caps)
          } else transformNestedFunctions(c, ctx)
        }
      }
    } else if (child && typeof child.type === 'string') {
      if (child.type === 'FunctionExpression' || child.type === 'ArrowFunctionExpression') {
        transformFunction(child, ctx)
        if (child.__caps?.length) node[key] = tagNode(child, child.__caps)
      } else transformNestedFunctions(child, ctx)
    }
  }
}

// Instrument a block's statement list in-place: inject a __rec before each
// steppable statement, tracking the names visible so far.
function transformBlock(block: Node, ctx: Ctx, seedNames: string[]): void {
  const visible: string[] = [...seedNames]
  // Hoist function-declaration names so calls before the definition still show.
  for (const s of block.body) if (s.type === 'FunctionDeclaration' && s.id) visible.push(s.id.name)

  const out: Node[] = []
  for (const stmt of block.body) {
    transformStatement(stmt, ctx, [...new Set(visible)])
    const line = lineOf(stmt)
    const desc = descOf(ctx.src, stmt)
    const names = [...new Set(visible)]

    // return <arg>: capture the returned value into the step's `result`.
    if (stmt.type === 'ReturnStatement') {
      if (stmt.argument) {
        const es = stmt.argument.start
        const ee = stmt.argument.end
        wrapChildren(stmt.argument)
        const argSrc = generate(stmt.argument)
        out.push(stmtFromCode(
          `{ var __ret = (__ts(), (${argSrc})); __rec(${line},"return",${JSON.stringify(desc)},${thunkSrc(names)},` +
            `{hasResult:true,result:__ret,trail:__tc(),es:${es},ee:${ee},tf:__trailText(__ret)}); return __ret; }`,
        ))
      } else {
        out.push(recStmt(line, 'return', desc, names))
        out.push(stmt)
      }
      continue
    }

    // if (test): record the test's boolean as `conditionResult`, then branch.
    if (stmt.type === 'IfStatement') {
      const es = stmt.test.start
      const ee = stmt.test.end
      wrapChildren(stmt.test)
      const testSrc = generate(stmt.test)
      const conseqSrc = generate(stmt.consequent)
      const altSrc = stmt.alternate ? ' else ' + generate(stmt.alternate) : ''
      out.push(stmtFromCode(
        `{ var __c = (__ts(), (${testSrc})); __rec(${line},"condition",${JSON.stringify(desc)},${thunkSrc(names)},` +
          `{conditionResult: !!__c,trail:__tc(),es:${es},ee:${ee},tf:__trailText(__c)}); if (__c) ${conseqSrc}${altSrc} }`,
      ))
      continue
    }

    // Loops: bracket with __loopEnter/__loopExit (emit loop-start/loop-end) and
    // prepend __iter to the body so each iteration is stamped with its index.
    if (isLoop(stmt)) {
      const bodyScope = [...visible]
      if (stmt.type === 'ForStatement' && stmt.init?.type === 'VariableDeclaration') {
        for (const d of stmt.init.declarations) collectNames(d.id, bodyScope)
      } else if ((stmt.type === 'ForInStatement' || stmt.type === 'ForOfStatement') && stmt.left?.type === 'VariableDeclaration') {
        for (const d of stmt.left.declarations) collectNames(d.id, bodyScope)
      }
      const bodyLine = stmt.body.body[0] ? lineOf(stmt.body.body[0]) : line
      stmt.body.body.unshift(stmtFromCode(`__iter(${bodyLine},${JSON.stringify(desc)},${thunkSrc([...new Set(bodyScope)])});`))
      out.push(stmtFromCode(`__loopEnter(${line},${JSON.stringify(desc)},${thunkSrc(names)});`))
      out.push(stmt)
      out.push(stmtFromCode(`__loopExit(${line},${JSON.stringify(desc)},${thunkSrc(names)});`))
      continue
    }

    // Function declarations aren't stepped, but if the function closes over an
    // enclosing scope, tag it right after so the recorder shows its captures.
    if (stmt.type === 'FunctionDeclaration') {
      out.push(stmt)
      if (stmt.__caps?.length) out.push(stmtFromCode(`__tag(${stmt.id.name},${thunkSrc(stmt.__caps)});`))
      continue
    }

    const info = stepInfo(stmt)
    if (info && info.where === 'before') {
      out.push(recStmt(line, info.kind, desc, names))
      out.push(stmt)
      for (const n of declaredNames(stmt)) if (!visible.includes(n)) visible.push(n)
    } else {
      // 'after' (or non-steppable): the statement's own bindings are visible in
      // the snapshot that follows it.
      for (const n of declaredNames(stmt)) if (!visible.includes(n)) visible.push(n)
      const vis = [...new Set(visible)]
      const focus = focusTarget(stmt)
      const decl = stmt.type === 'VariableDeclaration' && stmt.declarations.length === 1 ? stmt.declarations[0] : null
      const asg = stmt.type === 'ExpressionStatement' && stmt.expression.type === 'AssignmentExpression' ? stmt.expression : null
      const trailFields = (es: number, ee: number) => `trail:__tc(),es:${es},ee:${ee},tf:__trailText(__v)`

      // Declaration with an initializer (let c = a * b): capture the RHS trail.
      // `var __v` (in the prelude) holds the value; no block, so `let/const` stays
      // in the surrounding scope.
      if (decl && decl.id.type === 'Identifier' && decl.init) {
        const es = decl.init.start
        const ee = decl.init.end
        wrapChildren(decl.init)
        const initSrc = generate(decl.init)
        out.push(stmtFromCode(`${stmt.kind} ${decl.id.name} = (__ts(), (__v = (${initSrc})));`))
        out.push(recStmt(line, 'declare', desc, vis, buildExtra({ name: decl.id.name }, trailFields(es, ee))))
      } else if (asg && asg.operator === '=') {
        // Simple assignment (x = …, nums[i] = …).
        const es = asg.right.start
        const ee = asg.right.end
        wrapChildren(asg.right)
        const lhsSrc = generate(asg.left)
        const rhsSrc = generate(asg.right)
        out.push(stmtFromCode(`${lhsSrc} = (__ts(), (__v = (${rhsSrc})));`))
        out.push(recStmt(line, 'assign', desc, vis, buildExtra(focus, trailFields(es, ee))))
      } else {
        out.push(stmt)
        if (info) out.push(recStmt(line, info.kind, desc, vis, buildExtra(focus)))
      }
    }
  }
  block.body = out
}

/** Instrument `source`, returning runnable JS that drives the in-guest recorder. */
export function instrument(source: string): string {
  const ast = parse(source, { ecmaVersion: 2023, locations: true }) as Node
  // Global/program scope names are NOT enclosing-function captures, so start empty.
  const ctx: Ctx = { src: source, enclosing: new Set() }
  transformBlock(ast, ctx, [])
  return generate(ast)
}
