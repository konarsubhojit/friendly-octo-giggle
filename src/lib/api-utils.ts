import { NextResponse } from 'next/server'
import { ZodError, type ZodType } from 'zod'
import { logError } from '@/lib/logger'

export const DEFAULT_JSON_BODY_MAX_BYTES = 64 * 1024

const getValidationDetails = (error: ZodError<unknown>) =>
  error.issues.reduce(
    (acc, err) => {
      const path = err.path.join('.')
      acc[path] = err.message
      return acc
    },
    {} as Record<string, string>
  )

const parseContentLength = (request: Request): number | null => {
  const headerValue = request.headers.get('content-length')
  if (!headerValue) {
    return null
  }

  const parsed = Number.parseInt(headerValue, 10)
  return Number.isNaN(parsed) || parsed < 0 ? null : parsed
}

export class JsonBodyParseError extends Error {
  readonly status: number
  readonly details?: Record<string, unknown>

  constructor(
    message: string,
    status = 400,
    details?: Record<string, unknown>
  ) {
    super(message)
    this.name = 'JsonBodyParseError'
    this.status = status
    this.details = details
  }
}

export const isJsonBodyParseError = (
  error: unknown
): error is JsonBodyParseError => error instanceof JsonBodyParseError

export const parseJsonBody = async <TSchema extends ZodType>(
  request: Request,
  schema: TSchema,
  options?: { maxBytes?: number; allowEmpty?: boolean }
): Promise<TSchema['_output']> => {
  const maxBytes = options?.maxBytes ?? DEFAULT_JSON_BODY_MAX_BYTES
  const contentLength = parseContentLength(request)
  if (contentLength !== null && contentLength > maxBytes) {
    throw new JsonBodyParseError('Request body too large', 400, {
      maxBytes,
      contentLength,
    })
  }

  const rawText = await request.text()
  const actualBodySize = new TextEncoder().encode(rawText).byteLength
  if (actualBodySize > maxBytes) {
    throw new JsonBodyParseError('Request body too large', 400, {
      maxBytes,
      contentLength: actualBodySize,
    })
  }

  let rawBody: unknown
  if (rawText.trim().length === 0) {
    if (options?.allowEmpty) {
      rawBody = {}
    } else {
      throw new JsonBodyParseError('Request body is required', 400)
    }
  } else {
    try {
      rawBody = JSON.parse(rawText)
    } catch {
      throw new JsonBodyParseError('Invalid JSON body', 400)
    }
  }

  const parseResult = schema.safeParse(rawBody)
  if (!parseResult.success) {
    throw new JsonBodyParseError(
      'Validation failed',
      400,
      getValidationDetails(parseResult.error)
    )
  }

  return parseResult.data
}

export const parseOffsetParam = (offsetParam: string | null): number => {
  const parsed = Number.parseInt(offsetParam ?? '0', 10)
  return Number.isNaN(parsed) ? 0 : Math.max(0, parsed)
}

export const apiSuccess = <T>(
  data: T,
  status = 200,
  headers?: Record<string, string>
) => NextResponse.json({ success: true, data }, { status, headers })

export const apiError = (
  error: string,
  status = 500,
  details?: Record<string, unknown>
) => NextResponse.json({ success: false, error, details }, { status })

export const handleValidationError = (error: ZodError<unknown>) => {
  return apiError('Validation failed', 400, getValidationDetails(error))
}

export const handleApiError = (error: unknown) => {
  logError({ error, context: 'api_error' })

  if (error instanceof JsonBodyParseError) {
    return apiError(error.message, error.status, error.details)
  }

  if (error instanceof ZodError) {
    return handleValidationError(error)
  }

  if (error instanceof Error) {
    return apiError(error.message)
  }

  return apiError('An unexpected error occurred')
}

export const safeFetch = async <T>(
  url: string,
  options?: RequestInit
): Promise<{ data?: T; error?: string }> => {
  try {
    const response = await fetch(url, options)

    const handlers: Record<
      string,
      () => Promise<{ data?: T; error?: string }>
    > = {
      true: async () => {
        const data = await response.json()
        return { data: data.data || data }
      },
      false: async () => {
        const errorData = await response.json().catch(() => ({}))
        return { error: errorData.error || 'Request failed' }
      },
    }

    return handlers[response.ok.toString()]()
  } catch (error) {
    return { error: error instanceof Error ? error.message : 'Network error' }
  }
}

export const isApiSuccess = <T>(
  response: unknown
): response is { success: true; data: T } =>
  typeof response === 'object' &&
  response !== null &&
  'success' in response &&
  response.success === true &&
  'data' in response

export const asyncHandler =
  <T extends unknown[], R>(handler: (...args: T) => Promise<R>) =>
  async (...args: T): Promise<R | NextResponse> => {
    try {
      return await handler(...args)
    } catch (error) {
      return handleApiError(error)
    }
  }
