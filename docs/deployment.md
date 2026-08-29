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
- Vercel Blob or Cloudflare R2: admin image upload. See [Image storage](#image-storage).
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
`ALGOLIA_API_KEY`, or `CACHE_PROVIDER=redis` without `REDIS_URL`, is rejected at
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
`DATABASE_POOL_IDLE_TIMEOUT_MS`, and
`DATABASE_POOL_CONNECTION_TIMEOUT_MS`. Defaults are 10 connections, 20 seconds
idle timeout, and 5 seconds connection timeout. `READ_DATABASE_URL` remains
optional and falls back to `DATABASE_URL`.

For self-hosted deployments, the generic protocols — `postgres`, `redis`, and
`s3` — are the recommended selections; managed values (`neon`, `upstash`,
`vercel`, `edge-config`) remain available for deployments that need their
specialized adapters.

`summarizeProviders()` renders the resolved selection, how each was chosen, and
whether its credentials are complete, for startup or health diagnostics. It
carries no URLs, tokens, or other credential-bearing values, and it lists any
deprecated variable alias in use by name only. Provider availability changes are
reported as the structured `provider_unavailable`, `provider_fallback`,
`provider_degraded`, and `provider_recovered` log events.

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
- **`r2`**: uses Cloudflare R2 through its S3-compatible API
  (`@aws-sdk/client-s3`). Requires `R2_ACCOUNT_ID`, `R2_ACCESS_KEY_ID`,
  `R2_SECRET_ACCESS_KEY`, `R2_BUCKET`, and `R2_PUBLIC_BASE_URL` (see
  `.env.example`).

Reads always fall back from the active provider to the other one
(`resolveStorageUrl` in `src/lib/storage/index.ts`), with structured
`storage_dual_read_fallback` / `storage_dual_read_miss` log events — so
switching `STORAGE_PROVIDER` to `r2` is safe before every historical object
has been copied over. To backfill existing Vercel-stored objects into R2,
run the idempotent, resumable migration script:

```bash
# Report what would be copied, without writing anything
npm run migrate:storage

# Perform the copy (verifies each object after writing; never deletes
# the Vercel source)
npm run migrate:storage -- --apply
```

The script writes a resumable checkpoint to
`.storage-migration-checkpoint.json` (git-ignored) so an interrupted run
picks back up instead of restarting; pass `--checkpoint=<path>` to override
its location, `--limit=<n>` to cap objects per run, or `--prefix=<prefix>`
to scope it to a subset of keys.

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
- Scheduled work (failed-email retries, exchange-rate refresh, abandoned-cart
  scan) is declared as `cron` triggers on Inngest functions, so no platform cron
  configuration is required.
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
