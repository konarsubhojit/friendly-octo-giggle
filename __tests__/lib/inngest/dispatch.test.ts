import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

const { mockSend, mockIsInngestConfigured, mockLogError } = vi.hoisted(() => ({
  mockSend: vi.fn(),
  mockIsInngestConfigured: vi.fn(),
  mockLogError: vi.fn(),
}))

vi.mock('@/lib/inngest/client', () => ({
  inngest: { send: mockSend },
  isInngestConfigured: mockIsInngestConfigured,
}))

vi.mock('@/lib/logger', () => ({
  logError: mockLogError,
}))

import {
  INNGEST_PUBLISH_TIMEOUT_MS,
  InngestPublishTimeoutError,
  dispatchWorkflowEvent,
  publishWithTimeout,
} from '@/lib/inngest/dispatch'

// The publish seam accepts whatever `inngest.send` accepts; the tests only
// care that the payload is forwarded untouched.
const EVENT = { name: 'order/created', data: { orderId: 'ord1' } } as never

describe('publishWithTimeout', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('forwards the payload to inngest.send', async () => {
    mockSend.mockResolvedValue({ ids: ['evt1'] })

    await expect(publishWithTimeout(EVENT)).resolves.toBeUndefined()
    expect(mockSend).toHaveBeenCalledWith(EVENT)
  })

  it('rejects once the budget elapses without holding the caller open', async () => {
    vi.useFakeTimers()
    mockSend.mockReturnValue(new Promise(() => {}))

    const pending = publishWithTimeout(EVENT)
    const assertion = expect(pending).rejects.toBeInstanceOf(
      InngestPublishTimeoutError
    )
    await vi.advanceTimersByTimeAsync(INNGEST_PUBLISH_TIMEOUT_MS)
    await assertion
  })

  it('does not surface a late rejection as an unhandled rejection', async () => {
    vi.useFakeTimers()
    let rejectPublish: (error: Error) => void = () => {}
    mockSend.mockReturnValue(
      new Promise((_resolve, reject) => {
        rejectPublish = reject
      })
    )

    const pending = publishWithTimeout(EVENT)
    const assertion = expect(pending).rejects.toBeInstanceOf(
      InngestPublishTimeoutError
    )
    await vi.advanceTimersByTimeAsync(INNGEST_PUBLISH_TIMEOUT_MS)
    await assertion

    rejectPublish(new Error('late failure'))
    await vi.advanceTimersByTimeAsync(0)
  })

  it('propagates a publish failure that happens inside the budget', async () => {
    mockSend.mockRejectedValue(new Error('inngest down'))

    await expect(publishWithTimeout(EVENT)).rejects.toThrow('inngest down')
  })
})

describe('dispatchWorkflowEvent', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockIsInngestConfigured.mockReturnValue(true)
    mockSend.mockResolvedValue({ ids: ['evt1'] })
  })

  it('publishes and skips the fallback when Inngest is configured', async () => {
    const fallback = vi.fn()

    const result = await dispatchWorkflowEvent({
      event: EVENT,
      context: 'test_publish_failed',
      fallback,
    })

    expect(result).toBe('published')
    expect(mockSend).toHaveBeenCalledWith(EVENT)
    expect(fallback).not.toHaveBeenCalled()
    expect(mockLogError).not.toHaveBeenCalled()
  })

  it('runs the fallback without publishing when Inngest is unconfigured', async () => {
    mockIsInngestConfigured.mockReturnValue(false)
    const fallback = vi.fn().mockResolvedValue(undefined)

    const result = await dispatchWorkflowEvent({
      event: EVENT,
      context: 'test_publish_failed',
      fallback,
    })

    expect(result).toBe('fallback')
    expect(mockSend).not.toHaveBeenCalled()
    expect(fallback).toHaveBeenCalledOnce()
  })

  it('logs and falls back when the publish fails', async () => {
    mockSend.mockRejectedValue(new Error('inngest down'))
    const fallback = vi.fn().mockResolvedValue(undefined)

    const result = await dispatchWorkflowEvent({
      event: EVENT,
      context: 'test_publish_failed',
      details: { orderId: 'ord1' },
      fallback,
    })

    expect(result).toBe('fallback')
    expect(mockLogError).toHaveBeenCalledWith(
      expect.objectContaining({
        context: 'test_publish_failed',
        additionalInfo: { orderId: 'ord1' },
      })
    )
    expect(fallback).toHaveBeenCalledOnce()
  })

  it('reports the work as dropped when no fallback is supplied', async () => {
    mockIsInngestConfigured.mockReturnValue(false)

    const result = await dispatchWorkflowEvent({
      event: EVENT,
      context: 'test_publish_failed',
    })

    expect(result).toBe('dropped')
  })

  it('logs rather than rethrows when the fallback itself fails', async () => {
    mockIsInngestConfigured.mockReturnValue(false)
    const fallback = vi.fn().mockRejectedValue(new Error('smtp down'))

    const result = await dispatchWorkflowEvent({
      event: EVENT,
      context: 'test_publish_failed',
      fallback,
    })

    // The caller's primary state change is already durable by this point, so
    // a telemetry-only failure must not fail their request.
    expect(result).toBe('fallback')
    expect(mockLogError).toHaveBeenCalledWith(
      expect.objectContaining({
        context: 'test_publish_failed_fallback_failed',
      })
    )
  })
})
