import { describe, it, expect, vi, beforeEach } from 'vitest'

const { mockExpireDueReservations, mockLogBusinessEvent } = vi.hoisted(() => ({
  mockExpireDueReservations: vi.fn(),
  mockLogBusinessEvent: vi.fn(),
}))

vi.mock('@/features/orders/services/stock-reservation', () => ({
  RESERVATION_EXPIRY_BATCH_SIZE: 500,
  expireDueReservations: mockExpireDueReservations,
}))

vi.mock('@/lib/logger', () => ({ logBusinessEvent: mockLogBusinessEvent }))

import {
  RESERVATION_EXPIRY_RETRIES,
  expireStockReservationsFunction,
} from '@/lib/inngest/functions/stock-reservations'
import { SCORE_NAMES } from '@/lib/inngest/scores'

type FunctionInternals = {
  opts: {
    id: string
    retries: number
    triggers: ReadonlyArray<{ cron?: string }>
  }
  fn: (context: { step: unknown }) => Promise<{
    reservations: number
    quantity: number
    drained: boolean
  }>
}

const internals = expireStockReservationsFunction as unknown as FunctionInternals

const scores: Array<{ name: string; value: number | boolean }> = []

const step = {
  run: (_id: string, handler: () => unknown) => Promise.resolve(handler()),
  score: (_id: string, score: { name: string; value: number | boolean }) => {
    scores.push(score)
    return Promise.resolve(undefined)
  },
}

const run = () => internals.fn({ step })

beforeEach(() => {
  vi.clearAllMocks()
  scores.length = 0
})

describe('expireStockReservationsFunction', () => {
  it('sweeps every five minutes with a bounded retry budget', () => {
    expect(internals.opts.id).toBe('expire-stock-reservations')
    expect(internals.opts.triggers).toEqual([{ cron: '*/5 * * * *' }])
    expect(internals.opts.retries).toBe(RESERVATION_EXPIRY_RETRIES)
  })

  it('claims a bounded batch and reports a drained backlog', async () => {
    mockExpireDueReservations.mockResolvedValue({
      reservations: 3,
      quantity: 7,
    })

    const result = await run()

    expect(mockExpireDueReservations).toHaveBeenCalledWith(500)
    expect(result).toEqual({ reservations: 3, quantity: 7, drained: true })
    expect(scores).toEqual([
      { name: SCORE_NAMES.reservationExpirySweepDrained, value: true },
    ])
    expect(mockLogBusinessEvent).toHaveBeenCalledWith(
      expect.objectContaining({ event: 'cron_stock_reservations_expired' })
    )
  })

  it('reports an undrained backlog when the batch fills', async () => {
    mockExpireDueReservations.mockResolvedValue({
      reservations: 500,
      quantity: 900,
    })

    const result = await run()

    expect(result.drained).toBe(false)
    expect(scores).toEqual([
      { name: SCORE_NAMES.reservationExpirySweepDrained, value: false },
    ])
  })

  it('stays quiet when there is nothing to expire', async () => {
    mockExpireDueReservations.mockResolvedValue({
      reservations: 0,
      quantity: 0,
    })

    const result = await run()

    expect(result).toEqual({ reservations: 0, quantity: 0, drained: true })
    expect(mockLogBusinessEvent).not.toHaveBeenCalled()
  })

  it('lets a sweep failure surface so Inngest retries it', async () => {
    mockExpireDueReservations.mockRejectedValue(new Error('connection reset'))

    await expect(run()).rejects.toThrow('connection reset')
  })
})
