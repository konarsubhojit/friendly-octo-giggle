# Deployment Guide

This guide covers deploying the e-commerce application to various serverless platforms.

## Prerequisites for All Platforms

1. PostgreSQL database (managed service recommended)
2. Redis instance (Upstash Redis recommended for serverless)
3. Admin token for authentication

## Recommended Services

### PostgreSQL Database

- **Vercel Postgres** (easiest for Vercel deployment)
- **Supabase** (free tier, good for all platforms)
- **Neon** (serverless PostgreSQL, free tier)
- **AWS RDS** (production-grade)
- **Railway** (simple setup)

### Redis Cache

- **Upstash Redis** (serverless-optimized, free tier, works everywhere)
- **Redis Labs** (managed Redis)
- **AWS ElastiCache** (for AWS deployments)

## Capability-specific configuration

The core storefront requires PostgreSQL and NextAuth configuration. Enable newer capabilities independently:

- Redis and Upstash Search: caching, suggestions, product search, order search, and search-index administration.
- AI provider credentials: product assistant generation; guest requests use a hashed network identity and authenticated users receive persisted history.
- Inngest: durable checkout processing, transactional email, order side-effects, and scheduled jobs.
- An email provider: transactional email delivery.
- Vercel Blob or S3-compatible storage: admin image upload. See [Image storage](#image-storage).
- Web Push (VAPID) credentials: browser push notifications for order-status changes. See [Web push setup](#web-push-setup).
- Sentry: server, edge, and browser tracing/error capture.
- Edge Config: maintenance, sale, and shipping feature settings.
- Cron authorization: exchange-rate refresh and failed-email retry jobs.

Unset optional integrations must be treated as disabled capabilities, not as reasons for the core application to fail startup.

### Provider selection

Every capability names its backend with one selector variable, and all of them
resolve through a single path (`src/lib/providers/resolution.ts`). Nothing else
in the application reads a provider variable or infers a backend from a
hostname, so the table below is the whole contract:

| Capability | Selector              | Values                           | Inference when unset (credentials present) | Default       |
| ---------- | --------------------- | -------------------------------- | ------------------------------------------ | ------------- |
| Database   | `DATABASE_DRIVER`     | `postgres`, `neon`               | —                                          | `postgres`    |
| Cache      | `CACHE_PROVIDER`      | `redis`, `upstash`, `none`       | Upstash → Redis                            | `none`        |
| Search     | `SEARCH_PROVIDER`     | `postgres`, `algolia`, `upstash` | Upstash → Algolia                          | `postgres`    |
| Storage    | `STORAGE_PROVIDER`    | `s3`, `vercel`, `r2`             | —                                          | `vercel`      |
| Rate limit | `RATE_LIMIT_PROVIDER` | `redis`, `upstash`, `memory`     | Upstash → Redis                            | `memory`      |
| Config     | `CONFIG_PROVIDER`     | `environment`, `edge-config`     | Edge Config                                | `environment` |
| Jobs       | `JOBS_PROVIDER`       | `inngest`, `inline`              | Inngest                                    | `inline`      |

Precedence is: explicit selector, then inference from _which credentials are
present_, then the default. Inference is what keeps a deployment that predates
the selectors on the backend it already uses — existing `DATABASE_URL`,
`READ_DATABASE_URL`, Upstash, R2, and Vercel Blob variables all remain accepted
unchanged.

An **explicit** selection must be complete: `SEARCH_PROVIDER=algolia` without
`ALGOLIA_ADMIN_API_KEY`, or `CACHE_PROVIDER=redis` without `REDIS_URL`, is rejected at
startup with an error naming the missing variable. An inferred or defaulted
provider is never rejected, because it is by construction one the deployment can
already reach. Like the production-key checks, these are deferred during
`next build`, where a build machine legitimately holds no runtime credentials.

For database connections, `postgres` is the default and uses the standard
PostgreSQL wire protocol through `pg.Pool`. It works with local PostgreSQL,
PgBouncer, RDS, Cloud SQL, Azure Database for PostgreSQL, Supabase, Railway,
Render, Neon standard endpoints, and any provider exposing a standard
PostgreSQL URL. Set `DATABASE_DRIVER=neon` only when the deployment benefits
from Neon's specialized serverless adapter, such as Vercel-style runtimes using
Neon's HTTP/WebSocket optimized connection layer.

Database pool behavior can be tuned with `DATABASE_POOL_MAX`,
`DATABASE_POOL_IDLE_TIMEOUT_MS`, `DATABASE_POOL_CONNECTION_TIMEOUT_MS`, and
`DATABASE_POOL_MAX_LIFETIME_SECONDS`. Defaults are 10 connections, 20 seconds
idle timeout, 5 seconds connection timeout, and a 300 second socket lifetime.
`READ_DATABASE_URL` remains optional and falls back to `DATABASE_URL`.

`DATABASE_POOL_MAX_LIFETIME_SECONDS` retires a pooled socket once it reaches
that age, regardless of how recently it was used. The idle timeout alone cannot
do this on a serverless platform: it is enforced by a timer, and timers do not
fire while the container is frozen between invocations. A socket parked across
a freeze therefore still looks fresh by idle accounting long after PgBouncer or
the database closed its own end, and the next query on it fails with
`Connection terminated unexpectedly`. Keep this below the pooler's
`server_idle_timeout` so the client discards the socket first.

For self-hosted deployments, the generic protocols — `postgres`, `redis`, and
`s3` — are the recommended selections; managed values (`neon`, `upstash`,
`vercel`, `edge-config`) remain available for deployments that need their
specialized adapters.

`summarizeProviders()` renders the resolved selection, how each was chosen, and
whether its credentials are complete, for startup or health diagnostics — see
`getProviderSummary()`, exposed at `GET /api/health`. It carries no URLs,
tokens, or other credential-bearing values, and it lists any deprecated
variable alias in use by name only. This is a configuration check, not a live
connectivity probe, so it reports a provider as `degraded` only when it was
_explicitly_ selected without the credentials it requires — it does not by
itself detect a currently-unreachable database or cache. Runtime provider
availability changes have a separate, structured event vocabulary
(`provider_unavailable`, `provider_fallback`, `provider_degraded`,
`provider_recovered` — see `src/lib/providers/events.ts`); the search-provider
fallback path is wired to emit `provider_fallback` today (see "Catalog-search
migration" below), and the helpers are available for other capabilities to
adopt the same way.

#### Catalog-search migration

Catalog search reads use one selected provider while product writes may safely
continue when optional indexing fails. `postgres` is the baseline and queries
the product database with the existing `ILIKE` fallback; it does not provide
hosted typo tolerance, facets, highlighting, or suggestions. `algolia` uses
`ALGOLIA_APP_ID`, `ALGOLIA_ADMIN_API_KEY`, and an environment-specific
`ALGOLIA_PRODUCTS_INDEX`; the admin key is server-only. The optional
`ALGOLIA_SEARCH_API_KEY` is not used by the application because searches are
server-mediated. Existing `ALGOLIA_API_KEY` and `ALGOLIA_INDEX_NAME` values are
accepted as compatibility aliases.

For a cutover, configure the target provider, rebuild products from Admin →
Search Index Management, compare result counts and relevance, then set
`SEARCH_PROVIDER` to switch reads. Roll back by setting it to the prior
provider; PostgreSQL requires no reindex. Order search remains separate and
does not export order or customer data to Algolia.

##### Upstash Search → Algolia migration and rollback

Both `upstash` and `postgres` are read-cheap to roll back from because neither
requires deleting anything from the abandoned provider — Algolia is the only
side of this migration with state (an index) that needs deliberate cleanup.
Product writes already fan out to whichever provider is selected at write
time (`src/lib/search/index.ts`); migrating providers is a **read-cutover**
exercise, not a data-migration exercise, so the steps below are about
building confidence in the new index before flipping reads over, not about
moving rows.

1. **Provision** — create a dedicated Algolia application/index per
   environment (`ALGOLIA_PRODUCTS_INDEX=products_staging`,
   `products_production`, never a shared index across environments) and set
   `ALGOLIA_APP_ID` / `ALGOLIA_ADMIN_API_KEY` alongside the still-active
   `SEARCH_PROVIDER=upstash`. Configuring Algolia's credentials does not
   switch reads by itself — only `SEARCH_PROVIDER` does.
2. **Backfill** — from Admin → Search Index Management, run "Rebuild search
   index" once Algolia's credentials are present. This full-reindexes every
   product into Algolia over the admin API in `src/lib/search/algolia-adapter.ts`
   while `upstash` continues serving live reads, so a slow or interrupted
   backfill has zero customer-facing impact.
3. **Dual-write window** — leave both `UPSTASH_SEARCH_REST_URL`/`_TOKEN` and
   the Algolia variables configured together for at least one full release
   cycle. New/updated products index into whichever provider
   `SEARCH_PROVIDER` currently selects for reads — the previous provider's
   index will drift for products changed during the window, which is why
   re-running the backfill immediately before comparison (step 4) is
   required, not optional.
4. **Comparison** — re-run the backfill, then manually compare a representative
   query set (top search terms, empty-result queries, facet/filter
   combinations, typo-tolerance cases) between providers. Algolia additionally
   changes ranking/relevance behavior (typo tolerance, facets, highlighting)
   that PostgreSQL/Upstash do not provide — validate storefront autocomplete,
   facets, and sort against the acceptance queries from
   `__tests__/lib/search/` before cutover.
5. **Read cutover** — set `SEARCH_PROVIDER=algolia` and redeploy. This is the
   only step that changes customer-facing behavior; nothing before it is
   observable outside Admin.
6. **Monitoring** — watch for the structured `provider_fallback` log event
   (see `src/lib/providers/events.ts`, emitted from
   `searchProductIds` in `src/lib/search/product-search.ts` on every
   provider search failure) for the first 24–48 hours. A sustained rise
   indicates Algolia is rejecting or timing out requests and reads are
   silently falling back to the PostgreSQL `ILIKE` path. `/api/health`'s
   `search` entry only reports _configuration_ problems (an explicitly
   selected provider missing required credentials); it does not probe live
   Algolia connectivity, so it will not by itself show a rate-limited or
   momentarily-unreachable Algolia as degraded.
7. **Rollback** — set `SEARCH_PROVIDER` back to `upstash` (or `postgres`) and
   redeploy; both accept reads immediately with no reindex, because the prior
   provider's index was never deleted or degraded by the migration. Rollback
   is safe at any point up through cleanup (step 8).
8. **Cleanup** — only after the new provider has served production reads
   without rollback for a full retention/monitoring window, delete the old
   Upstash Search index/database and remove its environment variables. Do
   this last and deliberately: cleanup is the one step that is not reversible.

### Web push setup

Web push uses the service worker already registered for the PWA, so no extra
infrastructure is required — only a VAPID key pair.

1. Generate the key pair once per environment:

   ```bash
   npx web-push generate-vapid-keys
   ```

2. Set the resulting values as environment variables:

   | Variable            | Required | Purpose                                                                        |
   | ------------------- | -------- | ------------------------------------------------------------------------------ |
   | `VAPID_PUBLIC_KEY`  | Yes      | Application server key. Served to clients by `GET /api/account/notifications`. |
   | `VAPID_PRIVATE_KEY` | Yes      | Signs push requests. Treat as a secret and never expose it to the browser.     |
   | `VAPID_SUBJECT`     | No       | Contact URI (`mailto:` or `https:`) sent to push services.                     |

3. Apply the migration that adds the `NotificationPreference` and
   `PushSubscription` tables:

   ```bash
   npm run db:migrate
   ```

4. Verify the deployment is served over HTTPS. Browsers refuse to register push
   subscriptions on insecure origins (`localhost` is exempt).

Operational notes:

- When the key pair is absent, push sending is skipped and the account
  preference centre reports push as unavailable; email delivery is unaffected.
- Rotating `VAPID_PRIVATE_KEY` invalidates every stored subscription. Customers
  must opt in again; stale endpoints are pruned automatically when the push
  service returns `404`/`410`.
- Subscriptions are per browser/device, so a customer opting in on a phone does
  not receive push on their laptop until they opt in there too.

### Image storage

Uploaded images (product photos, return evidence) are written through the
provider-neutral adapters in `src/lib/storage/`, selected by
`STORAGE_PROVIDER`:

- **`vercel`** (default when unset): uses Vercel Blob. Requires
  `BLOB_READ_WRITE_TOKEN`.
- **`s3`**: generic S3-compatible adapter (`@aws-sdk/client-s3`) that works
  with AWS S3, MinIO, Cloudflare R2, DigitalOcean Spaces, Backblaze B2,
  Wasabi, and similar providers. Requires `S3_REGION`, `S3_BUCKET`,
  `S3_ACCESS_KEY_ID`, `S3_SECRET_ACCESS_KEY`, and `S3_PUBLIC_BASE_URL`.
  Optional: `S3_ENDPOINT`, `S3_FORCE_PATH_STYLE`, and
  `S3_CA_CERT_PEM` (for local/self-hosted TLS endpoints that use a private CA).
- **`r2`**: backward-compatible Cloudflare preset over the same S3 adapter.
  Existing `R2_*` variables remain accepted as migration aliases.

Reads fall back from the active provider to other **configured** providers
(`resolveStorageUrl` in `src/lib/storage/index.ts`), with structured
`storage_dual_read_fallback` / `storage_dual_read_miss` log events — so
switching `STORAGE_PROVIDER` is safe before every historical object has been
copied over. Unconfigured providers are never probed on fallback reads. To
backfill existing objects, run the idempotent, resumable migration script:

```bash
# Report what would be copied, without writing anything
npm run migrate:storage

# Perform the copy to the active STORAGE_PROVIDER (verifies each object after
# writing; never deletes the source)
npm run migrate:storage -- --apply

# Explicit source/destination (useful for roll-forward/rollback drills)
npm run migrate:storage -- --apply --from=vercel --to=s3
npm run migrate:storage -- --apply --from=s3 --to=vercel
```

The script writes a resumable checkpoint to
`.storage-migration-checkpoint.json` (git-ignored) so an interrupted run
picks back up instead of restarting; pass `--checkpoint=<path>` to override
its location, `--limit=<n>` to cap objects per run, or `--prefix=<prefix>`
to scope it to a subset of keys. `--from` / `--to` accept `vercel`, `s3`,
and `r2`.

Fallback provider order is configurable:

- `STORAGE_FALLBACK_PROVIDERS` — global comma-separated fallback order.
- `STORAGE_FALLBACK_VERCEL`, `STORAGE_FALLBACK_R2`, `STORAGE_FALLBACK_S3` —
  per-primary overrides.

If unset, defaults remain migration-friendly (`vercel → r2,s3`, `r2 → vercel,s3`, `s3 → r2,vercel`).

Public object serving can use a native provider URL (for example an S3 virtual
hosted endpoint) or a custom `S3_PUBLIC_BASE_URL`/`R2_PUBLIC_BASE_URL` routed
through Nginx, MinIO gateway, CDN, or similar edge proxy.

#### Image resizing Worker

Product images are served through a Cloudflare Worker
(`workers/images/`) that validates the request, resizes via Cloudflare's
Image Resizing (`cf.image`), and serves the result with an immutable
`Cache-Control`. `next/image` is pointed at it through the custom loader in
`src/lib/image-loader.ts` and the `NEXT_PUBLIC_IMAGE_WORKER_URL` environment
variable — when that variable is unset, the loader falls back to the
original (unoptimized) source URL, so image rendering never depends on the
Worker being deployed.

Deployment is automated by
[`.github/workflows/deploy-images-worker.yml`](../.github/workflows/deploy-images-worker.yml)
on pushes to `develop` touching `workers/images/**`, using the
`CLOUDFLARE_API_TOKEN` and `CLOUDFLARE_ACCOUNT_ID` repository secrets. The
destination Cloudflare zone must have Image Resizing enabled. See
[`workers/images/README.md`](../workers/images/README.md) for the request
contract, local development (`npx wrangler dev`), and the hostname
allow-list (`ALLOWED_HOSTNAMES` in `workers/images/wrangler.toml`) that
replaces `next.config.ts`'s `images.remotePatterns` (which cannot coexist
with a custom `images.loader`).

## Platform-Specific Instructions

For a fully self-hosted deployment — Next.js, Nginx, Postgres, Redis, and
MinIO all on one VM instead of the managed platforms below — see
[`docs/kamatera-deployment.md`](./kamatera-deployment.md).

### 1. Vercel (Recommended)

**Step 1: Prepare your database**

```bash
# Use Vercel Postgres or external provider
# For Vercel Postgres:
vercel postgres create
```

**Step 2: Set up Redis**

- Sign up at [Upstash](https://upstash.com)
- Create a Redis database
- Copy the connection URL

**Step 3: Deploy**

```bash
# Install Vercel CLI
npm i -g vercel

# Deploy
vercel

# Add environment variables via Vercel dashboard or CLI:
vercel env add DATABASE_URL
vercel env add REDIS_URL

# Redeploy to apply environment variables
vercel --prod
```

**Step 3.1: Configure the async workflow orchestrator**

All background work — checkout order creation, transactional email, search
indexing, cache invalidation and scheduled jobs — runs on Inngest, served from
the single endpoint `/api/inngest`.

**Runtime budget:** Fluid Compute is enabled for this project, so the platform
ceiling is 300s. The routes that can hold a `PROCESSING` claim on a checkout
request deliberately declare a much lower `maxDuration = 30`; see
`STALE_PROCESSING_CLAIM_MS` in `src/lib/db-queries.ts` for the invariant that
ties the two together. Raising either value without the other can strand a
checkout request.

Required Inngest setup:

```env
INNGEST_EVENT_KEY=...
INNGEST_SIGNING_KEY=...
```

- Register the app at `https://your-domain.com/api/inngest` in the Inngest dashboard.
- Scheduled work is declared as `cron` triggers on Inngest functions, so no
  platform cron configuration is required: failed-email retries run daily at
  02:30 UTC, exchange rates daily at 03:00 UTC, abandoned-cart scans daily at
  10:00 UTC, stock-reservation expiry hourly, affinity scoring daily at 04:00
  UTC, and activity retention monthly at 04:00 UTC on day one.
- Failed-email retry rows are queued in groups of ten. Each child run processes
  at most five rows concurrently under the existing function-level concurrency
  and provider throttle, reducing `/api/inngest` fan-out while keeping bounded
  failure isolation.
- If `INNGEST_EVENT_KEY` is unset, checkout still completes: the API route
  processes the request inline via `waitUntil` as a last-resort safety net. That
  path has no durability or retries, so treat an unset key as an outage, not a
  supported configuration.
- Inngest Realtime carries the checkout settlement push consumed by
  `GET /api/checkout/{id}/stream`. It needs no extra keys or middleware, and the
  SDK stays server-side — the browser only ever speaks Server-Sent Events. With
  no event key the stream still settles the customer's wait from its own status
  re-reads, just less promptly.
- The stream route declares `maxDuration = 60` and closes each connection
  shortly before that, so the browser reconnects on a clean end rather than a
  platform kill. It holds no checkout claim, so it is exempt from the
  `maxDuration = 30` rule above. Any proxy in front of the app must not buffer
  `text/event-stream` responses, or the push arrives no sooner than a poll would
  have.

Email provider environment variables remain separate:

```env
NEXT_PUBLIC_APP_URL=https://your-domain.com
```

**Step 4: Run migrations**
Run migrations **before** the new code is deployed (see
[Database Migrations](#database-migrations)):

```bash
# In your local project with DATABASE_URL pointing to production
npm run db:migrate
```

On a database that has never been initialized, `npm run db:migrate` applies the
full schema from an empty state. The project ships no sample-data seeding, so a
new production database starts empty.

**Vercel-specific notes:**

- Edge runtime compatible with minor adjustments
- Built-in CDN for static assets
- Automatic HTTPS
- Order checkout requests are persisted first, then handed to Inngest for background order creation.
- Recovery for transient checkout failures is automatic through Inngest retries; the admin page is for visibility, not manual requeue actions.
- Email delivery failures surface as failed Inngest runs and as rows in `failedEmails`, independently of checkout health.

---

### 2. AWS (Lambda + API Gateway)

**Prerequisites:**

- AWS account
- AWS CLI configured

**Step 1: Set up infrastructure**

```bash
# Install Serverless Framework
npm i -g serverless

# Create serverless.yml in project root
```

**serverless.yml example:**

```yaml
service: ecommerce-app

provider:
  name: aws
  runtime: nodejs22.x
  region: us-east-1
  environment:
    DATABASE_URL: ${env:DATABASE_URL}
    REDIS_URL: ${env:REDIS_URL}

functions:
  app:
    handler: .next/standalone/index.handler
    events:
      - http: ANY /
      - http: 'ANY /{proxy+}'

plugins:
  - serverless-nextjs-plugin
```

**Step 2: Deploy**

```bash
serverless deploy
```

---

### 3. Google Cloud Run

**Prerequisites:**

- Google Cloud account
- gcloud CLI installed

**Step 1: Create Dockerfile**

```dockerfile
FROM node:22-alpine

WORKDIR /app

COPY package*.json ./
RUN npm ci --only=production

COPY . .
RUN npm run build

EXPOSE 3000

CMD ["npm", "start"]
```

**Step 2: Deploy**

```bash
# Build and push container
gcloud builds submit --tag gcr.io/PROJECT_ID/ecommerce

# Deploy to Cloud Run
gcloud run deploy ecommerce \
  --image gcr.io/PROJECT_ID/ecommerce \
  --platform managed \
  --region us-central1 \
  --allow-unauthenticated \
  --set-env-vars DATABASE_URL=$DATABASE_URL,REDIS_URL=$REDIS_URL
```

---

### 4. Cloudflare Pages

**Step 1: Prepare for Cloudflare**

- Cloudflare Pages uses edge runtime
- May need to adjust Drizzle connection for edge

**Step 2: Connect repository**

- Go to Cloudflare Pages dashboard
- Connect your GitHub repository
- Configure build settings:
  - Build command: `npm run build`
  - Build output directory: `.next`
  - Root directory: `/`

**Step 3: Add environment variables**
Add in Cloudflare Pages dashboard:

- `DATABASE_URL`
- `REDIS_URL`

**Step 4: Deploy**

- Cloudflare automatically deploys on git push

---

### 5. Railway

**Easiest option for beginners**

**Step 1: Sign up**

- Go to [railway.app](https://railway.app)
- Connect GitHub account

**Step 2: Deploy**

1. Click "New Project" → "Deploy from GitHub repo"
2. Select your repository
3. Railway auto-detects Next.js

**Step 3: Add services**

1. Add PostgreSQL database (built-in)
2. Add Redis (built-in)
3. Railway automatically sets DATABASE_URL

**Step 4: Configure environment variables**

- `REDIS_URL` (from Railway Redis)

**Step 5: Run migrations**

```bash
# Use Railway CLI
railway run npm run db:migrate
```

---

## Database Migrations

### Ordering: migrate before deploy

`.github/workflows/build.yml` runs `database-migrations-preview` /
`database-migrations-production` **before** `deploy-preview` /
`deploy-production`. A deploy is blocked if its migration job fails.

`.github/workflows/build-self-hosted.yml` defines the same migration and deploy
jobs on the same triggers, so a push to `develop` or `master` currently runs
each of them twice — once on a GitHub-hosted runner and once on the self-hosted
pool. `drizzle-kit migrate` is idempotent, so the second run applies nothing,
but the two runs are not serialised against each other and both deploy. Decide
which pool owns the deployment path and remove the migration and deploy jobs
from the other workflow; until then, treat a double preview deployment on a
single push as expected rather than as a symptom.

Running migrations after the deploy would leave the new code serving live
traffic against the old schema for the whole duration of the migration job:
additive-column releases throw runtime errors during that window, and releases
that depend on a new table fail outright.

The inverted order moves the risk to the other side: between the migration
finishing and the deploy completing, the **old** code runs against the **new**
schema. That window is safe only if migrations follow expand/contract.

### Expand/contract discipline (required)

Every schema change must be split so that both the old and the new code version
tolerate both schema versions. Never combine an expand and a contract step in
the same release.

**Release N — expand (backward compatible):**

- Add columns as nullable, or with a database default. Never `NOT NULL` without
  a default.
- Add new tables and indexes. These are invisible to old code.
- Add new columns alongside old ones when renaming; do not `ALTER ... RENAME`.
- Backfill data in a separate, idempotent step.

**Release N — application code:**

- Write to both the old and the new column while both exist.
- Read from the new column with a fallback to the old one.

**Release N+1 — contract (only after N is fully rolled out):**

- Stop writing and reading the old column.

**Release N+2 — drop:**

- Drop the old column, table, or index.

**Never do in a single release:**

| Unsafe                                  | Safe equivalent                                                       |
| --------------------------------------- | --------------------------------------------------------------------- |
| `ALTER TABLE ... RENAME COLUMN`         | Add new column → dual-write → backfill → drop old column (3 releases) |
| Add `NOT NULL` column without a default | Add nullable → backfill → add `NOT NULL` constraint (2 releases)      |
| Drop a column still read by live code   | Stop reading it in release N, drop it in release N+1                  |
| Change a column type in place           | Add new typed column → dual-write → backfill → drop old               |
| Rename or drop a table                  | Create new table → dual-write → backfill → drop old                   |

### Authoring checklist

- [ ] Migration generated with `npm run db:generate` (never hand-edited after being applied)
- [ ] Generated SQL in `drizzle/` reviewed by a human
- [ ] Change is additive only, or is the contract half of a previously shipped expand
- [ ] The currently deployed code still works against the new schema
- [ ] Backfills are idempotent and safe to re-run
- [ ] New columns on large tables are nullable or defaulted, to avoid a full table rewrite
- [ ] Applied and verified locally against a development database

---

## Post-Deployment Checklist

- [ ] Database migrations completed
- [ ] Seed data loaded
- [ ] Environment variables set
- [ ] Redis connection working
- [ ] Admin panel accessible
- [ ] Product listing displays correctly
- [ ] Order creation works
- [ ] Inngest app is registered and `process-checkout-request` runs are succeeding
- [ ] Checkout requests appear in `/admin/checkout-requests`
- [ ] Transactional email functions are running on Inngest
- [ ] Cache invalidation working

## Monitoring

### Check Application Health

```bash
# Health check endpoint
curl https://your-domain.com/api/health
# Expected: { "status": "ok" }

# Test product API
curl https://your-domain.com/api/products

# Test admin API (requires token)
curl -H "Authorization: Bearer YOUR_TOKEN" \
  https://your-domain.com/api/admin/products
```

### Monitor Performance

- Set up logging (Sentry, LogRocket, Datadog)
- Monitor database connections
- Monitor Redis cache hit rate
- Track API response times

## Scaling Considerations

### Database

- Enable connection pooling (PgBouncer for PostgreSQL)
- Use read replicas for high read loads
- Consider PgBouncer or Neon pooler for connection pooling

### Redis

- Monitor memory usage
- Adjust TTL values based on traffic
- Consider Redis Cluster for high traffic

### Application

- Enable CDN for static assets
- Use edge locations when available
- Monitor cold start times
- Optimize image sizes

## Security Best Practices

1. **Rotate admin token regularly**
2. **Use SSL/TLS for all connections**
3. **Enable database SSL** (set `sslmode=require` in DATABASE_URL)
4. **Use environment-specific secrets**
5. **Enable rate limiting** (Vercel/Cloudflare built-in, or use middleware)
6. **Monitor for suspicious activity**
7. **Set `NEXTAUTH_URL`** to your production domain with `https://`
8. **Security headers are configured automatically** (CSP, HSTS, Referrer-Policy, Permissions-Policy) via `next.config.ts`

## Troubleshooting

### Build Failures

- Check Node.js version (22+)
- Ensure all dependencies installed
- Verify Drizzle migrations applied successfully

### Database Connection Issues

- Check DATABASE_URL format
- Verify network access (whitelist IPs)
- Enable SSL if required
- Check connection limits

### Redis Connection Issues

- Verify REDIS_URL format
- Check Redis instance is running
- Ensure firewall allows connections
- Test connection independently

### Cache Not Working

- Verify Redis connection
- Check TTL values
- Monitor cache hit/miss rates
- Ensure cache keys are correct

## Cost Optimization

### Free Tier Options

- **Vercel**: 100GB bandwidth/month
- **Supabase**: 500MB database, 2GB bandwidth
- **Upstash Redis**: 10,000 requests/day
- **Railway**: $5 free credit/month

### Paid Recommendations

- Start with smallest plans
- Monitor usage patterns
- Scale based on actual needs
- Use autoscaling when available

## Support

For issues:

1. Check [GitHub Issues](https://github.com/konarsubhojit/friendly-octo-giggle/issues)
2. Review deployment platform docs
3. Check database/Redis provider status pages
