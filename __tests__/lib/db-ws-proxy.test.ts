import { describe, it, expect, vi, beforeEach } from 'vitest'

const { neonConfig, mockEnv } = vi.hoisted(() => ({
  neonConfig: {} as Record<string, unknown>,
  mockEnv: {
    DATABASE_URL: '******localhost:5432/app',
    READ_DATABASE_URL: undefined as string | undefined,
    E2E_WS_PROXY: undefined as string | undefined,
  },
}))

vi.mock('@neondatabase/serverless', () => ({
  neonConfig,
  Pool: class {
    constructor(public readonly options: unknown) {}
  },
}))

vi.mock('drizzle-orm/neon-serverless', () => ({
  drizzle: vi.fn(() => ({})),
}))

vi.mock('drizzle-orm/pg-core', async (importOriginal) => ({
  ...(await importOriginal<Record<string, unknown>>()),
  withReplicas: vi.fn(() => ({})),
}))

vi.mock('@/lib/env', () => ({ env: mockEnv }))

const loadDb = async () => {
  vi.resetModules()
  for (const key of Object.keys(neonConfig)) {
    delete neonConfig[key]
  }
  await import('@/lib/db')
}

describe('E2E_WS_PROXY gate', () => {
  beforeEach(() => {
    mockEnv.E2E_WS_PROXY = undefined
  })

  it('leaves the Neon driver untouched when the gate is unset', async () => {
    await loadDb()

    expect(neonConfig.wsProxy).toBeUndefined()
    expect(neonConfig.useSecureWebSocket).toBeUndefined()
    expect(neonConfig.pipelineTLS).toBeUndefined()
    expect(neonConfig.pipelineConnect).toBeUndefined()
  })

  it('routes through the local wsproxy and disables TLS when the gate is set', async () => {
    mockEnv.E2E_WS_PROXY = 'localhost:5488/v2'

    await loadDb()

    expect(typeof neonConfig.wsProxy).toBe('function')
    expect((neonConfig.wsProxy as () => string)()).toBe('localhost:5488/v2')
    expect(neonConfig.useSecureWebSocket).toBe(false)
    expect(neonConfig.pipelineTLS).toBe(false)
    expect(neonConfig.pipelineConnect).toBe(false)
  })
})
