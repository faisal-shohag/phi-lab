// Normalizing Gemini's token counts.
//
// The two APIs disagree on what to call the output tokens, verified against
// node_modules/@google/genai/dist/genai.d.ts:
//
//   generateContent -> GenerateContentResponseUsageMetadata.candidatesTokenCount
//   live            -> UsageMetadata.responseTokenCount
//
// Reading the wrong one yields `undefined`, which recordAiUsage happily stores
// as NULL — a dashboard full of zero-token successful calls. Hence one reader.
import type { TokenUsage } from './record'

/** The union of both usageMetadata shapes, as far as we care about them. */
export interface GeminiUsageMetadata {
  promptTokenCount?: number
  /** generateContent */
  candidatesTokenCount?: number
  /** live */
  responseTokenCount?: number
  thoughtsTokenCount?: number
  totalTokenCount?: number
}

/**
 * `thoughtsTokenCount` is billed as output but reported separately, so fold it
 * into the response count rather than losing it.
 */
export function normalizeTokens(usage: GeminiUsageMetadata | undefined): TokenUsage | undefined {
  if (!usage) return undefined

  const output = usage.candidatesTokenCount ?? usage.responseTokenCount
  const thoughts = usage.thoughtsTokenCount ?? 0
  const responseTokens = output === undefined ? undefined : output + thoughts

  return {
    promptTokens: usage.promptTokenCount,
    responseTokens,
    totalTokens: usage.totalTokenCount,
  }
}
