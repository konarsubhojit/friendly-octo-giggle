# Observability Guide

This project uses structured logs, request-level telemetry, and synthetic checks to improve reliability and detect regressions early.

## Stack

- **Logs**: Pino structured logs (`src/lib/logger.ts`)
- **Tracing / error monitoring**: Sentry Next.js SDK (`src/instrumentation.ts`, `sentry.*.config.ts`)
- **Metrics endpoint**: Prometheus-formatted metrics at `GET /api/metrics`
- **Synthetic uptests**: GitHub Actions workflow `.github/workflows/synthetic-uptests.yml`

## Request IDs

- API routes wrapped with `withLogging` / `withApiLogging` include `X-Request-ID` in responses.
- The same request ID is written into structured API logs, enabling request correlation.

## Application Metrics

`GET /api/metrics` exposes:

- API volume, error count (5xx), slow request count (>= 1000ms), and average latency
- Cache operations (hit/miss/set/invalidate) and cache hit rate
- Business event success/failure counters
- Checkout queue lag (avg/max, milliseconds)

## Tracing Key Workflows

The current tracing setup captures Next.js server/client activity and errors through Sentry. Correlate traces with:

- checkout flow (`/api/checkout`, queue processing)
- auth flow (`/api/auth/*`)
- email flow (`/api/services/email`, retry jobs)

## Alerting Recommendations

Configure alerts in your monitoring system (Sentry, Datadog, Prometheus Alertmanager) for:

1. `application_api_request_errors_total` spike over baseline
2. `application_api_request_slow_total` sustained growth
3. `application_cache_hit_rate` dropping below target (for example `< 0.5`)
4. `application_checkout_queue_lag_ms_max` breaching queue SLO

## Synthetic Uptests

`Synthetic Uptests` workflow runs every 15 minutes and validates:

- `/api/health` returns `{"status":"ok"}`
- `/api/products?limit=1` responds successfully
- `x-request-id` response header is present on `/api/products`

Set repository secret `SYNTHETIC_BASE_URL` (for example, production URL) to enable scheduled checks.
