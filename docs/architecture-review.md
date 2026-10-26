# Architecture Review and Optimization Plan

**Reviewed:** 2026-10-07  
**Scope:** Runtime boundaries, request metrics, database connection pools, and
the accuracy of the architecture guide. This is a source review, not a
production load test; proposed performance changes remain gated on measurement.

## Findings

### P1 — Bound API route metric cardinality

`withLogging` and `withApiLogging` pass `request.nextUrl.pathname` to
`recordApiRequestMetric` (`src/lib/api-middleware.ts`). The metrics module keeps
one map entry per method and path and exports that path as a Prometheus label
(`src/lib/metrics.ts`). Dynamic routes therefore create separate entries for
resource IDs, and arbitrary path values can grow the map for the lifetime of a
warm process while also creating high-cardinality time series.

**Planned change:** Use a stable route template or another bounded route key
instead of the raw pathname. Keep IDs, query values, and other user-controlled
values out of metric labels. Define a finite bound/fallback for unknown routes.

**Acceptance criteria:** Requests to the same dynamic route with different IDs
aggregate into one series; unknown paths cannot create an unbounded number of
series; existing total/error/slow counters remain correct.

### P2 — Verify whether the default database path needs two pools

`createDatabaseConnections` always creates primary and read connections, even
when `READ_DATABASE_URL` is absent and both use `DATABASE_URL`
(`src/lib/db/factory.ts`). The default pool maximum is 10 per pool. The existing
factory tests explicitly assert that two pools are created in this case
(`__tests__/lib/db-connection-fallback.test.ts`).

**Planned change:** Measure concurrent connections and pool wait/timeout rates
first. If the duplicate pools add material connection pressure, reuse the
primary connection when no distinct read URL is configured; preserve separate
pools when a replica URL is configured.

**Acceptance criteria:** A no-replica deployment opens only the needed pool;
an explicit replica still has independent primary/read pools; read routing,
read-after-write behavior, and shutdown remain correct when a connection is
shared.

### P2 — Make metrics semantics explicit for multi-instance deployments

Metric counters and route aggregates are module-level in-memory state
(`src/lib/metrics.ts`), and `/api/metrics` renders that state from the current
process (`src/app/api/metrics/route.ts`). They reset on process restart and do
not aggregate across serverless or horizontally scaled instances.

**Planned change:** Decide whether these metrics are intentionally
process-local diagnostics or need deployment-wide totals. If global metrics are
required, select an aggregation/export path compatible with the deployment
targets before introducing a backend.

**Acceptance criteria:** Document the supported scrape/deployment topology.
For an aggregated backend, verify that observations from multiple instances
and process restarts are represented without exposing sensitive or
high-cardinality labels.

## Documentation corrections made in this review

- Updated the architecture guide's package versions to match the declarations
  in `package.json`; those values are declared dependency versions/ranges, not
  a lockfile-resolved runtime inventory.
- Clarified that Cache Components use the custom shared Redis handler only for
  self-hosted deployments configured with the supported `redis` cache provider.
  Other deployments use Next.js's default handler, whose sharing and durability
  must not be inferred from the application's Redis behavior.

## Change order and validation

1. Bound route metrics and add focused tests for dynamic and unknown paths.
2. Capture connection/pool baselines, then change pool construction only if the
   data justifies it; extend factory and shutdown tests for both topologies.
3. Resolve the multi-instance metrics contract and implement an exporter only
   if deployment-wide metrics are a requirement.

For each runtime change, run the focused tests first, then the repository's
lint, type-check, unit-test, production-build, and documentation checks. Record
before/after observations for any change described as a performance
optimization; do not claim a latency or throughput improvement without that
measurement.
