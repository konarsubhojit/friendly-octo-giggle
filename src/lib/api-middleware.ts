import { NextRequest, NextResponse } from 'next/server'
import { logApiRequest, generateRequestId, Timer } from './logger'
import { auth } from './auth'
import { checkRateLimit } from './rate-limit'

export interface ApiContext {
  requestId: string
  userId?: string
  timer: Timer
}

export type ApiHandler = (
  request: NextRequest,
  context: ApiContext
) => Promise<Response>

interface LoggingOptions {
  requireAuth?: boolean
}

const buildRateLimitResponse = (reset: number): NextResponse => {
  const retryAfter = Math.ceil((reset - Date.now()) / 1000)
  return NextResponse.json(
    { error: 'Too Many Requests' },
    {
      status: 429,
      headers: {
        'Retry-After': String(Math.max(retryAfter, 1)),
        'X-RateLimit-Reset': String(reset),
      },
    }
  )
}

const createLoggingWrapper = (options: LoggingOptions = {}) => {
  const { requireAuth = false } = options

  return (
    handler: ApiHandler | ((request: NextRequest) => Promise<Response>)
  ) => {
    return async (request: NextRequest): Promise<Response> => {
      const requestId = generateRequestId()
      const timer = new Timer(
        `api.${request.method}.${request.nextUrl.pathname}`
      )

      const rateLimitResult = await checkRateLimit(request)
      if (rateLimitResult && !rateLimitResult.success) {
        return buildRateLimitResponse(rateLimitResult.reset)
      }

      let userId: string | undefined
      if (requireAuth) {
        const session = await auth()
        userId = session?.user?.id
      }

      const context: ApiContext = { requestId, userId, timer }

      try {
        const response = requireAuth
          ? await (handler as ApiHandler)(request, context)
          : await (handler as (request: NextRequest) => Promise<Response>)(
              request
            )

        const duration = timer.end({ statusCode: response.status, userId })

        logApiRequest({
          method: request.method,
          path: request.nextUrl.pathname,
          requestId,
          userId,
          duration,
          statusCode: response.status,
        })

        response.headers.set('X-Request-ID', requestId)
        return response
      } catch (error) {
        const duration = timer.end({ error: true })

        logApiRequest({
          method: request.method,
          path: request.nextUrl.pathname,
          requestId,
          userId,
          duration,
          statusCode: 500,
        })

        throw error
      }
    }
  }
}

export const withApiLogging = (handler: ApiHandler) =>
  createLoggingWrapper({ requireAuth: true })(handler)

export const withLogging = <TArgs extends unknown[]>(
  handler: (request: NextRequest, ...args: TArgs) => Promise<Response>
) => {
  return async (request: NextRequest, ...args: TArgs): Promise<Response> => {
    const requestId = generateRequestId()
    const timer = new Timer(`api.${request.method}.${request.nextUrl.pathname}`)

    const rateLimitResult = await checkRateLimit(request)
    if (rateLimitResult && !rateLimitResult.success) {
      return buildRateLimitResponse(rateLimitResult.reset)
    }

    try {
      const response = await handler(request, ...args)
      const duration = timer.end({ statusCode: response.status })

      logApiRequest({
        method: request.method,
        path: request.nextUrl.pathname,
        requestId,
        duration,
        statusCode: response.status,
      })

      response.headers.set('X-Request-ID', requestId)
      return response
    } catch (error) {
      const duration = timer.end({ error: true })

      logApiRequest({
        method: request.method,
        path: request.nextUrl.pathname,
        requestId,
        duration,
        statusCode: 500,
      })

      throw error
    }
  }
}
