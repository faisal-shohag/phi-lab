// Shared error taxonomy for the interview lab. API routes return
// `{ error: <code>, message }`; the client maps the code to a friendly title
// and body so users never see a raw stack trace or model error string.

export type InterviewErrorCode =
  | 'AUTH_REQUIRED'
  | 'SUSPENDED'
  | 'LAB_DISABLED'
  | 'DAILY_LIMIT'
  | 'CONNECT_FAILED'
  | 'LIVE_DROPPED'
  | 'REPORT_FAILED'
  | 'NOT_FOUND'
  | 'SERVER_ERROR'

interface ErrorCopy {
  title: string
  message: string
}

export const ERROR_COPY: Record<InterviewErrorCode, ErrorCopy> = {
  AUTH_REQUIRED: {
    title: 'Please sign in',
    message: 'You need to be signed in to start an interview.',
  },
  SUSPENDED: {
    title: 'Account suspended',
    message: 'Your account has been suspended. Contact an administrator if you think this is a mistake.',
  },
  LAB_DISABLED: {
    title: 'Temporarily unavailable',
    message: 'Mock interviews are switched off right now. Please check back shortly.',
  },
  DAILY_LIMIT: {
    title: 'Daily limit reached',
    message: "You've used all your interviews for today. Come back tomorrow to practise again.",
  },
  CONNECT_FAILED: {
    title: 'Could not start the interview',
    message: 'We could not reach the live interviewer. Check your connection and try again.',
  },
  LIVE_DROPPED: {
    title: 'Connection lost',
    message: 'The interview connection dropped and could not be restored.',
  },
  REPORT_FAILED: {
    title: 'Scoring failed',
    message: "We couldn't generate your report, but your answers are saved. You can try scoring again.",
  },
  NOT_FOUND: {
    title: 'Not found',
    message: 'That interview session could not be found.',
  },
  SERVER_ERROR: {
    title: 'Something went wrong',
    message: 'An unexpected error occurred. Please try again.',
  },
}

/** HTTP status to use for each error code when returned from a route. */
export const ERROR_STATUS: Record<InterviewErrorCode, number> = {
  AUTH_REQUIRED: 401,
  SUSPENDED: 403,
  LAB_DISABLED: 503,
  DAILY_LIMIT: 429,
  CONNECT_FAILED: 502,
  LIVE_DROPPED: 500,
  REPORT_FAILED: 502,
  NOT_FOUND: 404,
  SERVER_ERROR: 500,
}

/** Builds a JSON error Response for a given code. */
export function errorResponse(code: InterviewErrorCode, detail?: string) {
  return Response.json(
    { error: code, message: detail ?? ERROR_COPY[code].message },
    { status: ERROR_STATUS[code] },
  )
}

/** Resolves a raw error code string (from an API response) to friendly copy. */
export function resolveErrorCopy(code: string | null | undefined): ErrorCopy {
  if (code && code in ERROR_COPY) return ERROR_COPY[code as InterviewErrorCode]
  return ERROR_COPY.SERVER_ERROR
}
