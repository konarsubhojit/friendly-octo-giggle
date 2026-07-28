import { describe, it, expect, vi, beforeEach } from 'vitest'

const {
  mockPreflightCheckoutRequest,
  mockClaimCheckoutRequest,
  mockCreateOrderForCheckoutRequest,
  mockRecordCheckoutProcessingFailure,
  mockRecoverCheckoutRequestAfterRetryExhaustion,
  mockLogError,
} = vi.hoisted(() => ({
  mockPreflightCheckoutRequest: vi.fn(),
  mockClaimCheckoutRequest: vi.fn(),
  mockCreateOrderForCheckoutRequest: vi.fn(),
  mockRecordCheckoutProcessingFailure: vi.fn(),
  mockRecoverCheckoutRequestAfterRetryExhaustion: vi.fn(),
  mockLogError: vi.fn(),
}))

vi.mock('@/features/cart/services/checkout-service', () => ({
  preflightCheckoutRequest: mockPreflightCheckoutRequest,
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
  const step: CheckoutStepRunner = {
    run: async (id, handler) => {
      ids.push(id)
      return handler()
    },
  }
  return { step, ids }
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
      'preflight-checkout-request',
      'claim-checkout-request',
      'create-order',
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
    }

    await runCheckoutRequestSteps({
      event: { data: { checkoutRequestId: CHECKOUT_REQUEST_ID } },
      step,
    })

    expect(checkpoints[0]).toEqual({ action: 'process' })
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
    expect(ids).toEqual(['preflight-checkout-request'])
    expect(mockClaimCheckoutRequest).not.toHaveBeenCalled()
  })

  it('stops when another worker holds the claim', async () => {
    mockClaimCheckoutRequest.mockResolvedValue(false)
    const { step } = createStepRunner()

    const result = await runCheckoutRequestSteps({
      event: { data: { checkoutRequestId: CHECKOUT_REQUEST_ID } },
      step,
    })

    expect(result).toEqual({
      checkoutRequestId: CHECKOUT_REQUEST_ID,
      outcome: 'already-processing',
    })
    expect(mockCreateOrderForCheckoutRequest).not.toHaveBeenCalled()
  })

  it('marks client-side failures non-retriable so Inngest stops immediately', async () => {
    const failure = Object.assign(new Error('Payment declined'), { status: 400 })
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
      runCheckoutRequestSteps({ event: { data: { checkoutRequestId: '' } }, step })
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

    expect(mockRecoverCheckoutRequestAfterRetryExhaustion).toHaveBeenCalledWith({
      checkoutRequestId: CHECKOUT_REQUEST_ID,
      deliveryCount: CHECKOUT_FUNCTION_RETRIES + 1,
      error,
    })
  })

  it('logs instead of throwing when the payload has no request id', async () => {
    await handleCheckoutRequestFailure({
      originalEventData: { nope: true },
      error: new Error('boom'),
    })

    expect(mockRecoverCheckoutRequestAfterRetryExhaustion).not.toHaveBeenCalled()
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
