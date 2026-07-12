// Ad-hoc check that every AI key in the environment is alive: one real call per
// KEY (not per provider), returning JSON that matches the triage schema, plus the
// rate-limit signal each vendor exposes.
//   node --env-file=.env scripts/probe-hive-providers.mjs
//
// This mirrors the discovery rule in src/lib/ai-keys/pool.ts. Run it after adding
// a key to the environment: if the new key does not appear in this list, the app
// will not use it either, and the naming is wrong.

/** Same convention the pool uses: PREFIX or PREFIX_<n>, nothing else. */
const PATTERN = {
  gemini: /^GEMINI_API_KEY(?:_(\d+))?$/,
  ollama: /^OLLAMA_API_KEY(?:_(\d+))?$/,
  groq: /^GROQ_API_KEY(?:_(\d+))?$/,
}

function discover() {
  const keys = []
  for (const [provider, pattern] of Object.entries(PATTERN)) {
    const seen = new Set()
    const found = []
    for (const [name, raw] of Object.entries(process.env)) {
      const match = pattern.exec(name)
      if (!match) continue
      const value = raw?.trim()
      if (!value || seen.has(value)) continue // dedupe by value, like the pool
      seen.add(value)
      found.push({ keyId: name, provider, value, order: match[1] === undefined ? -1 : Number(match[1]) })
    }
    keys.push(...found.sort((a, b) => a.order - b.order))
  }
  return keys
}

const SCHEMA = {
  type: 'OBJECT',
  properties: {
    tags: { type: 'ARRAY', items: { type: 'STRING' } },
    topic: { type: 'STRING' },
    severity: { type: 'STRING' },
    sensitive: { type: 'BOOLEAN' },
    sensitiveReason: { type: 'STRING' },
  },
  required: ['tags', 'topic', 'severity', 'sensitive'],
  propertyOrdering: ['tags', 'topic', 'severity', 'sensitive', 'sensitiveReason'],
}

const PROMPT = 'Triage this bootcamp helpdesk post. TITLE: map() returns undefined. BODY: my arrow function uses curly braces.'

// Mirror the real converters rather than importing TS.
const lower = (t) => (typeof t === 'string' ? t.toLowerCase() : t)
function toJsonSchema(s) {
  const out = {}
  for (const [k, v] of Object.entries(s)) {
    if (k === 'propertyOrdering') continue
    if (k === 'type') out.type = lower(v)
    else if (k === 'properties') out.properties = Object.fromEntries(Object.entries(v).map(([n, sub]) => [n, toJsonSchema(sub)]))
    else if (k === 'items') out.items = toJsonSchema(v)
    else out[k] = v
  }
  return out
}
function requireAll(s) {
  const out = { ...s }
  if (out.type === 'object' && out.properties) {
    out.properties = Object.fromEntries(Object.entries(out.properties).map(([k, v]) => [k, requireAll(v)]))
    out.required = Object.keys(out.properties)
    out.additionalProperties = false
  }
  if (out.type === 'array' && out.items) out.items = requireAll(out.items)
  return out
}
function extractJson(text) {
  const t = text.trim()
  const fenced = /```(?:json)?\s*([\s\S]*?)```/i.exec(t)
  if (fenced) return fenced[1].trim()
  const start = t.indexOf('{')
  if (start === -1) return t
  let depth = 0, inStr = false, esc = false
  for (let i = start; i < t.length; i++) {
    const c = t[i]
    if (esc) { esc = false; continue }
    if (c === '\\') { esc = true; continue }
    if (c === '"') inStr = !inStr
    if (inStr) continue
    if (c === '{') depth++
    else if (c === '}' && --depth === 0) return t.slice(start, i + 1)
  }
  return t.slice(start)
}

const rl = (res) => {
  const rem = res.headers.get('x-ratelimit-remaining-requests')
  const reset = res.headers.get('x-ratelimit-reset-requests')
  return rem === null ? 'none' : `remaining=${rem} reset=${reset}`
}

async function gemini(key) {
  const res = await fetch('https://generativelanguage.googleapis.com/v1beta/models/gemini-3.1-flash-lite:generateContent', {
    method: 'POST',
    headers: { 'content-type': 'application/json', 'x-goog-api-key': key },
    body: JSON.stringify({ contents: [{ parts: [{ text: PROMPT }] }], generationConfig: { responseMimeType: 'application/json', responseSchema: SCHEMA } }),
  })
  const data = await res.json()
  return { status: res.status, ratelimit: rl(res), text: data?.candidates?.[0]?.content?.parts?.[0]?.text }
}

async function groq(key) {
  const res = await fetch('https://api.groq.com/openai/v1/chat/completions', {
    method: 'POST',
    headers: { 'content-type': 'application/json', authorization: `Bearer ${key}` },
    body: JSON.stringify({
      model: 'openai/gpt-oss-20b',
      messages: [{ role: 'user', content: PROMPT }],
      response_format: { type: 'json_schema', json_schema: { name: 'triage', strict: true, schema: requireAll(toJsonSchema(SCHEMA)) } },
    }),
  })
  const data = await res.json()
  return { status: res.status, ratelimit: rl(res), text: data?.choices?.[0]?.message?.content }
}

async function ollama(key) {
  const instructed = `${PROMPT}\n\nReply with a single JSON object and nothing else — no prose, no markdown fence.\nIt must match this JSON Schema exactly:\n${JSON.stringify(toJsonSchema(SCHEMA))}`
  const res = await fetch('https://ollama.com/api/chat', {
    method: 'POST',
    headers: { 'content-type': 'application/json', authorization: `Bearer ${key}` },
    body: JSON.stringify({ model: 'gemma3:27b', stream: false, messages: [{ role: 'user', content: instructed }] }),
  })
  const data = await res.json()
  return { status: res.status, ratelimit: rl(res), text: extractJson(data?.message?.content ?? '') }
}

const CALL = { gemini, ollama, groq }

const keys = discover()
if (keys.length === 0) {
  console.log('No API keys found in the environment. Did you pass --env-file=.env ?')
  process.exit(1)
}
console.log(`Discovered ${keys.length} key(s): ${keys.map((k) => k.keyId).join(', ')}\n`)

for (const key of keys) {
  const label = key.keyId.padEnd(18)
  try {
    const r = await CALL[key.provider](key.value)
    let verdict = 'INVALID JSON'
    try {
      const obj = JSON.parse(r.text)
      const ok = ['tags', 'topic', 'severity', 'sensitive'].every((k) => k in obj)
      verdict = ok ? `OK  topic=${obj.topic} severity=${obj.severity} sensitive=${obj.sensitive}` : `MISSING KEYS: ${JSON.stringify(obj).slice(0, 90)}`
    } catch {}
    console.log(`${label} ${key.provider.padEnd(7)} http=${r.status}  ratelimit=${r.ratelimit}\n${' '.repeat(19)}${verdict}`)
  } catch (e) {
    console.log(`${label} ${key.provider.padEnd(7)} THREW: ${e.message}`)
  }
}
