import { beforeEach, describe, expect, it } from 'vitest'
import {
  recordApiRequestMetric,
  recordBusinessEventMetric,
  recordCacheMetric,
  recordCheckoutQueueLagMetric,
  renderPrometheusMetrics,
  resetMetricsForTests,
} from '@/lib/metrics'

describe('metrics', () => {
  beforeEach(() => {
    resetMetricsForTests()
  })

  it('records API latency and slow/error counters', () => {
    recordApiRequestMetric({
      method: 'GET',
      path: '/api/products',
      statusCode: 200,
      duration: 120,
    })
    recordApiRequestMetric({
      method: 'GET',
      path: '/api/products',
      statusCode: 503,
      duration: 1_500,
    })

    const output = renderPrometheusMetrics()
    expect(output).toContain('application_api_requests_total 2')
    expect(output).toContain('application_api_request_errors_total 1')
    expect(output).toContain('application_api_request_slow_total 1')
    expect(output).toContain(
      'application_api_requests_by_route_total{method="GET",path="/api/products"} 2'
    )
  })

  it('records cache hit rate and queue lag', () => {
    recordCacheMetric('hit')
    recordCacheMetric('hit')
    recordCacheMetric('miss')
    recordCacheMetric('set')
    recordCacheMetric('invalidate')
    recordCheckoutQueueLagMetric(250)
    recordCheckoutQueueLagMetric(750)
    recordBusinessEventMetric(true)
    recordBusinessEventMetric(false)

    const output = renderPrometheusMetrics()
    expect(output).toContain(
      'application_cache_operations_total{operation="hit"} 2'
    )
    expect(output).toContain(
      'application_cache_operations_total{operation="miss"} 1'
    )
    expect(output).toContain('application_cache_hit_rate 0.666667')
    expect(output).toContain(
      'application_checkout_queue_lag_ms_average 500.000'
    )
    expect(output).toContain('application_checkout_queue_lag_ms_max 750')
    expect(output).toContain(
      'application_business_events_total{success="true"} 1'
    )
    expect(output).toContain(
      'application_business_events_total{success="false"} 1'
    )
  })
})
