// Extract the entry function's parameter names from a starter signature, so the
// testcase panel can label each argument (nums =, k =) like LeetCode instead of
// showing a positional array. Best-effort: falls back to arg0, arg1… when it
// can't parse the signature.

/** Names of the parameters of `fnName` as declared in `starter`. */
export function paramNames(starter: string, fnName: string | null): string[] {
  if (!fnName) return []
  // Match `function fnName(a, b)`, `const fnName = (a, b) =>`, or a TS variant
  // with type annotations we strip off.
  const patterns = [
    new RegExp(`function\\s+${escape(fnName)}\\s*\\(([^)]*)\\)`),
    new RegExp(`${escape(fnName)}\\s*[=:]\\s*(?:async\\s*)?\\(([^)]*)\\)`),
    new RegExp(`${escape(fnName)}\\s*\\(([^)]*)\\)`),
  ]
  for (const re of patterns) {
    const m = re.exec(starter)
    if (m) return splitParams(m[1])
  }
  return []
}

function splitParams(raw: string): string[] {
  if (!raw.trim()) return []
  return raw
    .split(',')
    .map((p) =>
      p
        .replace(/:.*$/, '') // drop TS type annotation
        .replace(/=.*$/, '') // drop default value
        .replace(/[?.]/g, '') // drop optional marker / rest dots
        .trim(),
    )
    .filter(Boolean)
}

function escape(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}
