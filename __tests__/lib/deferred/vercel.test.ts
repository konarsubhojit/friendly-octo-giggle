import { describe, it, expect } from 'vitest'
import { createVercelDeferredRunner } from '@/lib/deferred/vercel'

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
})
