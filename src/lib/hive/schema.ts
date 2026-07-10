// Schema plumbing shared by the AI providers.
//
// Hive declares its response shapes once, in Gemini's dialect (`Type.OBJECT`,
// `propertyOrdering`, …). Ollama and Groq speak plain JSON Schema, so the
// Gemini schema is the single source of truth and everything else is derived
// from it. That way adding a field can't leave one provider behind.

type Json = Record<string, unknown>

/** Gemini uses uppercase type names; JSON Schema uses lowercase. */
function lowerType(t: unknown): unknown {
  return typeof t === 'string' ? t.toLowerCase() : t
}

/**
 * Gemini schema → plain JSON Schema. Drops `propertyOrdering` (Gemini-only) and
 * lowercases every `type`.
 */
export function toJsonSchema(schema: object): Json {
  const src = schema as Json
  const out: Json = {}

  for (const [key, value] of Object.entries(src)) {
    if (key === 'propertyOrdering') continue
    if (key === 'type') {
      out.type = lowerType(value)
    } else if (key === 'properties' && value && typeof value === 'object') {
      const props: Json = {}
      for (const [name, sub] of Object.entries(value as Json)) {
        props[name] = toJsonSchema(sub as object)
      }
      out.properties = props
    } else if (key === 'items' && value && typeof value === 'object') {
      out.items = toJsonSchema(value as object)
    } else {
      out[key] = value
    }
  }
  return out
}

/**
 * Groq's `strict: true` demands that every property appear in `required` and
 * that `additionalProperties` is false. Our schemas have genuinely optional
 * fields (`sensitiveReason`, `improvedTitle`), so we mark them required and let
 * the model return an empty string — the callers already treat "" as absent.
 */
export function requireAllProperties(schema: Json): Json {
  const out: Json = { ...schema }

  if (out.type === 'object' && out.properties && typeof out.properties === 'object') {
    const props = out.properties as Json
    out.properties = Object.fromEntries(
      Object.entries(props).map(([k, v]) => [k, requireAllProperties(v as Json)]),
    )
    out.required = Object.keys(props)
    out.additionalProperties = false
  }
  if (out.type === 'array' && out.items && typeof out.items === 'object') {
    out.items = requireAllProperties(out.items as Json)
  }
  return out
}

/**
 * Take the outermost {...}, tracking string state so braces inside string
 * values don't confuse the depth count.
 */
function outermostObject(text: string): string | null {
  const start = text.indexOf('{')
  if (start === -1) return null

  let depth = 0
  let inString = false
  let escaped = false
  for (let i = start; i < text.length; i++) {
    const ch = text[i]
    if (escaped) {
      escaped = false
      continue
    }
    if (ch === '\\') {
      escaped = true
      continue
    }
    if (ch === '"') inString = !inString
    if (inString) continue
    if (ch === '{') depth++
    else if (ch === '}') {
      depth--
      if (depth === 0) return text.slice(start, i + 1)
    }
  }
  return null // never closed: the reply was truncated
}

/**
 * Pull a JSON object out of a model reply that may be wrapped in prose or a
 * ```json fence. Ollama ignores every structured-output flag, so this is the
 * only thing standing between it and a parse error.
 *
 * Brace-matching runs FIRST and a fence is only stripped as a fallback. A
 * naive `/```(.*?)```/` match is actively wrong here: Hive's answers embed
 * markdown code fences inside the `body` string, so the lazy match closes on
 * the *inner* fence and returns truncated JSON.
 */
export function extractJson(text: string): string {
  const trimmed = text.trim()

  const direct = outermostObject(trimmed)
  if (direct) return direct

  // No balanced object found — maybe the JSON itself is fenced and truncated,
  // or the model emitted only a fence. Strip the outermost fence and retry.
  if (trimmed.startsWith('```')) {
    const withoutOpen = trimmed.replace(/^```[a-z]*\s*/i, '')
    const lastFence = withoutOpen.lastIndexOf('```')
    const inner = (lastFence === -1 ? withoutOpen : withoutOpen.slice(0, lastFence)).trim()
    return outermostObject(inner) ?? inner
  }

  return trimmed
}
