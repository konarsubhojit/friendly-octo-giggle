import { describe, expect, it } from 'vitest'
import { GET } from '@/app/api/metrics/route'
import { recordApiRequestMetric, resetMetrics } from '@/lib/metrics'

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
})
