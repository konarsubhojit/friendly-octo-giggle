import { describe, it, expect, afterEach } from 'vitest'
import { GET } from '@/app/api/health/route'
import { __resetProviderResolutionForTests } from '@/lib/providers/resolution'

describe('GET /api/health', () => {
  afterEach(() => {
    __resetProviderResolutionForTests()
  })

  it('returns 200 with status ok and a provider summary when nothing is misconfigured', async () => {
    const response = await GET()
    expect(response.status).toBe(200)

    const body = await response.json()
    expect(body.status).toBe('ok')
    expect(Array.isArray(body.providers)).toBe(true)
    expect(body.providers.length).toBeGreaterThan(0)
    expect(Array.isArray(body.deprecatedAliases)).toBe(true)
  })

  it('never exposes credential-bearing values in the response body', async () => {
    const response = await GET()
    const serialized = JSON.stringify(await response.json())

    expect(serialized).not.toMatch(/https?:\/\//)
    expect(serialized).not.toContain(process.env.DATABASE_URL ?? '__unset__')
  })

  it('each provider entry only carries capability/provider/source/configured', async () => {
    const response = await GET()
    const body = await response.json()

    for (const entry of body.providers) {
      expect(Object.keys(entry).sort()).toEqual(
        ['capability', 'configured', 'provider', 'source'].sort()
      )
    }
  })
})
