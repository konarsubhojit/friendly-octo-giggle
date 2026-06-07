const SLOW_API_THRESHOLD_MS = 1_000

interface ApiRouteMetrics {
  count: number
  errorCount: number
  slowCount: number
  totalDurationMs: number
}

const state = {
  api: {
    total: 0,
    errors: 0,
    slow: 0,
    totalDurationMs: 0,
    byRoute: new Map<string, ApiRouteMetrics>(),
  },
  cache: {
    hit: 0,
    miss: 0,
    set: 0,
    invalidate: 0,
  },
  businessEvents: {
    success: 0,
    failed: 0,
  },
  queue: {
    checkoutLagSamples: 0,
    checkoutLagTotalMs: 0,
    checkoutLagMaxMs: 0,
  },
}

const buildRouteKey = (method: string, path: string): string =>
  `${method} ${path}`

const escapeLabelValue = (value: string): string =>
  value.replaceAll('\\', String.raw`\\`).replaceAll('"', String.raw`\"`).replaceAll('\n', String.raw`\n`)

export const recordApiRequestMetric = (data: {
  method: string
  path: string
  statusCode?: number
  duration?: number
}) => {
  state.api.total += 1

  const duration = Math.max(data.duration ?? 0, 0)
  state.api.totalDurationMs += duration

  if ((data.statusCode ?? 0) >= 500) {
    state.api.errors += 1
  }
  if (duration >= SLOW_API_THRESHOLD_MS) {
    state.api.slow += 1
  }

  const key = buildRouteKey(data.method, data.path)
  const existing = state.api.byRoute.get(key) ?? {
    count: 0,
    errorCount: 0,
    slowCount: 0,
    totalDurationMs: 0,
  }

  existing.count += 1
  existing.totalDurationMs += duration
  if ((data.statusCode ?? 0) >= 500) {
    existing.errorCount += 1
  }
  if (duration >= SLOW_API_THRESHOLD_MS) {
    existing.slowCount += 1
  }
  state.api.byRoute.set(key, existing)
}

export const recordCacheMetric = (
  operation: 'hit' | 'miss' | 'set' | 'invalidate'
) => {
  state.cache[operation] += 1
}

export const recordBusinessEventMetric = (success: boolean) => {
  if (success) {
    state.businessEvents.success += 1
    return
  }
  state.businessEvents.failed += 1
}

export const recordCheckoutQueueLagMetric = (lagMs: number) => {
  // Clock skew or malformed timestamps can produce negative lag values.
  // Clamp to zero so the exported metric remains valid.
  const normalizedLag = Math.max(lagMs, 0)
  state.queue.checkoutLagSamples += 1
  state.queue.checkoutLagTotalMs += normalizedLag
  state.queue.checkoutLagMaxMs = Math.max(
    state.queue.checkoutLagMaxMs,
    normalizedLag
  )
}

export const renderPrometheusMetrics = (): string => {
  const cacheLookups = state.cache.hit + state.cache.miss
  const cacheHitRate = cacheLookups > 0 ? state.cache.hit / cacheLookups : 0
  const apiAverageDuration =
    state.api.total > 0 ? state.api.totalDurationMs / state.api.total : 0
  const queueLagAverage =
    state.queue.checkoutLagSamples > 0
      ? state.queue.checkoutLagTotalMs / state.queue.checkoutLagSamples
      : 0

  const lines = [
    '# HELP application_api_requests_total Total API requests seen by the application.',
    '# TYPE application_api_requests_total counter',
    `application_api_requests_total ${state.api.total}`,
    '# HELP application_api_request_errors_total Total API requests that returned 5xx.',
    '# TYPE application_api_request_errors_total counter',
    `application_api_request_errors_total ${state.api.errors}`,
    '# HELP application_api_request_slow_total Total API requests slower than 1000ms.',
    '# TYPE application_api_request_slow_total counter',
    `application_api_request_slow_total ${state.api.slow}`,
    '# HELP application_api_request_duration_ms_average Average API request duration in milliseconds.',
    '# TYPE application_api_request_duration_ms_average gauge',
    `application_api_request_duration_ms_average ${apiAverageDuration.toFixed(3)}`,
    '# HELP application_cache_operations_total Cache operations grouped by operation.',
    '# TYPE application_cache_operations_total counter',
    `application_cache_operations_total{operation="hit"} ${state.cache.hit}`,
    `application_cache_operations_total{operation="miss"} ${state.cache.miss}`,
    `application_cache_operations_total{operation="set"} ${state.cache.set}`,
    `application_cache_operations_total{operation="invalidate"} ${state.cache.invalidate}`,
    '# HELP application_cache_hit_rate Cache hit ratio between 0 and 1.',
    '# TYPE application_cache_hit_rate gauge',
    `application_cache_hit_rate ${cacheHitRate.toFixed(6)}`,
    '# HELP application_business_events_total Business events grouped by success state.',
    '# TYPE application_business_events_total counter',
    `application_business_events_total{success="true"} ${state.businessEvents.success}`,
    `application_business_events_total{success="false"} ${state.businessEvents.failed}`,
    '# HELP application_checkout_queue_lag_ms_average Average checkout queue lag in milliseconds.',
    '# TYPE application_checkout_queue_lag_ms_average gauge',
    `application_checkout_queue_lag_ms_average ${queueLagAverage.toFixed(3)}`,
    '# HELP application_checkout_queue_lag_ms_max Max checkout queue lag in milliseconds.',
    '# TYPE application_checkout_queue_lag_ms_max gauge',
    `application_checkout_queue_lag_ms_max ${state.queue.checkoutLagMaxMs}`,
  ]

  for (const [key, metrics] of state.api.byRoute.entries()) {
    const separatorIndex = key.indexOf(' ')
    const method = key.slice(0, separatorIndex)
    const path = key.slice(separatorIndex + 1)
    const safeMethod = escapeLabelValue(method)
    const safePath = escapeLabelValue(path)
    lines.push(
      `application_api_requests_by_route_total{method="${safeMethod}",path="${safePath}"} ${metrics.count}`,
      `application_api_request_errors_by_route_total{method="${safeMethod}",path="${safePath}"} ${metrics.errorCount}`,
      `application_api_request_slow_by_route_total{method="${safeMethod}",path="${safePath}"} ${metrics.slowCount}`
    )
  }

  return `${lines.join('\n')}\n`
}

export const resetMetrics = () => {
  state.api.total = 0
  state.api.errors = 0
  state.api.slow = 0
  state.api.totalDurationMs = 0
  state.api.byRoute.clear()
  state.cache.hit = 0
  state.cache.miss = 0
  state.cache.set = 0
  state.cache.invalidate = 0
  state.businessEvents.success = 0
  state.businessEvents.failed = 0
  state.queue.checkoutLagSamples = 0
  state.queue.checkoutLagTotalMs = 0
  state.queue.checkoutLagMaxMs = 0
}

// Backward-compatible alias for tests importing the older helper name.
export const resetMetricsForTests = resetMetrics
