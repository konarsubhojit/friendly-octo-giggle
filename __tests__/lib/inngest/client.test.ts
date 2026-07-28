import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

const { mockEnv } = vi.hoisted(() => ({
  mockEnv: {} as Record<string, string | undefined>,
}))

vi.mock('@/lib/env', () => ({
  env: mockEnv,
}))

describe('inngest client', () => {
  beforeEach(() => {
    vi.resetModules()
    for (const key of Object.keys(mockEnv)) delete mockEnv[key]
  })

  afterEach(() => {
    vi.resetModules()
  })

  it('reports unconfigured when no event key is present', async () => {
    const { isInngestConfigured } = await import('@/lib/inngest/client')

    expect(isInngestConfigured()).toBe(false)
  })

  it('treats a blank event key as unconfigured', async () => {
    mockEnv.INNGEST_EVENT_KEY = '   '
    const { isInngestConfigured } = await import('@/lib/inngest/client')

    expect(isInngestConfigured()).toBe(false)
  })

  it('reports configured once an event key is set', async () => {
    mockEnv.INNGEST_EVENT_KEY = 'signkey-prod-abc123'
    const { isInngestConfigured, inngest, INNGEST_APP_ID } = await import(
      '@/lib/inngest/client'
    )

    expect(isInngestConfigured()).toBe(true)
    expect(inngest.id).toBe(INNGEST_APP_ID)
  })
})
