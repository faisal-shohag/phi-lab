// Hive error taxonomy — mirrors the interview lab's pattern (src/lib/interview/
// errors.ts). Routes return `{ error: <code>, message }`; the client maps the
// code to friendly copy.

export type HiveErrorCode =
  | 'AUTH_REQUIRED'
  | 'FORBIDDEN'
  | 'NOT_FOUND'
  | 'DAILY_LIMIT'
  | 'VALIDATION'
  | 'CONFLICT'
  | 'SERVER_ERROR'

const ERROR_STATUS: Record<HiveErrorCode, number> = {
  AUTH_REQUIRED: 401,
  FORBIDDEN: 403,
  NOT_FOUND: 404,
  DAILY_LIMIT: 429,
  VALIDATION: 400,
  CONFLICT: 409,
  SERVER_ERROR: 500,
}

const DEFAULT_MESSAGE: Record<HiveErrorCode, string> = {
  AUTH_REQUIRED: 'You need to be signed in.',
  FORBIDDEN: 'You do not have permission to do that.',
  NOT_FOUND: 'That post could not be found.',
  DAILY_LIMIT: "You've hit today's limit. Come back tomorrow.",
  VALIDATION: 'Please check your input and try again.',
  CONFLICT: 'That action conflicts with the current state.',
  SERVER_ERROR: 'An unexpected error occurred. Please try again.',
}

export function hiveError(code: HiveErrorCode, detail?: string) {
  return Response.json(
    { error: code, message: detail ?? DEFAULT_MESSAGE[code] },
    { status: ERROR_STATUS[code] },
  )
}
