# Quickstart: Running the End-to-End Suite

**Feature**: `013-e2e-in-continuous-integration` | **Spec**: [spec.md](./spec.md) | **Plan**: [plan.md](./plan.md)

The single documented command is `npm run test:e2e`. Continuous integration invokes exactly that command with flags, never a different one (FR-017). Everything below is a way of pointing it at a different target or a narrower slice.

## 1. Run the suite locally against the development server

This is the default path and needs no database of your own beyond whatever `DATABASE_URL` already points at in your `.env.local`.

```bash
npm run dev          # in one terminal; serves https://localhost:3000
npm run test:e2e     # in another
```

`playwright.config.ts` defaults `PLAYWRIGHT_BASE_URL` to `https://localhost:3000`, matching the `--experimental-https` server that `npm run dev` starts, and `webServer.reuseExistingServer` picks up the server you already have running. If you skip the first terminal, Playwright starts the dev server itself and waits for `/shop` to respond.

Browsers must be installed once:

```bash
npx playwright install --with-deps chromium
```

Chromium is the only browser the suite needs — every project uses `devices['Desktop Chrome']` or `devices['Pixel 5']`.

## 2. Reproduce the CI environment locally

Use this when a failure only happens in CI, or before changing anything under `playwright-tests/`. It reproduces the production-build path, the ephemeral database, and the WebSocket proxy that `@neondatabase/serverless` requires.

### 2a. Start the database and the proxy

```bash
docker network create e2e-net

docker run -d --name e2e-pg --network e2e-net --network-alias postgres \
  -e POSTGRES_USER=ci -e POSTGRES_PASSWORD=ci -e POSTGRES_DB=kiyon_e2e \
  -p 5432:5432 postgres:16-alpine

docker run -d --name e2e-wsproxy --network e2e-net \
  -e APPEND_PORT=postgres:5432 -e ALLOW_ADDR_REGEX='.*' \
  -p 5433:80 ghcr.io/neondatabase/wsproxy:latest
```

`APPEND_PORT` pins the proxy to the Postgres service alias. Do not also let the driver send an address parameter — the two mechanisms concatenate and produce `too many colons in address`.

Wait for both:

```bash
docker exec e2e-pg pg_isready -U ci -d kiyon_e2e
until (echo > /dev/tcp/localhost/5433) 2>/dev/null; do sleep 1; done
```

### 2b. Set the environment

```bash
export PGUSER='ci'
export PGPASSWORD='ci'
export DATABASE_URL="postgresql://${PGUSER}:${PGPASSWORD}@localhost:5432/kiyon_e2e"
export E2E_WS_PROXY='localhost:5433/v1'
export E2E_ALLOW_INSECURE_HTTP='true'
export NEXTAUTH_SECRET='e2e-local-placeholder'
export NEXT_PUBLIC_APP_URL='http://localhost:3000'
export AUTH_TRUST_HOST='true'
export PLAYWRIGHT_BASE_URL='http://localhost:3000'
export COPILOT_DEV_EMAIL='e2e-admin@example.test'
export COPILOT_DEV_PASS='e2e-local-password'
```

`DATABASE_URL` points at `localhost` for both the application and the migration tooling: the proxy target is pinned by `APPEND_PORT`, so the host in this URL is never resolved by the application itself.

`E2E_ALLOW_INSECURE_HTTP` exists because `src/proxy.ts` redirects every plain-HTTP request to `https://` outside development and `next start` cannot serve TLS. It is inert when unset; never set it anywhere but a local or CI end-to-end run.

### 2c. Migrate, seed, build, and run

```bash
npx drizzle-kit migrate
node scripts/seed-e2e-fixtures.mjs
npm run build
npm run test:e2e
```

`npm run test:e2e` starts the production server itself and waits for `/shop`. If the seed did not take, `/shop` cannot render and the readiness probe times out — that is intentional, and it is what stops a run from passing vacuously on an empty database.

### 2d. Tear down

```bash
docker rm -f e2e-pg e2e-wsproxy
docker network rm e2e-net
```

## 3. Run one project

```bash
npm run test:e2e -- --project=variant-options
```

Project names come from `playwright.config.ts`. The authenticated projects need `playwright-tests/.auth/admin.json`, which `playwright-tests/global-setup.ts` writes on the first run by signing in with `COPILOT_DEV_EMAIL` and `COPILOT_DEV_PASS`. Delete that file to force a fresh sign-in:

```bash
rm -f playwright-tests/.auth/admin.json
```

To narrow further:

```bash
npm run test:e2e -- --project=cart --grep "empty cart"
npm run test:e2e -- playwright-tests/public-pages.spec.ts
```

## 4. Run only the blocking set

The blocking set is what gates merge. Run it before opening a pull request:

```bash
npm run test:e2e -- \
  --project=ai-stock-privacy \
  --project=orders-list \
  --project=latest-features \
  --project=password-validation-desktop \
  --project=account-password-validation \
  --project=admin-desktop \
  --project=admin-mobile \
  --project=cart \
  --project=accessibility-public \
  --project=accessibility-authenticated \
  --project=product-navigation \
  --project=public-pages \
  --project=session-isolation \
  --project=variant-options
```

Fourteen projects, 151 cases. The three advisory projects — `desktop-chrome`, `mobile-chrome`, `orders-live` — publish artifacts but do not gate merge; run them with the inverse selection when you want the UX screenshots or the live checkout walkthrough.

To reproduce a single CI shard:

```bash
npm run test:e2e -- --shard=2/4
```

Playwright assigns whole `(project, file)` groups to shards, so a shard is a stable subset for a given suite.

## 5. Debug a CI failure from downloaded traces

1. Open the failed run in the Actions tab and find the job named `E2E Blocking (shard N/4)`, where `N` is the shard that failed.
2. Download two artifacts from the run's summary page: `e2e-report` (the merged HTML report across all four shards) and `e2e-traces-N` (the traces and failure screenshots for the failing shard). Both are retained for 14 days.
3. Unzip and open the report:

   ```bash
   unzip e2e-report.zip -d e2e-report
   npx playwright show-report e2e-report
   ```

4. Open the trace for a specific failure:

   ```bash
   unzip e2e-traces-N.zip -d test-results
   npx playwright show-trace test-results/<test-dir>/trace.zip
   ```

   The trace viewer gives the action timeline, a DOM snapshot before and after every step, the console log, and the network log. Traces are captured with `retain-on-failure`, so a passing test produces none.

5. If the failure is a timeout on the `webServer` readiness probe rather than on a test, the cause is upstream of Playwright: check the `drizzle-kit migrate` and `node scripts/seed-e2e-fixtures.mjs` step logs. A failed seed leaves `/shop` unable to render.

6. The blocking lane runs with `retries: 0`, so a failure is a single observed failure, not a residue after retries. If you believe it is flaky, reproduce it locally with the CI environment from section 2 and run the project ten times before concluding anything — and if it is genuinely flaky, quarantine it into the advisory lane with a tracked reason and a promotion condition rather than adding retries.

## 6. Extend the suite

- A new spec file must be matched by at least one project's `testMatch`, or it never runs. Every project must resolve to at least one existing file (FR-016).
- A new project must be classified blocking or advisory in `docs/development.md` before it merges. A project may not mix blocking and advisory spec files.
- A blocking project may only rely on data the fixture seed guarantees. Those guarantees are enumerated in [contracts/fixture-seed.md](./contracts/fixture-seed.md); anything not listed there is not promised and must be intercepted with `page.route` instead.
- Do not weaken an assertion to make a run green. Removing assertions, widening matchers, or skipping cases for convenience is prohibited (FR-009); quarantine into the advisory lane is the sanctioned escape hatch and it carries a tracked reason.
