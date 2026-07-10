// Phrasing a round length for a system instruction.
//
// The round length is admin-tunable, and the prompt tells the model how long it
// has. A bare "180 seconds" reads badly to an LLM being asked to pace a spoken
// conversation, so render it the way a person would say it.

export function spokenDuration(seconds: number): string {
  if (seconds < 90) return `${Math.round(seconds)} seconds`
  const minutes = seconds / 60
  const rounded = Math.round(minutes * 2) / 2 // nearest half minute
  if (Number.isInteger(rounded)) return `${rounded} minutes`
  return `${rounded} minutes`
}
