import { logError } from '@/lib/logger'

/**
 * Error messages and SQLSTATE codes that mean "the connection died, the
 * statement never produced a result".
 *
 * `pg` rejects every in-flight query with `Connection terminated unexpectedly`
 * when the socket ends underneath it (`node_modules/pg/lib/client.js`,
 * `con.once('end')` → `_errorAllQueries`). On a serverless platform this is
 * routine rather than exceptional: the container is frozen between
 * invocations, the pooler or the database closes the idle socket server-side,
 * and the next query is dispatched on a socket that is already gone.
 *
 * Class 08 SQLSTATEs are the server-side equivalents, and the socket-level
 * codes cover the same failure surfaced by the OS instead of by the protocol.
 */
const CONNECTION_ERROR_MESSAGES = [
  'connection terminated',
  'connection ended unexpectedly',
  'connection closed',
  'socket hang up',
  'server closed the connection unexpectedly',
  'terminating connection due to administrator command',
] as const

const CONNECTION_ERROR_CODES = new Set([
  // Node socket failures.
  'ECONNRESET',
  'EPIPE',
  'ETIMEDOUT',
  'ECONNREFUSED',
  'ENOTFOUND',
  'EHOSTUNREACH',
  // PostgreSQL class 08 — connection exception.
  '08000',
  '08003',
  '08006',
  '08001',
  '08004',
  // PostgreSQL class 57 — operator intervention.
  '57P01',
  '57P02',
  '57P03',
])

/**
 * Walk an error's `cause` chain.
 *
 * Drizzle wraps driver failures in a `DrizzleQueryError` whose message is the
 * rendered SQL and whose `cause` is the `pg` error, so the signal we need is
 * never on the outermost error. `AggregateError` is included because pool
 * shutdown collects failures that way.
 */
const collectCauses = (error: unknown): unknown[] => {
  const seen = new Set<unknown>()
  const queue: unknown[] = [error]
  const collected: unknown[] = []

  while (queue.length > 0) {
    const current = queue.shift()
    if (current === null || current === undefined || seen.has(current)) continue
    seen.add(current)
    collected.push(current)

    if (current instanceof AggregateError) queue.push(...current.errors)
    if (typeof current === 'object' && 'cause' in current) {
      queue.push((current as { cause: unknown }).cause)
    }
  }

  return collected
}

/**
 * True when the failure means the connection dropped rather than the statement
 * being rejected.
 *
 * The distinction matters: a dropped connection is worth another attempt on a
 * fresh socket, whereas a constraint violation or a syntax error would fail
 * identically every time and must surface immediately.
 */
export const isConnectionError = (error: unknown): boolean =>
  collectCauses(error).some((candidate) => {
    if (typeof candidate !== 'object') return false

    const code = (candidate as { code?: unknown }).code
    if (typeof code === 'string' && CONNECTION_ERROR_CODES.has(code)) {
      return true
    }

    const message = (candidate as { message?: unknown }).message
    if (typeof message !== 'string') return false

    const normalized = message.toLowerCase()
    return CONNECTION_ERROR_MESSAGES.some((known) => normalized.includes(known))
  })

const sleep = (ms: number): Promise<void> =>
  new Promise((resolve) => setTimeout(resolve, ms))

export interface DatabaseRetryOptions {
  /** Total attempts, including the first. */
  readonly attempts?: number
  /** Delay before the first retry; doubled for each subsequent one. */
  readonly baseDelayMs?: number
  /** Label recorded against the retry log line. */
  readonly context: string
}

/**
 * Run a **read-only** query, retrying it when the connection drops.
 *
 * Restricted to reads by contract. A terminated connection tells us the client
 * received no result — it does not tell us whether the server applied the
 * statement, so replaying a write could duplicate it. Reads have no such
 * ambiguity: re-running one is always safe.
 *
 * `pg` discards a client whose socket errored instead of returning it to the
 * pool, so the retry is served by a freshly established connection rather than
 * the same dead one. That is what makes a single retry sufficient for the
 * common stale-socket case; the backoff exists for the rarer case of a
 * database that is briefly refusing connections.
 *
 * Retries are logged rather than swallowed, so a connection that fails
 * repeatedly stays visible in observability even when the query eventually
 * succeeds.
 */
export const withDatabaseRetry = async <T>(
  read: () => Promise<T>,
  options: DatabaseRetryOptions
): Promise<T> => {
  const attempts = Math.max(1, options.attempts ?? 2)
  const baseDelayMs = options.baseDelayMs ?? 100

  for (let attempt = 1; ; attempt += 1) {
    try {
      return await read()
    } catch (error) {
      if (attempt >= attempts || !isConnectionError(error)) throw error

      logError({
        error,
        context: 'database_connection_retry',
        additionalInfo: {
          operation: options.context,
          attempt,
          remainingAttempts: attempts - attempt,
        },
      })

      await sleep(baseDelayMs * 2 ** (attempt - 1))
    }
  }
}
