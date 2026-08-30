import { beforeEach, describe, expect, it, vi } from 'vitest'

const {
  mockGetRetriableFailedEmails,
  mockRetryFailedEmail,
  mockLogBusinessEvent,
  mockLogError,
} = vi.hoisted(() => ({
  mockGetRetriableFailedEmails: vi.fn(),
  mockRetryFailedEmail: vi.fn(),
  mockLogBusinessEvent: vi.fn(),
  mockLogError: vi.fn(),
}))

vi.mock('@/lib/email/failed-emails', () => ({
  getRetriableFailedEmails: mockGetRetriableFailedEmails,
  retryFailedEmail: mockRetryFailedEmail,
}))

vi.mock('@/lib/logger', () => ({
  logBusinessEvent: mockLogBusinessEvent,
  logError: mockLogError,
}))

import {
  EMAIL_RETRY_BATCH_SIZE,
  emailDeliveryFailed,
  retryFailedEmailsFunction,
  retrySingleEmailFunction,
} from '@/lib/inngest/functions/email-retry'
import { SCORE_NAMES } from '@/lib/inngest/scores'

type FunctionInternals = {
  opts: {
    id: string
    retries?: number
    concurrency?: { limit: number }
    throttle?: { limit: number; period: string }
  }
  fn: (context: {
    event?: {
      data:
        | { emails: Array<{ failedEmailId: string }> }
        | { failedEmailId: string }
    }
    step: {
      run: (id: string, handler: () => unknown) => Promise<unknown>
      sendEvent?: (id: string, events: unknown[]) => Promise<unknown>
      score?: (
        id: string,
        score: { name: string; value: number | boolean }
      ) => Promise<unknown>
    }
  }) => Promise<unknown>
}

const internals = (fn: unknown) => fn as FunctionInternals

beforeEach(() => {
  vi.clearAllMocks()
})

describe('retryFailedEmailsFunction', () => {
  it('queues retriable rows in batches of ten', async () => {
    mockGetRetriableFailedEmails.mockResolvedValue(
      Array.from({ length: EMAIL_RETRY_BATCH_SIZE + 2 }, (_, index) => ({
        id: `failed-${index}`,
        emailType: 'order_confirmation',
        referenceId: `order-${index}`,
      }))
    )
    const sent: unknown[][] = []

    const result = await internals(retryFailedEmailsFunction).fn({
      step: {
        run: async (_id, handler) => handler(),
        sendEvent: async (_id, events) => {
          sent.push(events)
        },
      },
    })

    expect(result).toEqual({ queued: EMAIL_RETRY_BATCH_SIZE + 2 })
    expect(sent).toHaveLength(1)
    expect(sent[0]).toHaveLength(2)
    expect(sent[0]).toEqual([
      expect.objectContaining({
        data: expect.objectContaining({
          emails: expect.arrayContaining([
            expect.objectContaining({ failedEmailId: 'failed-0' }),
          ]),
        }),
      }),
      expect.objectContaining({
        data: {
          emails: [
            expect.objectContaining({ failedEmailId: 'failed-10' }),
            expect.objectContaining({ failedEmailId: 'failed-11' }),
          ],
        },
      }),
    ])
  })
})

describe('retrySingleEmailFunction', () => {
  it('preserves provider limits and disables layered retries', () => {
    const options = internals(retrySingleEmailFunction).opts

    expect(options.retries).toBe(0)
    expect(options.concurrency).toEqual({ limit: 5 })
    expect(options.throttle).toEqual({ limit: 30, period: '1m' })
  })

  it('bounds parallel retries inside one checkpoint and scores recovery', async () => {
    let active = 0
    let maxActive = 0
    mockRetryFailedEmail.mockImplementation(async (id: string) => {
      active += 1
      maxActive = Math.max(maxActive, active)
      await Promise.resolve()
      active -= 1
      return { id, success: id !== 'failed-2' }
    })
    const stepIds: string[] = []
    const scores: Array<{ name: string; value: number | boolean }> = []

    const result = await internals(retrySingleEmailFunction).fn({
      event: {
        data: {
          emails: [
            { failedEmailId: 'failed-1' },
            { failedEmailId: 'failed-2' },
          ],
        },
      },
      step: {
        run: async (id, handler) => {
          stepIds.push(id)
          return handler()
        },
        score: async (id, score) => {
          stepIds.push(id)
          scores.push(score)
        },
      },
    })

    expect(maxActive).toBe(2)
    expect(mockRetryFailedEmail).toHaveBeenNthCalledWith(1, 'failed-1')
    expect(mockRetryFailedEmail).toHaveBeenNthCalledWith(2, 'failed-2')
    expect(stepIds).toEqual(['retry-email-batch', 'score-retry-recovered'])
    expect(scores).toEqual([
      { name: SCORE_NAMES.emailRetryRecovered, value: 0.5 },
    ])
    expect(result).toEqual(
      expect.objectContaining({ attempted: 2, recovered: 1 })
    )
  })

  it('continues through a batch when one row throws unexpectedly', async () => {
    mockRetryFailedEmail
      .mockRejectedValueOnce(new Error('database unavailable'))
      .mockResolvedValueOnce({ id: 'failed-2', success: true })
    const scores: Array<{ name: string; value: number | boolean }> = []

    const result = await internals(retrySingleEmailFunction).fn({
      event: {
        data: {
          emails: [
            { failedEmailId: 'failed-1' },
            { failedEmailId: 'failed-2' },
          ],
        },
      },
      step: {
        run: async (_id, handler) => handler(),
        score: async (_id, score) => {
          scores.push(score)
        },
      },
    })

    expect(mockRetryFailedEmail).toHaveBeenCalledTimes(2)
    expect(result).toEqual(
      expect.objectContaining({ attempted: 2, recovered: 1 })
    )
    expect(scores).toEqual([
      { name: SCORE_NAMES.emailRetryRecovered, value: 0.5 },
    ])
  })

  it('rejects batches larger than ten at the event boundary', async () => {
    const validation = emailDeliveryFailed.schema['~standard'].validate({
      emails: Array.from({ length: EMAIL_RETRY_BATCH_SIZE + 1 }, (_, index) => ({
        failedEmailId: `failed-${index}`,
        emailType: 'order_confirmation',
        referenceId: `order-${index}`,
      })),
    })

    expect(validation).toEqual(
      expect.objectContaining({ issues: expect.any(Array) })
    )
  })

  it('accepts legacy single-email events while queued work drains', () => {
    const validation = emailDeliveryFailed.schema['~standard'].validate({
      failedEmailId: 'failed-legacy',
      emailType: 'order_confirmation',
      referenceId: 'order-legacy',
    })

    expect(validation).toEqual(
      expect.objectContaining({ value: expect.anything() })
    )
  })

  it('preserves the legacy memoization id for in-flight single-email runs', async () => {
    mockRetryFailedEmail.mockResolvedValue({
      id: 'failed-legacy',
      success: true,
    })
    const stepIds: string[] = []

    await internals(retrySingleEmailFunction).fn({
      event: { data: { failedEmailId: 'failed-legacy' } },
      step: {
        run: async (id, handler) => {
          stepIds.push(id)
          return handler()
        },
        score: async () => undefined,
      },
    })

    expect(stepIds).toEqual(['retry-email'])
  })

  it('normalizes a memoized legacy result without delivering twice', async () => {
    const scores: Array<{ name: string; value: number | boolean }> = []

    const result = await internals(retrySingleEmailFunction).fn({
      event: { data: { failedEmailId: 'failed-legacy' } },
      step: {
        run: async () => ({
          id: 'failed-legacy',
          success: true,
        }),
        score: async (_id, score) => {
          scores.push(score)
        },
      },
    })

    expect(mockRetryFailedEmail).not.toHaveBeenCalled()
    expect(result).toEqual(
      expect.objectContaining({ attempted: 1, recovered: 1 })
    )
    expect(scores).toEqual([
      { name: SCORE_NAMES.emailRetryRecovered, value: 1 },
    ])
  })
})
