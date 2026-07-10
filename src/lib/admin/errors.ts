// Thrown by the admin mutation helpers when a guardrail refuses an action.
// Lives in its own module so `guard.ts` can catch it without importing
// `users.ts` (which would pull Prisma into every route that only reads settings).
import type { HiveErrorCode } from '@/lib/hive/errors'

export class AdminActionError extends Error {
  constructor(
    message: string,
    public code: Extract<HiveErrorCode, 'FORBIDDEN' | 'NOT_FOUND' | 'CONFLICT' | 'VALIDATION'> = 'FORBIDDEN',
  ) {
    super(message)
    this.name = 'AdminActionError'
  }
}
