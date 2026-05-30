import { beforeEach, describe, expect, it, vi } from 'vitest'
import { z } from 'zod'

const mockProcessCheckoutRequestById = vi.hoisted(() => vi.fn())
const mockRecoverCheckoutRequestAfterRetryExhaustion = vi.hoisted(() => vi.fn())
const QueueCallbackPayloadSchema = z.object({
  message: z.object({ checkoutRequestId: z.string() }),
  metadata: z.object({ deliveryCount: z.number() }),
})
const mockHandleCallback = vi.hoisted(() =>
  vi.fn((handler) => async (request: Request) => {
    const payload = QueueCallbackPayloadSchema.parse(await request.json())

    await handler(payload.message, payload.metadata)
    return new Response(null, { status: 200 })
  })
)

vi.mock('@/lib/queue', () => ({
  handleCallback: mockHandleCallback,
}))

vi.mock('@/features/cart/services/checkout-service', () => ({
  processCheckoutRequestById: mockProcessCheckoutRequestById,
  recoverCheckoutRequestAfterRetryExhaustion:
    mockRecoverCheckoutRequestAfterRetryExhaustion,
}))

const invokePost = async (checkoutRequestId: string, deliveryCount: number) => {
  const { POST } = await import('@/app/api/queue/checkout-orders/route')

  await POST(
    new Request('http://localhost/api/queue/checkout-orders', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        message: { checkoutRequestId },
        metadata: { deliveryCount },
      }),
    })
  )
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
