import { describe, it, expect, vi } from 'vitest'
import { createProcessDeferredRunner } from '@/lib/deferred/process'

const { mockLogError } = vi.hoisted(() => ({
  mockLogError: vi.fn(),
}))

vi.mock('@/lib/logger', () => ({
  logError: mockLogError,
}))

describe('createProcessDeferredRunner', () => {
  it('identifies itself as the process provider', () => {
    const runner = createProcessDeferredRunner()
    expect(runner.provider).toBe('process')
  })

  it('lets a resolved promise run to completion without logging', async () => {
    mockLogError.mockClear()
    const runner = createProcessDeferredRunner()
    let ran = false

    runner.waitUntil(
      Promise.resolve().then(() => {
        ran = true
      })
    )

    await vi.waitFor(() => expect(ran).toBe(true))
    expect(mockLogError).not.toHaveBeenCalled()
  })

  it('swallows a rejection and logs it instead of raising an unhandled rejection', async () => {
    mockLogError.mockClear()
    const runner = createProcessDeferredRunner()
    const error = new Error('boom')

    // If the rejection were left unhandled, this test process would abort
    // with an unhandled rejection error — the assertion below only proves
    // the promise resolves cleanly and is logged instead.
    runner.waitUntil(Promise.reject(error))

    await vi.waitFor(() => {
      expect(mockLogError).toHaveBeenCalledWith({
        error,
        context: 'deferred_work_failed',
      })
    })
  })
})
