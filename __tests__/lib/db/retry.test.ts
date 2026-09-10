import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { isConnectionError, withDatabaseRetry } from '@/lib/db/retry'

const { mockLogError } = vi.hoisted(() => ({ mockLogError: vi.fn() }))

vi.mock('@/lib/logger', () => ({ logError: mockLogError }))

/**
 * The shape drizzle produces: the rendered SQL on the outside, the driver
 * failure on `cause`. Detection has to walk the chain or it never sees the
 * signal, which is exactly how the affinity cron failure presented.
 */
const drizzleWrapped = (cause: unknown): Error =>
  Object.assign(new Error('Failed query: select "OrderItem"."productId" …'), {
    cause,
  })

describe('isConnectionError', () => {
  it('recognises the pg error raised when a socket ends mid-query', () => {
    expect(
      isConnectionError(
        drizzleWrapped(new Error('Connection terminated unexpectedly'))
      )
    ).toBe(true)
  })

  it('recognises socket-level failure codes', () => {
    const reset = Object.assign(new Error('read ECONNRESET'), {
      code: 'ECONNRESET',
    })

    expect(isConnectionError(drizzleWrapped(reset))).toBe(true)
  })

  it('recognises a server-side connection SQLSTATE', () => {
    const adminShutdown = Object.assign(
      new Error('terminating connection due to administrator command'),
      { code: '57P01' }
    )

    expect(isConnectionError(drizzleWrapped(adminShutdown))).toBe(true)
  })

  it('unwraps an AggregateError, which pool shutdown produces', () => {
    const aggregate = new AggregateError([
      new Error('unrelated'),
      new Error('Connection terminated unexpectedly'),
    ])

    expect(isConnectionError(aggregate)).toBe(true)
  })

  it('does not treat a query-level failure as a connection failure', () => {
    const constraint = Object.assign(
      new Error('duplicate key value violates unique constraint'),
      { code: '23505' }
    )

    expect(isConnectionError(drizzleWrapped(constraint))).toBe(false)
    expect(
      isConnectionError(new Error('syntax error at or near "slect"'))
    ).toBe(false)
    expect(isConnectionError(undefined)).toBe(false)
    expect(isConnectionError('not an error')).toBe(false)
  })

  it('terminates on a self-referencing cause chain', () => {
    const looping: { message: string; cause?: unknown } = { message: 'boom' }
    looping.cause = looping

    expect(isConnectionError(looping)).toBe(false)
  })
})

describe('withDatabaseRetry', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('returns the first successful result without retrying', async () => {
    const read = vi.fn().mockResolvedValue(['row'])

    await expect(withDatabaseRetry(read, { context: 'test' })).resolves.toEqual(
      ['row']
    )
    expect(read).toHaveBeenCalledTimes(1)
    expect(mockLogError).not.toHaveBeenCalled()
  })

  it('retries a dropped connection and succeeds on a fresh socket', async () => {
    const read = vi
      .fn()
      .mockRejectedValueOnce(
        drizzleWrapped(new Error('Connection terminated unexpectedly'))
      )
      .mockResolvedValue(['row'])

    await expect(
      withDatabaseRetry(read, {
        context: 'affinity_purchase_pairs',
        baseDelayMs: 0,
      })
    ).resolves.toEqual(['row'])
    expect(read).toHaveBeenCalledTimes(2)
  })

  it('records the retry so a flapping connection stays visible', async () => {
    const read = vi
      .fn()
      .mockRejectedValueOnce(new Error('Connection terminated unexpectedly'))
      .mockResolvedValue('ok')

    await withDatabaseRetry(read, {
      context: 'affinity_share_pairs',
      baseDelayMs: 0,
    })

    expect(mockLogError).toHaveBeenCalledWith(
      expect.objectContaining({
        context: 'database_connection_retry',
        additionalInfo: expect.objectContaining({
          operation: 'affinity_share_pairs',
          attempt: 1,
          remainingAttempts: 1,
        }),
      })
    )
  })

  it('rethrows once the attempt budget is spent', async () => {
    const failure = new Error('Connection terminated unexpectedly')
    const read = vi.fn().mockRejectedValue(failure)

    await expect(
      withDatabaseRetry(read, { context: 'test', attempts: 3, baseDelayMs: 0 })
    ).rejects.toBe(failure)
    expect(read).toHaveBeenCalledTimes(3)
  })

  it('does not retry a failure the connection cannot explain', async () => {
    const failure = Object.assign(new Error('duplicate key'), { code: '23505' })
    const read = vi.fn().mockRejectedValue(failure)

    await expect(withDatabaseRetry(read, { context: 'test' })).rejects.toBe(
      failure
    )
    expect(read).toHaveBeenCalledTimes(1)
  })

  it('doubles the delay between attempts instead of hammering the server', async () => {
    vi.useFakeTimers()
    const read = vi
      .fn()
      .mockRejectedValueOnce(new Error('Connection terminated unexpectedly'))
      .mockRejectedValueOnce(new Error('Connection terminated unexpectedly'))
      .mockResolvedValue('ok')

    const pending = withDatabaseRetry(read, {
      context: 'test',
      attempts: 3,
      baseDelayMs: 100,
    })

    await vi.advanceTimersByTimeAsync(0)
    expect(read).toHaveBeenCalledTimes(1)

    await vi.advanceTimersByTimeAsync(99)
    expect(read).toHaveBeenCalledTimes(1)
    await vi.advanceTimersByTimeAsync(1)
    expect(read).toHaveBeenCalledTimes(2)

    // The second backoff is 200ms, not another 100ms.
    await vi.advanceTimersByTimeAsync(199)
    expect(read).toHaveBeenCalledTimes(2)
    await vi.advanceTimersByTimeAsync(1)
    expect(read).toHaveBeenCalledTimes(3)

    await expect(pending).resolves.toBe('ok')
  })
})
