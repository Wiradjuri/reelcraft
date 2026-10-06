import type { ApiErrorBody } from './types'

const BASE = '/api/v1'

/** A customer-presentable error. `title`/`message` are safe to show; `details` go under "Advanced details". */
export class ApiError extends Error {
  readonly status: number
  readonly code: string
  readonly title: string
  readonly retryable: boolean
  readonly details: Record<string, unknown>

  constructor(status: number, body: ApiErrorBody) {
    super(body.message)
    this.name = 'ApiError'
    this.status = status
    this.code = body.code
    this.title = body.title
    this.retryable = body.retryable
    this.details = body.details ?? {}
  }

  /** Field-level validation messages keyed by field path (e.g. "email", "options.reel_duration"). */
  get fieldErrors(): Record<string, string> {
    const errors = this.details.errors
    if (!Array.isArray(errors)) return {}
    return Object.fromEntries(
      errors
        .filter((e): e is { field: string; message: string } => typeof e?.field === 'string')
        .map((e) => [e.field, e.message]),
    )
  }
}

const NETWORK_ERROR: ApiErrorBody = {
  code: 'network_error',
  title: "We couldn't reach ReelCraft",
  message: 'Check your internet connection and try again.',
  retryable: true,
  details: {},
}

function fallbackError(status: number): ApiErrorBody {
  return {
    code: `http_${status}`,
    title: status >= 500 ? 'Something went wrong on our side' : 'That request failed',
    message: 'Please try again in a moment.',
    retryable: status >= 500,
    details: { status },
  }
}

type Query = Record<string, string | number | boolean | null | undefined>

export async function api<T>(
  path: string,
  {
    method = 'GET',
    body,
    query,
    signal,
  }: { method?: string; body?: unknown; query?: Query; signal?: AbortSignal } = {},
): Promise<T> {
  const url = new URL(BASE + path, window.location.origin)
  for (const [key, value] of Object.entries(query ?? {})) {
    if (value !== undefined && value !== null && value !== '' && value !== false)
      url.searchParams.set(key, String(value))
  }
  let response: Response
  try {
    response = await fetch(url, {
      method,
      signal,
      credentials: 'same-origin',
      headers: {
        Accept: 'application/json',
        // Required by the API's CSRF protection for state-changing requests.
        'X-Requested-With': 'reelcraft',
        ...(body !== undefined ? { 'Content-Type': 'application/json' } : {}),
      },
      body: body !== undefined ? JSON.stringify(body) : undefined,
    })
  } catch (error) {
    if (error instanceof DOMException && error.name === 'AbortError') throw error
    throw new ApiError(0, NETWORK_ERROR)
  }
  if (response.status === 204) return undefined as T
  const payload: unknown = await response.json().catch(() => null)
  if (!response.ok) {
    const body = (payload as { error?: ApiErrorBody } | null)?.error
    throw new ApiError(response.status, body?.title ? body : fallbackError(response.status))
  }
  return payload as T
}

export function toApiError(error: unknown): ApiError {
  if (error instanceof ApiError) return error
  return new ApiError(0, { ...fallbackError(0), details: { reason: String(error) } })
}
