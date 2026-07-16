// Splitting a brief into prose, colours and measurements.
//
// Pure, and in lib rather than beside a component, because the brief is a spec
// long before it is a UI: "a 200x120 box, #1e293b, 12px radius" is a list of
// numbers wearing a sentence, and the numbers are the part that has to be read
// exactly. Pulling them out is what makes that possible.

export type BriefToken =
  | { kind: 'text'; value: string }
  | { kind: 'colour'; value: string }
  | { kind: 'measure'; value: string }

/**
 * Colours first, then dimensions, then plain measurements — in one alternation,
 * on purpose.
 *
 * Split them into separate passes and `#1e293b` loses its `293` to the number
 * rule. `200x120` comes before the bare `\d+px` form for the same reason.
 */
const TOKEN = /(#[0-9a-fA-F]{3,8}\b|\b\d+x\d+\b|\b\d+(?:\.\d+)?(?:px|%|rem|em)\b)/g

/**
 * @param splitWords also break prose to the word, so a caller can stagger it.
 *   The scroll inks word by word; anything else just concatenates it back.
 */
export function tokenizeBrief(brief: string, splitWords = false): BriefToken[] {
  const out: BriefToken[] = []
  for (const part of brief.split(TOKEN)) {
    if (!part) continue
    if (/^#[0-9a-fA-F]{3,8}$/.test(part)) out.push({ kind: 'colour', value: part })
    else if (/^\d/.test(part) && /(px|%|rem|em|x\d)/.test(part)) out.push({ kind: 'measure', value: part })
    else if (!splitWords) out.push({ kind: 'text', value: part })
    else for (const w of part.split(/(\s+)/)) if (w) out.push({ kind: 'text', value: w })
  }
  return out
}
