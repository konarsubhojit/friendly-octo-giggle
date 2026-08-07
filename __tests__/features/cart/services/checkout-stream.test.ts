import { beforeEach, afterEach, describe, expect, it, vi } from 'vitest'
import {
  CHECKOUT_STREAM_RECONNECT_DELAY_MS,
  CHECKOUT_STREAM_TIMEOUT_MESSAGE,
  CheckoutFailedError,
  CheckoutTimeoutError,
  awaitCheckoutSettlement,
  parseStatusFrames,
} from '@/features/cart/services/checkout-stream'

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

const frame = (status: unknown) => `data: ${JSON.stringify(status)}\n\n`

/** A response body that emits the given chunks and then ends. */
const streamOf = (chunks: readonly string[]): ReadableStream<Uint8Array> => {
  const encoder = new TextEncoder()
  return new ReadableStream<Uint8Array>({
    start(controller) {
      for (const chunk of chunks) controller.enqueue(encoder.encode(chunk))
      controller.close()
    },
  })
}

const streamResponse = (chunks: readonly string[]) =>
  ({ ok: true, status: 200, body: streamOf(chunks) }) as Response

const mockFetch = vi.fn()

describe('parseStatusFrames', () => {
  it('returns every complete frame in the buffer', () => {
    const { statuses, rest } = parseStatusFrames(
      frame(PENDING) + frame(COMPLETED)
    )

    expect(statuses).toEqual([PENDING, COMPLETED])
    expect(rest).toBe('')
  })

  it('holds back a frame split across chunks', () => {
    const buffered = frame(PENDING) + 'data: {"status":"COMP'
    const { statuses, rest } = parseStatusFrames(buffered)

    expect(statuses).toEqual([PENDING])
    expect(rest).toBe('data: {"status":"COMP')
    expect(parseStatusFrames(rest + 'LETED"}\n\n').statuses).toEqual([
      { status: 'COMPLETED' },
    ])
  })

  it('drops heartbeat comments', () => {
    const { statuses } = parseStatusFrames(': ping\n\n' + frame(COMPLETED))

    expect(statuses).toEqual([COMPLETED])
  })

  it('skips a frame that is not valid JSON', () => {
    const { statuses } = parseStatusFrames(
      'data: not-json\n\n' + frame(COMPLETED)
    )

    expect(statuses).toEqual([COMPLETED])
  })

  it('skips a payload that is not a status', () => {
    const { statuses } = parseStatusFrames(
      'data: {"foo":1}\n\n' + frame(COMPLETED)
    )

    expect(statuses).toEqual([COMPLETED])
  })
})

describe('awaitCheckoutSettlement', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.stubGlobal('fetch', mockFetch)
  })

  afterEach(() => {
    vi.useRealTimers()
    vi.unstubAllGlobals()
  })

  it('resolves with the settled status', async () => {
    mockFetch.mockResolvedValue(streamResponse([frame(COMPLETED)]))

    await expect(
      awaitCheckoutSettlement({ checkoutRequestId: 'chk1234' })
    ).resolves.toEqual(COMPLETED)
    expect(mockFetch).toHaveBeenCalledWith(
      '/api/checkout/chk1234/stream',
      expect.objectContaining({ headers: { Accept: 'text/event-stream' } })
    )
  })

  it('reports intermediate statuses without ending the wait', async () => {
    const onProgress = vi.fn()
    mockFetch.mockResolvedValue(
      streamResponse([frame(PENDING), ': ping\n\n', frame(COMPLETED)])
    )

    await awaitCheckoutSettlement({ checkoutRequestId: 'chk1234', onProgress })

    expect(onProgress).toHaveBeenCalledTimes(1)
    expect(onProgress).toHaveBeenCalledWith(PENDING)
  })

  it('reassembles a status split across chunks', async () => {
    mockFetch.mockResolvedValue(
      streamResponse([
        `data: ${JSON.stringify(COMPLETED).slice(0, 20)}`,
        `${JSON.stringify(COMPLETED).slice(20)}\n\n`,
      ])
    )

    await expect(
      awaitCheckoutSettlement({ checkoutRequestId: 'chk1234' })
    ).resolves.toEqual(COMPLETED)
  })

  it('raises the failure reason when the request settles as FAILED', async () => {
    mockFetch.mockResolvedValue(
      streamResponse([
        frame({ ...PENDING, status: 'FAILED', error: 'Out of stock' }),
      ])
    )

    await expect(
      awaitCheckoutSettlement({ checkoutRequestId: 'chk1234' })
    ).rejects.toThrow(new CheckoutFailedError('Out of stock'))
  })

  it('falls back to a generic reason when the failure has no message', async () => {
    mockFetch.mockResolvedValue(
      streamResponse([frame({ ...PENDING, status: 'FAILED' })])
    )

    await expect(
      awaitCheckoutSettlement({ checkoutRequestId: 'chk1234' })
    ).rejects.toThrow('Checkout failed')
  })

  it('surfaces a missing checkout request', async () => {
    mockFetch.mockResolvedValue({ ok: false, status: 404 } as Response)

    await expect(
      awaitCheckoutSettlement({ checkoutRequestId: 'chk1234' })
    ).rejects.toThrow('Checkout request not found')
  })

  it('surfaces an unexpected stream failure', async () => {
    mockFetch.mockResolvedValue({ ok: false, status: 500 } as Response)

    await expect(
      awaitCheckoutSettlement({ checkoutRequestId: 'chk1234' })
    ).rejects.toThrow('Unable to follow checkout progress')
  })

  it('reopens the connection when the window closes before settlement', async () => {
    vi.useFakeTimers()
    mockFetch
      .mockResolvedValueOnce(streamResponse([frame(PENDING)]))
      .mockResolvedValueOnce(streamResponse([frame(COMPLETED)]))

    const settled = awaitCheckoutSettlement({ checkoutRequestId: 'chk1234' })
    await vi.advanceTimersByTimeAsync(CHECKOUT_STREAM_RECONNECT_DELAY_MS)

    await expect(settled).resolves.toEqual(COMPLETED)
    expect(mockFetch).toHaveBeenCalledTimes(2)
  })

  it('reconnects when the connection itself drops', async () => {
    vi.useFakeTimers()
    mockFetch
      .mockRejectedValueOnce(new Error('network down'))
      .mockResolvedValueOnce(streamResponse([frame(COMPLETED)]))

    const settled = awaitCheckoutSettlement({ checkoutRequestId: 'chk1234' })
    await vi.advanceTimersByTimeAsync(CHECKOUT_STREAM_RECONNECT_DELAY_MS)

    await expect(settled).resolves.toEqual(COMPLETED)
    expect(mockFetch).toHaveBeenCalledTimes(2)
  })

  it('gives up once the deadline has passed', async () => {
    await expect(
      awaitCheckoutSettlement({ checkoutRequestId: 'chk1234', deadlineMs: 0 })
    ).rejects.toThrow(new CheckoutTimeoutError())
    expect(CHECKOUT_STREAM_TIMEOUT_MESSAGE).toMatch(/check your orders/i)
    expect(mockFetch).not.toHaveBeenCalled()
  })
})
