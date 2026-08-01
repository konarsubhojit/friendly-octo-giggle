import { beforeEach, afterEach, describe, expect, it, vi } from 'vitest'
import { NextRequest } from 'next/server'

const {
  mockAuth,
  mockGetCheckoutRequestStatusForUser,
  mockIsCheckoutRequestError,
  mockSubscribeToCheckoutStatus,
  mockLogError,
} = vi.hoisted(() => ({
  mockAuth: vi.fn(),
  mockGetCheckoutRequestStatusForUser: vi.fn(),
  mockIsCheckoutRequestError: vi.fn(),
  mockSubscribeToCheckoutStatus: vi.fn(),
  mockLogError: vi.fn(),
}))

vi.mock('@/lib/api-middleware', () => ({
  withLogging: vi.fn((handler) => handler),
}))

vi.mock('@/lib/auth', () => ({
  auth: mockAuth,
}))

vi.mock('@/features/cart/services/checkout-service', () => ({
  getCheckoutRequestStatusForUser: mockGetCheckoutRequestStatusForUser,
  isCheckoutRequestError: mockIsCheckoutRequestError,
}))

vi.mock('@/lib/inngest/realtime', async () => {
  const actual = await vi.importActual<
    typeof import('@/lib/inngest/realtime')
  >('@/lib/inngest/realtime')
  return {
    isTerminalCheckoutStatus: actual.isTerminalCheckoutStatus,
    subscribeToCheckoutStatus: mockSubscribeToCheckoutStatus,
  }
})

vi.mock('@/lib/logger', () => ({
  logError: mockLogError,
}))

import {
  GET,
  CHECKOUT_STREAM_FALLBACK_INTERVAL_MS,
  CHECKOUT_STREAM_WINDOW_MS,
} from '@/app/api/checkout/[id]/stream/route'

const SESSION = { user: { id: 'user1', name: 'Test', email: 't@example.com' } }
const PENDING = {
  checkoutRequestId: 'chk1234',
  status: 'PENDING',
  orderId: null,
  error: null,
}
const COMPLETED = {
  checkoutRequestId: 'chk1234',
  status: 'COMPLETED',
  orderId: 'ORDabc1234',
  error: null,
}

const call = (id = 'chk1234') =>
  GET(new NextRequest(`http://localhost/api/checkout/${id}/stream`), {
    params: Promise.resolve({ id }),
  })

/** Drain the SSE body and return the payload of every `data:` frame. */
const readEvents = async (response: Response): Promise<unknown[]> => {
  const body = await response.text()
  return body
    .split('\n\n')
    .filter((frame) => frame.startsWith('data: '))
    .map((frame) => JSON.parse(frame.slice('data: '.length)))
}

describe('GET /api/checkout/[id]/stream', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockAuth.mockResolvedValue(SESSION)
    mockIsCheckoutRequestError.mockReturnValue(false)
    mockSubscribeToCheckoutStatus.mockResolvedValue(null)
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('returns 401 when not authenticated', async () => {
    mockAuth.mockResolvedValue(null)

    const response = await call()

    expect(response.status).toBe(401)
    await expect(response.json()).resolves.toEqual({
      error: 'Authentication required',
    })
    expect(mockSubscribeToCheckoutStatus).not.toHaveBeenCalled()
  })

  it("returns 404 without subscribing to another user's request", async () => {
    mockGetCheckoutRequestStatusForUser.mockRejectedValue({
      message: 'Checkout request not found',
      status: 404,
    })
    mockIsCheckoutRequestError.mockReturnValue(true)

    const response = await call()

    expect(response.status).toBe(404)
    await expect(response.json()).resolves.toEqual({
      error: 'Checkout request not found',
    })
    expect(mockSubscribeToCheckoutStatus).not.toHaveBeenCalled()
  })

  it('returns 500 when the status read fails unexpectedly', async () => {
    mockGetCheckoutRequestStatusForUser.mockRejectedValue(new Error('db down'))

    const response = await call()

    expect(response.status).toBe(500)
    expect(mockLogError).toHaveBeenCalledWith(
      expect.objectContaining({ context: 'checkout_request_stream' })
    )
  })

  it('scopes the status read to the signed-in user', async () => {
    mockGetCheckoutRequestStatusForUser.mockResolvedValue(COMPLETED)

    await call()

    expect(mockGetCheckoutRequestStatusForUser).toHaveBeenCalledWith({
      checkoutRequestId: 'chk1234',
      userId: 'user1',
    })
  })

  it('streams an already settled request and closes immediately', async () => {
    mockGetCheckoutRequestStatusForUser.mockResolvedValue(COMPLETED)

    const response = await call()

    expect(response.headers.get('Content-Type')).toBe(
      'text/event-stream; charset=utf-8'
    )
    expect(response.headers.get('Cache-Control')).toBe('no-cache, no-transform')
    expect(response.headers.get('X-Accel-Buffering')).toBe('no')
    await expect(readEvents(response)).resolves.toEqual([COMPLETED])
  })

  it('pushes the settlement announced on the realtime channel', async () => {
    mockGetCheckoutRequestStatusForUser.mockResolvedValue(PENDING)
    const close = vi.fn()
    mockSubscribeToCheckoutStatus.mockImplementation(async ({ onMessage }) => {
      queueMicrotask(() => onMessage(COMPLETED))
      return { close }
    })

    const response = await call()

    await expect(readEvents(response)).resolves.toEqual([PENDING, COMPLETED])
    expect(close).toHaveBeenCalled()
  })

  it('catches a settlement announced while the subscription was connecting', async () => {
    mockGetCheckoutRequestStatusForUser
      .mockResolvedValueOnce(PENDING)
      .mockResolvedValue(COMPLETED)
    mockSubscribeToCheckoutStatus.mockResolvedValue({ close: vi.fn() })

    const response = await call()

    await expect(readEvents(response)).resolves.toEqual([PENDING, COMPLETED])
    expect(mockGetCheckoutRequestStatusForUser).toHaveBeenCalledTimes(2)
  })

  it('settles from the status re-read when realtime is unavailable', async () => {
    vi.useFakeTimers()
    mockGetCheckoutRequestStatusForUser
      .mockResolvedValueOnce(PENDING)
      .mockResolvedValueOnce(PENDING)
      .mockResolvedValue(COMPLETED)

    const response = await call()
    const events = readEvents(response)
    await vi.advanceTimersByTimeAsync(CHECKOUT_STREAM_FALLBACK_INTERVAL_MS)

    await expect(events).resolves.toEqual([PENDING, COMPLETED])
  })

  it('closes the connection at the end of the window so the browser reconnects', async () => {
    vi.useFakeTimers()
    mockGetCheckoutRequestStatusForUser.mockResolvedValue(PENDING)
    const close = vi.fn()
    mockSubscribeToCheckoutStatus.mockResolvedValue({ close })

    const response = await call()
    const events = readEvents(response)
    await vi.advanceTimersByTimeAsync(CHECKOUT_STREAM_WINDOW_MS)

    await expect(events).resolves.toEqual([PENDING])
    expect(close).toHaveBeenCalled()
  })

  it('ends the stream when a re-read starts failing', async () => {
    vi.useFakeTimers()
    mockGetCheckoutRequestStatusForUser
      .mockResolvedValueOnce(PENDING)
      .mockRejectedValue(new Error('db down'))

    const response = await call()
    const events = readEvents(response)
    await vi.advanceTimersByTimeAsync(CHECKOUT_STREAM_FALLBACK_INTERVAL_MS)

    await expect(events).resolves.toEqual([PENDING])
    expect(mockLogError).toHaveBeenCalledWith(
      expect.objectContaining({ context: 'checkout_stream_recheck_failed' })
    )
  })
})
