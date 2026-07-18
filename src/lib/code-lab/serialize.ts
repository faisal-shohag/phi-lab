// Deterministic value serializer used to compare a submission's output to the
// expected output. JSON.stringify is not enough: it drops `undefined`, turns
// NaN/Infinity into `null`, hides the -0 vs 0 distinction, and does not sort
// object keys — so two "equal" objects can stringify differently.
//
// The exact same algorithm must run in THREE places and agree byte-for-byte:
//   • the browser Run worker (this TS function),
//   • the Vitest grading tests (this TS function),
//   • the server QuickJS sandbox (STABLE_SERIALIZE_SRC, injected as source).
// serialize.test.ts pins the two implementations together against a battery of
// edge cases so they can never silently drift.

export function stableSerialize(value: unknown): string {
  return ser(value, new Set())
}

function ser(v: unknown, seen: Set<object>): string {
  if (v === undefined) return 'undefined'
  if (v === null) return 'null'
  const t = typeof v
  if (t === 'number') {
    const n = v as number
    if (Number.isNaN(n)) return 'NaN'
    if (n === Infinity) return 'Infinity'
    if (n === -Infinity) return '-Infinity'
    if (n === 0 && 1 / n === -Infinity) return '-0'
    return String(n)
  }
  if (t === 'string') return JSON.stringify(v)
  if (t === 'boolean') return String(v)
  if (t === 'bigint') return String(v) + 'n'
  if (t === 'function') return '[Function]'
  if (t === 'symbol') return String(v)
  if (Array.isArray(v)) {
    if (seen.has(v)) return '[Circular]'
    seen.add(v)
    const out = '[' + v.map((x) => ser(x, seen)).join(',') + ']'
    seen.delete(v)
    return out
  }
  const o = v as Record<string, unknown>
  if (seen.has(o)) return '[Circular]'
  seen.add(o)
  const keys = Object.keys(o).sort()
  const out = '{' + keys.map((k) => JSON.stringify(k) + ':' + ser(o[k], seen)).join(',') + '}'
  seen.delete(o)
  return out
}

/**
 * The identical algorithm as guest source, declaring `__stableSerialize` on the
 * QuickJS global. Kept in lockstep with the TS above by serialize.test.ts.
 */
export const STABLE_SERIALIZE_SRC = `
function __stableSerialize(value){
  function ser(v, seen){
    if (v === undefined) return 'undefined';
    if (v === null) return 'null';
    var t = typeof v;
    if (t === 'number'){
      if (v !== v) return 'NaN';
      if (v === Infinity) return 'Infinity';
      if (v === -Infinity) return '-Infinity';
      if (v === 0 && 1/v === -Infinity) return '-0';
      return String(v);
    }
    if (t === 'string') return JSON.stringify(v);
    if (t === 'boolean') return String(v);
    if (t === 'bigint') return String(v) + 'n';
    if (t === 'function') return '[Function]';
    if (t === 'symbol') return String(v);
    if (Array.isArray(v)){
      if (seen.indexOf(v) !== -1) return '[Circular]';
      seen.push(v);
      var out = '[' + v.map(function(x){ return ser(x, seen); }).join(',') + ']';
      seen.pop();
      return out;
    }
    if (seen.indexOf(v) !== -1) return '[Circular]';
    seen.push(v);
    var keys = Object.keys(v).sort();
    var body = keys.map(function(k){ return JSON.stringify(k) + ':' + ser(v[k], seen); }).join(',');
    seen.pop();
    return '{' + body + '}';
  }
  return ser(value, []);
}
`

/**
 * Normalize captured stdout for comparison: trim trailing whitespace on each
 * line and drop a single trailing newline. Keeps interior blank lines. Used on
 * both sides so "42\n" and "42" compare equal but "1\n2" and "2\n1" do not.
 */
export function normalizeStdout(s: string): string {
  return s
    .split('\n')
    .map((line) => line.replace(/[ \t]+$/, ''))
    .join('\n')
    .replace(/\n+$/, '')
}
