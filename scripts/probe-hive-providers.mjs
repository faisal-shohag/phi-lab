// Ad-hoc check that every Hive AI provider returns JSON matching the triage
// schema, and reports the rate-limit signal each one exposes.
//   node --env-file=.env scripts/probe-hive-providers.mjs
import { readFileSync } from 'node:fs'

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

async function gemini() {
  const res = await fetch('https://generativelanguage.googleapis.com/v1beta/models/gemini-3.1-flash-lite:generateContent', {
    method: 'POST',
    headers: { 'content-type': 'application/json', 'x-goog-api-key': process.env.GEMINI_API_KEY_2 },
    body: JSON.stringify({ contents: [{ parts: [{ text: PROMPT }] }], generationConfig: { responseMimeType: 'application/json', responseSchema: SCHEMA } }),
  })
  const data = await res.json()
  return { status: res.status, ratelimit: rl(res), text: data?.candidates?.[0]?.content?.parts?.[0]?.text }
}

async function groq() {
  const res = await fetch('https://api.groq.com/openai/v1/chat/completions', {
    method: 'POST',
    headers: { 'content-type': 'application/json', authorization: `Bearer ${process.env.GROQ_API_KEY}` },
    body: JSON.stringify({
      model: 'openai/gpt-oss-20b',
      messages: [{ role: 'user', content: PROMPT }],
      response_format: { type: 'json_schema', json_schema: { name: 'triage', strict: true, schema: requireAll(toJsonSchema(SCHEMA)) } },
    }),
  })
  const data = await res.json()
  return { status: res.status, ratelimit: rl(res), text: data?.choices?.[0]?.message?.content }
}

async function ollama() {
  const instructed = `${PROMPT}\n\nReply with a single JSON object and nothing else — no prose, no markdown fence.\nIt must match this JSON Schema exactly:\n${JSON.stringify(toJsonSchema(SCHEMA))}`
  const res = await fetch('https://ollama.com/api/chat', {
    method: 'POST',
    headers: { 'content-type': 'application/json', authorization: `Bearer ${process.env.OLLAMA_API_KEY}` },
    body: JSON.stringify({ model: 'gemma3:27b', stream: false, messages: [{ role: 'user', content: instructed }] }),
  })
  const data = await res.json()
  return { status: res.status, ratelimit: rl(res), text: extractJson(data?.message?.content ?? '') }
}

for (const [name, fn] of Object.entries({ gemini, ollama, groq })) {
  try {
    const r = await fn()
    let verdict = 'INVALID JSON'
    try {
      const obj = JSON.parse(r.text)
      const ok = ['tags', 'topic', 'severity', 'sensitive'].every((k) => k in obj)
      verdict = ok ? `OK  topic=${obj.topic} severity=${obj.severity} sensitive=${obj.sensitive}` : `MISSING KEYS: ${JSON.stringify(obj).slice(0, 90)}`
    } catch {}
    console.log(`${name.padEnd(7)} http=${r.status}  ratelimit=${r.ratelimit}\n        ${verdict}`)
  } catch (e) {
    console.log(`${name.padEnd(7)} THREW: ${e.message}`)
  }
}
