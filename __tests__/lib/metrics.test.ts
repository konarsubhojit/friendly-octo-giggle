import { beforeEach, describe, expect, it } from 'vitest'
import {
  recordApiRequestMetric,
  recordBusinessEventMetric,
  recordCacheMetric,
  recordCheckoutQueueLagMetric,
  recordOrderProcessingMetric,
  renderPrometheusMetrics,
  resetMetrics,
} from '@/lib/metrics'

describe('metrics', () => {
  beforeEach(() => {
    resetMetrics()
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

  it('records order processing durations as a histogram', () => {
    recordOrderProcessingMetric(80)
    recordOrderProcessingMetric(1_800)
    recordOrderProcessingMetric(40_000)

    const output = renderPrometheusMetrics()
    expect(output).toContain(
      '# TYPE application_order_processing_duration_ms histogram'
    )
    expect(output).toContain(
      'application_order_processing_duration_ms_bucket{le="100"} 1'
    )
    expect(output).toContain(
      'application_order_processing_duration_ms_bucket{le="2500"} 2'
    )
    expect(output).toContain(
      'application_order_processing_duration_ms_bucket{le="30000"} 2'
    )
    expect(output).toContain(
      'application_order_processing_duration_ms_bucket{le="+Inf"} 3'
    )
    expect(output).toContain(
      'application_order_processing_duration_ms_sum 41880'
    )
    expect(output).toContain('application_order_processing_duration_ms_count 3')
    expect(output).toContain(
      'application_order_processing_duration_ms_max 40000'
    )
  })

  it('clamps negative order processing durations and resets cleanly', () => {
    recordOrderProcessingMetric(-500)
    expect(renderPrometheusMetrics()).toContain(
      'application_order_processing_duration_ms_sum 0'
    )

    resetMetrics()
    const output = renderPrometheusMetrics()
    expect(output).toContain('application_order_processing_duration_ms_count 0')
    expect(output).toContain(
      'application_order_processing_duration_ms_bucket{le="100"} 0'
    )
  })
})
