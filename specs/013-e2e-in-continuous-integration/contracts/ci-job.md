# Contract: End-to-End Continuous Integration Job

**Feature**: `013-e2e-in-continuous-integration` | **Artifact**: `.github/workflows/build.yml`

This feature exposes no HTTP API. Its externally observable surface is the set of workflow jobs it adds, the check names those jobs publish, the artifacts they produce, and the exit semantics a reviewer and a branch-protection rule depend on. That surface is contracted here. Breaking any row is a breaking change and requires the branch-protection rule to be updated in the same change.

## Job inventory

| Job id              | `name:`                                      | Matrix                | `needs:`           | `continue-on-error` | `timeout-minutes` |
| ------------------- | -------------------------------------------- | --------------------- | ------------------ | ------------------- | ----------------- |
| `e2e-blocking`      | `E2E Blocking (shard ${{ matrix.shard }}/4)` | `shard: [1, 2, 3, 4]` | `[build]`          | `false`             | `20`              |
| `e2e-advisory`      | `E2E Advisory`                               | none                  | `[build]`          | `true`              | `20`              |
| `e2e`               | `End-to-End Suite`                           | none                  | `[e2e-blocking]`   | `false`             | `10`              |
| `e2e-preview-smoke` | `E2E Preview Smoke`                          | none                  | `[deploy-preview]` | `true`              | `15`              |

`strategy.fail-fast` is `false` on `e2e-blocking`, so one failing shard does not cancel the other three and every shard publishes its artifacts.

`e2e-preview-smoke` is not part of the pull-request graph at all: `deploy-preview` runs only on a push to `develop`, so the lane can never appear as a check on a pull request. It is additionally guarded on the deployment URL being non-empty, so an unavailable `VERCEL_TOKEN` leaves it skipped rather than failed (FR-023).

## Required status check

```text
End-to-End Suite
```

That literal string is the check name GitHub publishes for the `e2e` job. It is the only name this feature guarantees to be stable.

- It is a non-matrix job, so exactly one check appears with that name, satisfying FR-013's "stable, unique name".
- The four `E2E Blocking (shard N/4)` names carry a shard suffix and are deliberately **not** required checks. Requiring them would couple branch protection to the shard count.
- `E2E Advisory` is **never** a required check and is not in the gate's `needs:`.

Because `.github/` contains no ruleset or settings file, enabling the requirement is a repository setting rather than a commit. The enablement step and the way to verify it are recorded in `docs/development.md`.

## Triggers

Inherited from the workflow, unchanged: pull requests and pushes to the default branch `develop`. The event is `pull_request`, not `pull_request_target`, so fork pull requests run with a read-only token and no secrets.

## Inputs

| Input                | Source                                             | Notes                                                            |
| -------------------- | -------------------------------------------------- | ---------------------------------------------------------------- |
| Repository checkout  | `actions/checkout@v7`                              | Same version the existing jobs use                               |
| `.next` build output | `next-build` artifact from `build`                 | Excludes `.next/cache`; retention 1 day                          |
| npm dependencies     | `npm ci` with `actions/setup-node@v7` `cache: npm` | Node 24, matching the existing jobs                              |
| Chromium binary      | `~/.cache/ms-playwright` cache                     | Key `${{ runner.os }}-playwright-<installed version>`            |
| Schema               | `npx drizzle-kit migrate`                          | Applies the committed `drizzle/` files; needs no WebSocket proxy |
| Fixture data         | `npx tsx scripts/seed-e2e-fixtures.ts`             | Contract in [fixture-seed.md](./fixture-seed.md)                 |

**No repository secret is read by either end-to-end job.** This is a contract, not an implementation detail: it is what makes SC-008 hold.

## Services

| Service    | Image                                 | Host port | Environment                                                                     | Readiness                             |
| ---------- | ------------------------------------- | --------- | ------------------------------------------------------------------------------- | ------------------------------------- |
| `postgres` | `postgres:16-alpine`                  | `5432`    | `POSTGRES_USER`, `POSTGRES_PASSWORD`, `POSTGRES_DB` — literal non-secret values | `--health-cmd pg_isready`             |
| `wsproxy`  | `ghcr.io/neondatabase/wsproxy:latest` | `5433`    | `APPEND_PORT=postgres:5432`, `ALLOW_ADDR_REGEX=.*`                              | `bash` `/dev/tcp` wait on port `5433` |

Invariants:

- The proxy listens on container port `80` and serves the WebSocket at path `/v1`. `/v2`, `/`, and `/sql` return 404.
- `APPEND_PORT` and a driver-supplied `?address=` parameter are mutually exclusive. Setting both concatenates the two and fails with `too many colons in address`.
- Because `APPEND_PORT` pins the target, `DATABASE_URL`'s host is never resolved by the application; one URL therefore serves both the application and host-side tooling.

## Environment

Every value below is a literal in the workflow file. None is a secret, none is a repository variable, and none differs between a branch pull request and a fork pull request.

| Variable                  | Value                     | Consumed by                                                                                          |
| ------------------------- | ------------------------- | ---------------------------------------------------------------------------------------------------- |
| `DATABASE_URL`            | loopback URL, port `5432` | `src/lib/env.ts`, `drizzle.config.ts`, the seed                                                      |
| `E2E_WS_PROXY`            | `localhost:5433/v1`       | `src/lib/db.ts` — sets `neonConfig.wsProxy`, `useSecureWebSocket = false`, `pipelineConnect = false` |
| `E2E_ALLOW_INSECURE_HTTP` | `true`                    | `src/proxy.ts` — suppresses the HTTPS 301 for this run only                                          |
| `NEXTAUTH_SECRET`         | literal placeholder       | `src/lib/validations/env.ts` production-required key                                                 |
| `NEXT_PUBLIC_APP_URL`     | `http://localhost:3000`   | `src/lib/validations/env.ts` production-required key                                                 |
| `AUTH_TRUST_HOST`         | `true`                    | NextAuth v5, read directly from the environment                                                      |
| `PLAYWRIGHT_BASE_URL`     | `http://localhost:3000`   | `playwright.config.ts` — selects the CI production-build mode                                        |
| `COPILOT_DEV_EMAIL`       | fixture address           | `playwright-tests/global-setup.ts`                                                                   |
| `COPILOT_DEV_PASS`        | fixture password          | `playwright-tests/global-setup.ts`                                                                   |

The smoke lane sets a disjoint, much smaller environment — `PLAYWRIGHT_BASE_URL` resolved from the deployment output and `PLAYWRIGHT_SKIP_AUTH=true`, and nothing else. It provisions no database, starts no proxy, and sets neither `E2E_` gate, because its whole purpose is to exercise the deployed configuration rather than a synthesized one.

Both `E2E_` variables are declared optional in `src/lib/validations/env.ts`. When absent, the code paths they gate do not execute — that inertness is covered by unit tests in `__tests__/lib/` and is what keeps production behavior unchanged (FR-014).

## Commands

| Job                 | Command                                                                                                                                                                                   |
| ------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `e2e-blocking`      | `npm run test:e2e -- --shard=${{ matrix.shard }}/4 --reporter=blob`                                                                                                                       |
| `e2e-advisory`      | `npm run test:e2e -- --project=desktop-chrome --project=mobile-chrome --project=orders-live`                                                                                              |
| `e2e`               | `npx playwright merge-reports --reporter html ./all-blob-reports`                                                                                                                         |
| `e2e-preview-smoke` | `npm run test:e2e -- --project=public-pages --project=accessibility-public --project=product-navigation --project=ai-stock-privacy --project=session-isolation --project=latest-features` |

FR-017 requires CI to invoke the same documented command a contributor runs. `npm run test:e2e` is that command in every case; only flags differ.

## Artifacts

| Artifact name              | Producer            | Contents                                      | Retention | Upload condition |
| -------------------------- | ------------------- | --------------------------------------------- | --------- | ---------------- |
| `next-build`               | `build`             | `.next` excluding `.next/cache`               | 1 day     | on success       |
| `blob-report-<shard>`      | `e2e-blocking`      | Playwright blob report for that shard         | 14 days   | `if: always()`   |
| `e2e-traces-<shard>`       | `e2e-blocking`      | `test-results/` — traces, failure screenshots | 14 days   | `if: always()`   |
| `e2e-report`               | `e2e`               | Merged HTML report across all four shards     | 14 days   | `if: always()`   |
| `e2e-advisory-report`      | `e2e-advisory`      | HTML report, traces, `ux-audit` screenshots   | 14 days   | `if: always()`   |
| `e2e-preview-smoke-report` | `e2e-preview-smoke` | HTML report and traces from the deployed run  | 14 days   | `if: always()`   |

Traces exist only because `playwright.config.ts` sets `trace: 'retain-on-failure'`. Removing that setting silently empties the trace artifacts and breaks SC-007 without failing any job — treat it as a contract term, not a preference.

## Exit semantics

| Condition                                       | `e2e-blocking`                             | `e2e-advisory` | `e2e` (`End-to-End Suite`) | Merge blocked                                              |
| ----------------------------------------------- | ------------------------------------------ | -------------- | -------------------------- | ---------------------------------------------------------- |
| All blocking tests pass                         | success                                    | any            | success                    | no                                                         |
| One or more blocking tests fail                 | failure on that shard                      | any            | failure                    | **yes**                                                    |
| Advisory tests fail                             | success                                    | neutral        | success                    | no                                                         |
| `build` fails                                   | skipped                                    | skipped        | skipped                    | **yes** — a skipped required check does not report success |
| A shard exceeds `timeout-minutes: 20`           | failure                                    | any            | failure                    | **yes**                                                    |
| Browser cache miss                              | success, slower                            | any            | success                    | no                                                         |
| Database or proxy service fails to become ready | failure during setup                       | any            | failure                    | **yes**                                                    |
| Seed fails, leaving `/` unrenderable            | failure on the `webServer` readiness probe | any            | failure                    | **yes**                                                    |

`e2e-preview-smoke` never appears in this table's "merge blocked" column, under any condition. It is `continue-on-error: true`, it is in no job's `needs:`, and `deploy-preview` does not run on pull requests, so all three independently guarantee it cannot gate a merge. A smoke-lane failure is a post-merge signal about the deployed environment and is triaged as such.

The last row is deliberate. A blocking project whose fixture is missing must fail loudly during setup rather than skip its assertions or pass vacuously, per the spec's edge cases. The readiness probe on `${BASE_URL}/` is what makes that automatic.

`retries` is `0` in the blocking lane. A reported failure is a single observed failure with no retry masking, which is what makes SC-003's "ten consecutive runs produce identical results" a measurable statement.

## Change control

| Change                                                   | Allowed without touching branch protection                                                                      |
| -------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------- |
| Adding, removing, or rebalancing shards                  | yes — the gate job's name does not encode the shard count                                                       |
| Moving a project between the blocking and advisory lanes | yes — but it also requires a tracked reason, a promotion condition, and a `docs/development.md` update (FR-018) |
| Adding a project or a spec file                          | yes — but every project must resolve to at least one existing file and carry a classification (FR-016, FR-006)  |
| Renaming the `e2e` job's `name:`                         | **no** — this invalidates the required status check and must be paired with a branch-protection update          |
| Changing which job is required                           | **no** — same reason                                                                                            |
