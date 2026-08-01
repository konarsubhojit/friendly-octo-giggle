import { describe, it, expect, vi, beforeEach } from 'vitest'

const {
  mockPreflightCheckoutRequest,
  mockResolveCheckoutSettlement,
  mockClaimCheckoutRequest,
  mockCreateOrderForCheckoutRequest,
  mockRecordCheckoutProcessingFailure,
  mockRecoverCheckoutRequestAfterRetryExhaustion,
  mockLogError,
} = vi.hoisted(() => ({
  mockPreflightCheckoutRequest: vi.fn(),
  mockResolveCheckoutSettlement: vi.fn(),
  mockClaimCheckoutRequest: vi.fn(),
  mockCreateOrderForCheckoutRequest: vi.fn(),
  mockRecordCheckoutProcessingFailure: vi.fn(),
  mockRecoverCheckoutRequestAfterRetryExhaustion: vi.fn(),
  mockLogError: vi.fn(),
}))

vi.mock('@/features/cart/services/checkout-service', () => ({
  preflightCheckoutRequest: mockPreflightCheckoutRequest,
  resolveCheckoutSettlement: mockResolveCheckoutSettlement,
  claimCheckoutRequest: mockClaimCheckoutRequest,
  createOrderForCheckoutRequest: mockCreateOrderForCheckoutRequest,
  recordCheckoutProcessingFailure: mockRecordCheckoutProcessingFailure,
  recoverCheckoutRequestAfterRetryExhaustion:
    mockRecoverCheckoutRequestAfterRetryExhaustion,
}))

vi.mock('@/lib/logger', () => ({
  logError: mockLogError,
}))

import { NonRetriableError } from 'inngest'
import {
  CHECKOUT_FUNCTION_RETRIES,
  handleCheckoutRequestFailure,
  processCheckoutRequestFunction,
  runCheckoutRequestSteps,
  type CheckoutStepRunner,
} from '@/features/cart/inngest/checkout'
import { checkoutRequestCreated } from '@/features/cart/inngest/events'

const CHECKOUT_REQUEST_ID = 'cr12345'

/**
 * Fake step runner that executes handlers eagerly and records their ids, which
 * is how Inngest behaves on a first attempt with no memoized state.
 */
const createStepRunner = () => {
  const ids: string[] = []
  const scores: { name: string; value: number | boolean }[] = []
  const step: CheckoutStepRunner = {
    run: async (id, handler) => {
      ids.push(id)
      return handler()
    },
    score: async (id, score) => {
      ids.push(id)
      scores.push(score)
    },
  }
  return { step, ids, scores }
}

describe('processCheckoutRequestFunction', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockPreflightCheckoutRequest.mockResolvedValue({ action: 'process' })
    mockClaimCheckoutRequest.mockResolvedValue(true)
    mockCreateOrderForCheckoutRequest.mockResolvedValue('ord1234')
    mockRecordCheckoutProcessingFailure.mockResolvedValue({ terminal: false })
  })

  it('is registered with retry parity and per-request serialisation', () => {
    const config = processCheckoutRequestFunction.opts as {
      retries?: number
      idempotency?: string
      concurrency?: { key?: string; limit?: number }
    }

    expect(config.retries).toBe(CHECKOUT_FUNCTION_RETRIES)
    expect(config.idempotency).toBe('event.data.checkoutRequestId')
    expect(config.concurrency).toEqual({
      key: 'event.data.checkoutRequestId',
      limit: 1,
    })
  })

  it('runs preflight, claim and order creation as separate checkpoints', async () => {
    const { step, ids } = createStepRunner()

    const result = await runCheckoutRequestSteps({
      event: { data: { checkoutRequestId: CHECKOUT_REQUEST_ID } },
      step,
    })

    expect(ids).toEqual([
      'mark-start',
      'preflight-checkout-request',
      'claim-checkout-request',
      'create-order',
      'score-outcome',
      'score-stock-conflict',
      'score-payment-first-attempt',
      'score-latency',
      'score-slo',
    ])
    expect(result).toEqual({
      checkoutRequestId: CHECKOUT_REQUEST_ID,
      orderId: 'ord1234',
      outcome: 'completed',
    })
  })

  it('checkpoints only a serialisable projection of the preflight result', async () => {
    mockPreflightCheckoutRequest.mockResolvedValue({
      action: 'process',
      checkoutRequest: { id: CHECKOUT_REQUEST_ID, createdAt: new Date() },
    })
    const checkpoints: unknown[] = []
    const step: CheckoutStepRunner = {
      run: async (_id, handler) => {
        const value = await handler()
        checkpoints.push(value)
        return value
      },
      score: async () => {},
    }

    await runCheckoutRequestSteps({
      event: { data: { checkoutRequestId: CHECKOUT_REQUEST_ID } },
      step,
    })

    expect(checkpoints[1]).toEqual({ action: 'process' })
  })

  it('stops without claiming when preflight says the request is settled', async () => {
    mockPreflightCheckoutRequest.mockResolvedValue({
      action: 'skip',
      reason: 'order_exists',
    })
    const { step, ids } = createStepRunner()

    const result = await runCheckoutRequestSteps({
      event: { data: { checkoutRequestId: CHECKOUT_REQUEST_ID } },
      step,
    })

    expect(result).toEqual({
      checkoutRequestId: CHECKOUT_REQUEST_ID,
      outcome: 'skipped',
      reason: 'order_exists',
    })
    expect(ids).toEqual([
      'mark-start',
      'preflight-checkout-request',
      'score-outcome',
    ])
    expect(mockClaimCheckoutRequest).not.toHaveBeenCalled()
  })

  it('stops when another worker holds the claim and the request is settled', async () => {
    mockClaimCheckoutRequest.mockResolvedValue(false)
    mockResolveCheckoutSettlement.mockResolvedValue({
      settled: true,
      reason: 'order_exists',
    })
    const { step } = createStepRunner()

    const result = await runCheckoutRequestSteps({
      event: { data: { checkoutRequestId: CHECKOUT_REQUEST_ID } },
      step,
    })

    expect(result).toEqual({
      checkoutRequestId: CHECKOUT_REQUEST_ID,
      outcome: 'already-processing',
      reason: 'order_exists',
    })
    expect(mockCreateOrderForCheckoutRequest).not.toHaveBeenCalled()
  })

  it('retries instead of exiting when the claim fails but the request is unsettled', async () => {
    mockClaimCheckoutRequest.mockResolvedValue(false)
    mockResolveCheckoutSettlement.mockResolvedValue({
      settled: false,
      checkoutRequest: { id: CHECKOUT_REQUEST_ID },
    })
    const { step } = createStepRunner()

    // Walking away here would strand the request: nothing else can pick it up
    // once it is stuck in PROCESSING.
    await expect(
      runCheckoutRequestSteps({
        event: { data: { checkoutRequestId: CHECKOUT_REQUEST_ID } },
        step,
      })
    ).rejects.toThrow(/claimed but unsettled/)
    expect(mockCreateOrderForCheckoutRequest).not.toHaveBeenCalled()
  })

  it('does not re-emit the queue lag sample when re-checking a failed claim', async () => {
    mockClaimCheckoutRequest.mockResolvedValue(false)
    mockResolveCheckoutSettlement.mockResolvedValue({
      settled: true,
      reason: 'already_settled',
    })
    const { step } = createStepRunner()

    await runCheckoutRequestSteps({
      event: { data: { checkoutRequestId: CHECKOUT_REQUEST_ID } },
      step,
    })

    // Preflight owns the lag metric, so re-checking must not run it again.
    expect(mockPreflightCheckoutRequest).toHaveBeenCalledTimes(1)
  })

  it('marks client-side failures non-retriable so Inngest stops immediately', async () => {
    const failure = Object.assign(new Error('Payment declined'), {
      status: 400,
    })
    mockCreateOrderForCheckoutRequest.mockRejectedValue(failure)
    mockRecordCheckoutProcessingFailure.mockResolvedValue({ terminal: true })
    const { step } = createStepRunner()

    await expect(
      runCheckoutRequestSteps({
        event: { data: { checkoutRequestId: CHECKOUT_REQUEST_ID } },
        step,
      })
    ).rejects.toBeInstanceOf(NonRetriableError)
    expect(mockRecordCheckoutProcessingFailure).toHaveBeenCalledWith(
      CHECKOUT_REQUEST_ID,
      failure
    )
  })

  it('rethrows transient failures so the step is retried', async () => {
    const failure = Object.assign(new Error('Gateway timeout'), { status: 504 })
    mockCreateOrderForCheckoutRequest.mockRejectedValue(failure)
    const { step } = createStepRunner()

    await expect(
      runCheckoutRequestSteps({
        event: { data: { checkoutRequestId: CHECKOUT_REQUEST_ID } },
        step,
      })
    ).rejects.toBe(failure)
  })

  it('rejects a malformed event before touching the database', async () => {
    const { step } = createStepRunner()

    await expect(
      runCheckoutRequestSteps({
        event: { data: { checkoutRequestId: '' } },
        step,
      })
    ).rejects.toBeTruthy()
    expect(mockPreflightCheckoutRequest).not.toHaveBeenCalled()
  })
})

describe('handleCheckoutRequestFailure', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('settles the request once retries are exhausted', async () => {
    const error = new Error('boom')

    await handleCheckoutRequestFailure({
      originalEventData: { checkoutRequestId: CHECKOUT_REQUEST_ID },
      error,
    })

    expect(mockRecoverCheckoutRequestAfterRetryExhaustion).toHaveBeenCalledWith(
      {
        checkoutRequestId: CHECKOUT_REQUEST_ID,
        deliveryCount: CHECKOUT_FUNCTION_RETRIES + 1,
        error,
      }
    )
  })

  it('logs instead of throwing when the payload has no request id', async () => {
    await handleCheckoutRequestFailure({
      originalEventData: { nope: true },
      error: new Error('boom'),
    })

    expect(
      mockRecoverCheckoutRequestAfterRetryExhaustion
    ).not.toHaveBeenCalled()
    expect(mockLogError).toHaveBeenCalledWith(
      expect.objectContaining({
        context: 'inngest_checkout_failure_without_request_id',
      })
    )
  })
})

describe('checkoutRequestCreated', () => {
  it('publishes a payload carrying only the checkout request id', () => {
    const event = checkoutRequestCreated.create({
      checkoutRequestId: CHECKOUT_REQUEST_ID,
    })

    expect(event.name).toBe('checkout/request.created')
    expect(event.data).toEqual({ checkoutRequestId: CHECKOUT_REQUEST_ID })
  })
})
