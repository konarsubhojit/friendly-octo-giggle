import { beforeEach, describe, expect, it, vi } from 'vitest'

const mockProcessCheckoutRequestById = vi.hoisted(() => vi.fn())
const mockRecoverCheckoutRequestAfterRetryExhaustion = vi.hoisted(() => vi.fn())

vi.mock('@vercel/queue', () => ({
  QueueClient: class {
    handleCallback = vi.fn((handler) => handler)
  },
}))

vi.mock('@/features/cart/services/checkout-service', () => ({
  processCheckoutRequestById: mockProcessCheckoutRequestById,
  recoverCheckoutRequestAfterRetryExhaustion:
    mockRecoverCheckoutRequestAfterRetryExhaustion,
}))

const invokePost = async (checkoutRequestId: string, deliveryCount: number) => {
  const { POST } = await import('@/app/api/queue/checkout-orders/route')

  await (
    POST as unknown as (
      message: { checkoutRequestId: string },
      metadata: { deliveryCount: number }
    ) => Promise<void>
  )({ checkoutRequestId }, { deliveryCount })
}

describe('POST /api/queue/checkout-orders', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('processes a valid checkout request message', async () => {
    await invokePost('ABC1234', 1)

    expect(mockProcessCheckoutRequestById).toHaveBeenCalledWith('ABC1234')
    expect(
      mockRecoverCheckoutRequestAfterRetryExhaustion
    ).not.toHaveBeenCalled()
  })

  it('lets transient failures retry before exhaustion', async () => {
    const error = new Error('temporary outage')
    mockProcessCheckoutRequestById.mockRejectedValue(error)

    await expect(invokePost('ABC1234', 2)).rejects.toThrow('temporary outage')

    expect(
      mockRecoverCheckoutRequestAfterRetryExhaustion
    ).not.toHaveBeenCalled()
  })

  it('marks the request failed automatically after retry exhaustion', async () => {
    const error = new Error('database unavailable')
    mockProcessCheckoutRequestById.mockRejectedValue(error)

    await invokePost('ABC1234', 5)

    expect(mockRecoverCheckoutRequestAfterRetryExhaustion).toHaveBeenCalledWith(
      {
        checkoutRequestId: 'ABC1234',
        deliveryCount: 5,
        error,
      }
    )
  })
})
