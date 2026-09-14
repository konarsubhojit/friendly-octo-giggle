import { describe, it, expect, vi } from 'vitest'
import { createVercelDeferredRunner } from '@/lib/deferred/vercel'

const { mockLogError } = vi.hoisted(() => ({
  mockLogError: vi.fn(),
}))

vi.mock('@/lib/logger', () => ({
  logError: mockLogError,
}))

describe('createVercelDeferredRunner', () => {
  it('identifies itself as the vercel provider', () => {
    const runner = createVercelDeferredRunner()
    expect(runner.provider).toBe('vercel')
  })

  it('delegates to the real @vercel/functions waitUntil without throwing', () => {
    // `@vercel/functions`' `waitUntil` is a no-op outside a Vercel Fluid
    // Compute invocation context, so this exercises the lazy `require()`
    // delegation itself rather than mocking the vendor package (mirroring
    // `src/lib/cache/index.ts`, whose require()-based adapter loading is
    // likewise only covered indirectly through its adapter unit tests).
    const runner = createVercelDeferredRunner()
    expect(() => runner.waitUntil(Promise.resolve())).not.toThrow()
  })

  it('falls back to logging instead of throwing when the vendor call rejects the argument', async () => {
    // The vendor `waitUntil` throws a real, synchronous `TypeError` when its
    // argument isn't a thenable (see `node_modules/@vercel/functions/wait-until.js`).
    // Used here instead of mocking the vendor package, to exercise the
    // runner's real fallback path with no assumptions about vendor internals.
    mockLogError.mockClear()
    const runner = createVercelDeferredRunner()
    const notAPromise = 'not a promise' as unknown as Promise<unknown>

    expect(() => runner.waitUntil(notAPromise)).not.toThrow()

    await vi.waitFor(() => {
      expect(mockLogError).toHaveBeenCalledWith({
        error: expect.any(TypeError),
        context: 'deferred_work_failed',
      })
    })
  })
})
