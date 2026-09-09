# Observability Guide

This project uses structured logs, request-level telemetry, and continuous-integration checks to improve reliability and detect regressions early.

## Stack

- **Logs**: Pino structured logs (`src/lib/logger.ts`)
- **Tracing / error monitoring**: Sentry Next.js SDK (`src/instrumentation.ts`, `sentry.*.config.ts`)
- **Metrics endpoint**: Prometheus-formatted metrics at `GET /api/metrics`
- **Health endpoint**: `GET /api/health` for liveness probing by an external monitor, and provider-readiness reporting (see below)
- **Continuous integration**: `.github/workflows/build.yml`, whose `test`, `build`, `sonarqube`, `deepsource`, and `codecov` jobs run on every pull request and on pushes to `develop` and `master`

> There is no synthetic-uptest workflow in this repository. Uptime checking is
> not configured; `GET /api/health` is the endpoint an external monitor would
> poll if one were introduced.

## Current workflow coverage

Operational telemetry covers API latency/errors, cache effectiveness, business events, and checkout queue lag. Trace the latest high-value workflows as complete chains:

- Search: `/api/search` → `/api/search/suggest` → `/api/search/click`.
- Guest AI: `/api/ai/products/[id]/chat`, checking rate limits and stock-privacy outcomes without logging raw client addresses.
- Checkout: `/api/checkout` → `checkout/request.created` → `order/created` → email, search, and cache events.
- Admin operations: bulk product/order updates, CSV import/export, and search reindexing.
- Scheduled work: exchange-rate refresh and failed-email retries.

Never attach credentials, raw passwords, reset tokens, payment secrets, or full AI guest identifiers to logs or metrics.

## Request IDs

- API routes wrapped with `withLogging` / `withApiLogging` include `X-Request-ID` in responses.
- The same request ID is written into structured API logs, enabling request correlation.

## Application Metrics

`GET /api/metrics` exposes:

- API volume, error count (5xx), slow request count (>= 1000ms), and average latency
- Cache operations (hit/miss/set/invalidate) and cache hit rate
- Business event success/failure counters
- Checkout queue lag (avg/max, milliseconds)
- Order processing duration as a histogram, `application_order_processing_duration_ms_bucket` (plus `_sum`, `_count` and `_max`), covering payment verification through order persistence

Use the histogram to derive real percentiles before making capacity decisions:

```promql
histogram_quantile(0.99, sum(rate(application_order_processing_duration_ms_bucket[5m])) by (le))
```

## Tracing Key Workflows

The current tracing setup captures Next.js server/client activity and errors through Sentry. Correlate traces with:

- checkout flow (`/api/checkout`, queue processing)
- auth flow (`/api/auth/*`)
- email flow (Inngest email functions, retry jobs)

## Alerting Recommendations

Configure alerts in your monitoring system (Sentry, Datadog, Prometheus Alertmanager) for:

1. `application_api_request_errors_total` spike over baseline
2. `application_api_request_slow_total` sustained growth
3. `application_cache_hit_rate` dropping below your baseline target (for example `< 0.5`, adjusted to your normal traffic profile)
4. `application_checkout_queue_lag_ms_max` breaching queue SLO
5. `application_order_processing_duration_ms` p99 approaching the 30s `maxDuration` declared on claim-holding routes

## Provider Readiness

`GET /api/health` always returns HTTP 200 — the process itself is up — with a
body of:

```json
{
  "status": "ok",
  "providers": [
    { "capability": "database", "provider": "postgres", "source": "default", "configured": true }
  ],
  "deprecatedAliases": []
}
```

`status` is `"degraded"` when a provider was *explicitly* selected (its
selector variable, e.g. `SEARCH_PROVIDER`, is set) without the credentials it
requires; an inferred or defaulted provider can never produce a degraded
status, by construction (see `src/lib/providers/resolution.ts`). The body
never carries a URL, token, or other credential-bearing value — only
capability/provider names, how each was chosen (`explicit` / `inferred` /
`default`), and whether it is configured. `deprecatedAliases` lists legacy
variable names in use, by name only.

## Synthetic Uptests

`Synthetic Uptests` workflow runs every 15 minutes and validates:

- `/api/health` responds with `status` of `"ok"` or `"degraded"`
- `/api/products?limit=1` responds successfully
- `x-request-id` response header is present on `/api/products`

Set repository secret `SYNTHETIC_BASE_URL` (for example, production URL) to enable scheduled checks.
