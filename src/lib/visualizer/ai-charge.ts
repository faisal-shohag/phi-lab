// Server helper: charge a learner XP for one helper-AI use (Step Tutor, Story,
// Complexity, Harder-one). Called only when a real generation is about to run —
// cached responses are free. Each call uses a unique sourceId so every use is a
// fresh charge (not idempotently swallowed).

import { randomUUID } from 'node:crypto'
import { spendXp } from '@/lib/gamification/award'
import { AI_CHARGE } from '@/lib/visualizer/challenge'

export { AI_CHARGE }

export interface ChargeResult {
  ok: boolean
  balance: number
  reason?: 'INSUFFICIENT_XP'
}

export async function chargeAiUse(userId: string): Promise<ChargeResult> {
  const res = await spendXp({ userId, reason: 'viz_ai_use', sourceId: randomUUID(), amount: AI_CHARGE })
  if (!res.spent) return { ok: false, balance: res.balance, reason: 'INSUFFICIENT_XP' }
  return { ok: true, balance: res.balance }
}
