import { describe, expect, it, vi } from 'vitest'
import { recordApiRequestMetric, resetMetrics } from '@/lib/metrics'

const connection = vi.fn(async () => undefined)

// The route declares itself per-request with `connection()`, which throws
// outside a real request scope. `NextResponse` must stay real so the response
// body and headers are still exercised.
vi.mock('next/server', async (importOriginal) => ({
  ...(await importOriginal<typeof import('next/server')>()),
  connection: () => connection(),
}))

const { GET } = await import('@/app/api/metrics/route')

describe('GET /api/metrics', () => {
  it('returns prometheus formatted metrics', async () => {
    resetMetrics()
    recordApiRequestMetric({
      method: 'GET',
      path: '/api/health',
      statusCode: 200,
      duration: 10,
    })

    const response = await GET()
    expect(response.status).toBe(200)
    expect(response.headers.get('Content-Type')).toContain('text/plain')

    const body = await response.text()
    expect(body).toContain('application_api_requests_total 1')
    expect(body).toContain(
      'application_api_requests_by_route_total{method="GET",path="/api/health"} 1'
    )
  })

  it('opts out of prerendering so counters are never frozen at build time', async () => {
    connection.mockClear()

    await GET()

    expect(connection).toHaveBeenCalledTimes(1)
  })
})
