import pino from 'pino'

// Create base logger configuration
const isDevelopment = process.env.NODE_ENV === 'development'

// Keys whose values must never appear in logs (case-insensitive comparison).
const SENSITIVE_KEYS = new Set([
  'password',
  'passwordhash',
  'token',
  'authorization',
  'cookie',
  'set-cookie',
  'creditcard',
  'cvv',
])

/**
 * Masks an email address to protect PII while keeping it identifiable.
 * e.g. "john@example.com" -> "j***@example.com"
 */
export const maskEmail = (email: string): string => {
  const atIndex = email.indexOf('@')
  if (atIndex <= 0) return '[REDACTED]'
  return `${email[0]}***@${email.slice(atIndex + 1)}`
}

/**
 * Returns true only for plain objects created via `{}` or `Object.create(null)`.
 * Special object types (Date, RegExp, Error, Set, Map, arrays, …) return false
 * so that scrubSensitiveData leaves them untouched.
 */
const isPlainObject = (value: unknown): value is Record<string, unknown> => {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) {
    return false
  }
  const proto = Object.getPrototypeOf(value) as unknown
  return proto === Object.prototype || proto === null
}

/**
 * Recursively scrubs sensitive fields from a plain object before it is
 * serialised into a log entry.  Passwords, tokens, cookies, etc. are
 * replaced with "[REDACTED]"; email addresses are masked to the
 * first-character + *** form ("j***@example.com").
 *
 * Only plain objects are recursed into; special types (Date, RegExp, Error,
 * Set, Map, …) are left untouched to avoid breaking their serialization.
 */
export const scrubSensitiveData = (
  data: Record<string, unknown>
): Record<string, unknown> => {
  const result: Record<string, unknown> = {}
  for (const [key, value] of Object.entries(data)) {
    const lowerKey = key.toLowerCase()
    if (SENSITIVE_KEYS.has(lowerKey)) {
      result[key] = '[REDACTED]'
    } else if (lowerKey === 'email' && typeof value === 'string') {
      result[key] = maskEmail(value)
    } else if (isPlainObject(value)) {
      result[key] = scrubSensitiveData(value as Record<string, unknown>)
    } else {
      result[key] = value
    }
  }
  return result
}

export const logger = pino({
  level: process.env.LOG_LEVEL || (isDevelopment ? 'debug' : 'info'),
  formatters: {
    level: (label) => {
      return { level: label }
    },
  },
  // Redact sensitive fields at the Pino serialisation layer as a defence-in-depth
  // safeguard.  logError also calls scrubSensitiveData() explicitly so that
  // additionalInfo is clean before it is spread into the log object.
  redact: {
    paths: [
      'password',
      'passwordHash',
      'token',
      'authorization',
      'cookie',
      'set-cookie',
      'creditCard',
      'cvv',
      'email',
      '*.password',
      '*.passwordHash',
      '*.token',
      '*.authorization',
      '*.cookie',
      '*.creditCard',
      '*.cvv',
      '*.email',
    ],
    censor: (value: unknown, path: PropertyKey[]): unknown => {
      // `path[path.length - 1]` is the matched key name for both top-level
      // paths (e.g. 'email') and wildcard paths (e.g. '*.email') because Pino
      // resolves the wildcard before invoking the censor function.
      const key = String(path[path.length - 1])
      if (key === 'email' && typeof value === 'string') {
        return maskEmail(value)
      }
      return '[REDACTED]'
    },
  },
  // Pretty print in development, JSON in production
  transport: isDevelopment
    ? {
        target: 'pino-pretty',
        options: {
          colorize: true,
          translateTime: 'HH:MM:ss',
          ignore: 'pid,hostname',
        },
      }
    : undefined,
  base: {
    env: process.env.NODE_ENV,
  },
})

export const createLogger = (context: Record<string, unknown>) =>
  logger.child(context)

export const logApiRequest = (data: {
  method: string
  path: string
  requestId?: string
  userId?: string
  duration?: number
  statusCode?: number
}) => {
  const logData = {
    type: 'api_request',
    ...data,
  }

  if (data.statusCode && data.statusCode >= 500) {
    // 5xx: server errors — always surfaced in production
    logger.error(logData, 'API request server error')
  } else if (data.statusCode && data.statusCode >= 400) {
    // 4xx: client errors (bad input, not found, unauthorized) — warn level
    logger.warn(logData, 'API request client error')
  } else {
    // 2xx/3xx: successful — debug only, too high-volume for production info logs
    logger.debug(logData, 'API request completed')
  }
}

export const logDatabaseOperation = (data: {
  operation: string
  model: string
  duration?: number
  recordCount?: number
  success: boolean
  error?: string
}) => {
  const logData = {
    type: 'database_operation',
    ...data,
  }

  if (data.success) {
    logger.debug(logData, 'Database operation completed')
  } else {
    logger.error(logData, 'Database operation failed')
  }
}

export const logAuthEvent = (data: {
  event:
    | 'login'
    | 'logout'
    | 'register'
    | 'failed_login'
    | 'account_locked'
    | 'session_created'
    | 'session_expired'
    | 'password_change'
  userId?: string
  email?: string
  provider?: string
  success: boolean
  error?: string
}) => {
  const logData = {
    type: 'auth_event',
    ...data,
  }

  // session_created/session_expired fire on every request — log at debug to avoid
  // flooding production logs. Failures are always logged at warn regardless.
  if (data.event === 'session_created' || data.event === 'session_expired') {
    logger.debug(logData, `Authentication event: ${data.event}`)
  } else if (data.success) {
    logger.info(logData, `Authentication event: ${data.event}`)
  } else {
    logger.warn(logData, `Authentication event failed: ${data.event}`)
  }
}

export const logBusinessEvent = (data: {
  event: string
  userId?: string
  details: Record<string, unknown>
  success: boolean
}) => {
  const logData = {
    type: 'business_event',
    ...data,
  }

  if (data.success) {
    logger.info(logData, `Business event: ${data.event}`)
  } else {
    logger.warn(logData, `Business event failed: ${data.event}`)
  }
}

export const logError = (data: {
  error: unknown
  context?: string
  userId?: string
  requestId?: string
  additionalInfo?: Record<string, unknown>
}) => {
  const error =
    data.error instanceof Error ? data.error : new Error(String(data.error))

  // Scrub sensitive fields from additionalInfo before spreading into the log
  // payload so that passwords, tokens, etc. are never written to the log sink.
  const scrubbedInfo = data.additionalInfo
    ? scrubSensitiveData(data.additionalInfo)
    : undefined

  logger.error(
    {
      type: 'error',
      context: data.context,
      userId: data.userId,
      requestId: data.requestId,
      errorName: error.name,
      errorMessage: error.message,
      stack: error.stack,
      ...scrubbedInfo,
    },
    `Error occurred: ${data.context || 'Unknown context'}`
  )
}

export const logPerformance = (data: {
  operation: string
  duration: number
  metadata?: Record<string, unknown>
}) => {
  const logData = {
    type: 'performance',
    ...data,
  }

  if (data.duration > 1000) {
    logger.warn(logData, `Slow operation detected: ${data.operation}`)
  } else {
    logger.debug(logData, `Performance: ${data.operation}`)
  }
}

export const logCacheOperation = (data: {
  operation: 'hit' | 'miss' | 'set' | 'invalidate'
  key: string
  ttl?: number
  success: boolean
}) => {
  const logData = {
    type: 'cache_operation',
    ...data,
  }

  logger.debug(logData, `Cache ${data.operation}: ${data.key}`)
}

export const generateRequestId = (): string =>
  `req_${Date.now()}_${crypto.randomUUID()}`

// Timing utility
export class Timer {
  private readonly startTime: number
  private readonly label: string

  constructor(label: string) {
    this.label = label
    this.startTime = Date.now()
  }

  end(metadata?: Record<string, unknown>): number {
    const duration = Date.now() - this.startTime
    logPerformance({
      operation: this.label,
      duration,
      metadata,
    })
    return duration
  }
}
