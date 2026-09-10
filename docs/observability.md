# Observability Guide

This project uses structured logs, request-level telemetry, and continuous-integration checks to improve reliability and detect regressions early.

## Stack

- **Logs**: Pino structured logs (`src/lib/logger.ts`)
- **Tracing / error monitoring**: Sentry Next.js SDK (`src/instrumentation.ts`, `sentry.*.config.ts`)
- **Metrics endpoint**: Prometheus-formatted metrics at `GET /api/metrics`
- **Health endpoint**: `GET /api/health` for liveness probing by an external monitor, and provider-readiness reporting (see below)
- **Continuous integration**: `.github/workflows/build.yml`, whose `test`, `build`, `sonarqube`, `deepsource`, and `codecov` jobs run on every pull request and on pushes to `develop` and `master`
- **Continuous integration (self-hosted pool)**: `.github/workflows/build-self-hosted.yml` runs the same pipeline on `[self-hosted, linux, x64]` runners, minus the SonarQube scan. It is tuned for persistent VMs rather than throwaway runners, so it differs from `build.yml` in four ways: the serial `test` job is split into independent `lint`, `typecheck`, and `test` jobs that run alongside `build`; `actions/setup-node` runs without `cache: npm` because `~/.npm` already survives between jobs on a VM; the Next.js build cache is kept in the runner's own `_work` directory instead of the GitHub Actions cache service; and every job declares a `timeout-minutes` so a hung job cannot hold a runner out of a fixed pool for six hours. The two cache differences depend on the runners being persistent — restore `cache: npm` and the `actions/cache` step for `.next/cache` if the pool ever becomes ephemeral or containerised.
- **SonarQube analysis is owned by `build.yml` only.** `SonarSource/sonarqube-scan-action` verifies the SonarScanner CLI download against SonarSource's GPG key, which it fetches at run time from `hkps://keyserver.ubuntu.com` (falling back to `hkps://keys.openpgp.org`) into a throwaway keyring. The action takes no input for supplying that key from disk, so a runner that cannot reach those hosts on port 443 fails the job outright with `gpg: keyserver receive failed: Server indicated a failure`. Both keyservers failed back to back on the self-hosted pool, and duplicating the scan there had only ever produced a second analysis of the same commit racing the first, so the job now exists in `build.yml` alone. To move it onto the pool, open egress to those two keyservers or set `HTTPS_PROXY` on the runner service — only the first run per runner pays for it, because the action caches the scanner in the persistent `RUNNER_TOOL_CACHE` and a cache hit skips both the download and the key fetch.

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
    {
      "capability": "database",
      "provider": "postgres",
      "source": "default",
      "configured": true
    }
  ],
  "deprecatedAliases": []
}
```

`status` is `"degraded"` when a provider was _explicitly_ selected (its
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
