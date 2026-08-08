# Architecture Documentation

## Table of Contents

1. [Current Status Snapshot](#1-current-status-snapshot)
2. [System Overview](#2-system-overview)
3. [Tech Stack](#3-tech-stack)
4. [Data Layer](#4-data-layer)
5. [Authentication and Access Control](#5-authentication-and-access-control)
6. [Request and Data Flows](#6-request-and-data-flows)
7. [Caching, Search, and State](#7-caching-search-and-state)
8. [Async Work, Email, and Scheduled Jobs](#8-async-work-email-and-scheduled-jobs)
9. [Security, Configuration, and Deployment](#9-security-configuration-and-deployment)
10. [Performance Characteristics](#10-performance-characteristics)

---

## 1. Current Status Snapshot

As of August 2026, the project is a Next.js 16 App Router storefront running on the Cache Components rendering model: public surfaces are served as a prerendered static shell with per-request regions streamed into `Suspense` holes, while user- and admin-specific data is read by dynamic route handlers.

Key current-state points:

- Public pages such as the shop page and product detail pages serve catalog data from `"use cache"` scopes with explicit `cacheLife` profiles and entity-keyed `cacheTag` values. The legacy segment model (`export const dynamic` / `revalidate` / `runtime`) has been removed entirely — Next.js 16.2 rejects it when `cacheComponents` is enabled.
- The application uses Neon PostgreSQL through Drizzle with a primary connection plus an optional read replica via `withReplicas`.
- Authentication is handled by NextAuth v5 with Google OAuth, Microsoft Entra ID, and credentials-based login.
- Sessions use JWT strategy with secure cookies, while the Drizzle adapter persists auth-related records such as users, accounts, and verification tokens.
- Redis, Upstash Search, MailerSend, Google SMTP, and Vercel Edge Config are all optional integrations; the codebase degrades gracefully when those environment variables are absent.
- Email delivery is asynchronous and event-driven, with failed-email persistence plus retry cron jobs.
- Exchange rates are refreshed on a schedule and cached by UTC date.

---

### July 2026 capability update

The runtime now also includes currency preferences, installable PWA metadata and offline fallback, a guest-accessible AI product assistant, staged checkout pages backed by durable checkout requests processed by Inngest, advanced search suggestions/click analytics, account address management, admin import/export and bulk actions, checkout queue visibility, Prometheus metrics, and Sentry instrumentation. See [Feature Catalog](./features.md) for the user-facing inventory.

## 2. System Overview

The architecture is a serverless-first e-commerce system built around a small number of stable layers:

```
┌──────────────────────────────────────────────────────────────┐
│                    Presentation Layer                        │
│  Next.js App Router                                          │
│  • Server Components by default                              │
│  • Client Components for interactivity                       │
│  • Root providers: Redux, Theme, Currency, Session, Toast           │
│  • Vercel Analytics + Speed Insights                         │
└──────────────────────────────────────────────────────────────┘
                               ↓
┌──────────────────────────────────────────────────────────────┐
│                    Application Layer                         │
│  • Route handlers under app/api                              │
│  • Server Actions for some order and Redis workflows         │
│  • Domain services in lib/                                   │
│  • Zod validation + structured logging                       │
└──────────────────────────────────────────────────────────────┘
                               ↓
┌──────────────────────────────────────────────────────────────┐
│                    Data and Service Layer                    │
│  • Neon PostgreSQL via Drizzle ORM                           │
│  • Optional Upstash Redis cache                              │
│  • Optional Upstash Search index                             │
│  • Inngest durable workflows for all background work         │
│  • Optional Vercel Edge Config for feature/shipping config   │
│  • Vercel Blob for product images                            │
└──────────────────────────────────────────────────────────────┘
```

The dominant design principles in the current code are:

- Server Components perform direct database reads where possible.
- User- and admin-scoped mutations go through route handlers or server-side services.
- Infra dependencies are treated as optional accelerators, not hard runtime requirements.
- Shared concerns such as logging, validation, caching, and serialization live in `lib/`.

---

## 3. Tech Stack

### Frontend

| Technology    | Version | Purpose                                                          |
| ------------- | ------- | ---------------------------------------------------------------- |
| React         | 19.2.4  | Rendering, client interactivity, server components               |
| Next.js       | 16.1.6  | App Router, route handlers, Cache Components, image optimization |
| TypeScript    | 5.9.3   | Static typing across app, services, and tests                    |
| Tailwind CSS  | 4.1.18  | Styling system and design tokens                                 |
| Redux Toolkit | 2.11.2  | Shared client state for cart, orders, admin, wishlist            |

### Backend and Domain Services

| Technology      | Version       | Purpose                                               |
| --------------- | ------------- | ----------------------------------------------------- |
| NextAuth        | 5.0.0-beta.30 | Authentication and session management                 |
| Drizzle ORM     | 0.45.1        | Type-safe PostgreSQL access                           |
| Neon Serverless | 0.10.0        | PostgreSQL connection pools for Vercel-style runtimes |
| Zod             | 4.3.6         | Runtime validation for inputs and env                 |
| Pino            | 10.3.1        | Structured logging and event tracing                  |

### Edge and Supporting Services

| Service                           | Purpose                                                 |
| --------------------------------- | ------------------------------------------------------- |
| Upstash Redis                     | Cache, stale-while-revalidate, lightweight shared state |
| Upstash Search                    | Product search index with DB fallback                   |
| Inngest                           | Durable, step-checkpointed background workflows         |
| Vercel Blob                       | Hosted media storage                                    |
| Vercel Edge Config                | Feature flags and shipping configuration                |
| Vercel Analytics / Speed Insights | Runtime telemetry                                       |
| MailerSend / Google SMTP          | Email delivery backends                                 |

---

## 4. Data Layer

### Database Topology

The codebase uses three Drizzle exports from `lib/db.ts`:

| Export             | Backing connection                 | Current role                                  |
| ------------------ | ---------------------------------- | --------------------------------------------- |
| `primaryDrizzleDb` | Primary Neon connection            | Writes, auth, and consistency-sensitive reads |
| `readDrizzleDb`    | Optional read replica              | Replica-only reads                            |
| `drizzleDb`        | `withReplicas(primary, [replica])` | Default read path for most queries            |

`READ_DATABASE_URL` is optional. When it is absent, both read and write traffic use `DATABASE_URL`.

### Identifier Strategy

The project no longer assumes generic CUID-style IDs for domain tables. Current patterns are:

- Auth tables such as `User`, `Account`, and `PasswordHistory` use text UUID-style values.
- Store domain entities such as products, categories, variants, carts, wishlists, reviews, and failed emails use short base62-style IDs.
- Orders use a dedicated short order ID format.

### Core Domain Tables

Current schema highlights:

- `User`: email, optional password hash, optional phone number, role, currency preference, image metadata.
- `Product`: base product record with `image`, `images`, category label, stock, and soft-delete timestamp.
- `ProductVariant`: per-variant stock, image set, name, design name, price modifier, soft-delete timestamp.
- `Category`: standalone category table with sort order and soft-delete support.
- `Order`: user association, customer snapshot fields, status, tracking number, shipping provider, timestamps.
- `OrderItem`: product snapshot with optional variant and `customizationNote`.
- `Cart` and `CartItem`: authenticated and guest cart support.
- `Wishlist` and `Review`: user engagement features.
- `ProductShare`: immutable short-link mapping for shareable product URLs.
- `FailedEmail`: retry queue and delivery history for email workflows.
- `NotificationPreference`: per-user transactional/marketing toggles for the email, push, and SMS channels. Missing rows fall back to code defaults.
- `PushSubscription`: Web Push endpoints and keys per user/device, unique on `endpoint`.

### Relationship Model

- Users have many orders, accounts, password history rows, wishlist entries, and push subscriptions, plus at most one notification preference row.
- Products have many variants, order items, cart items, wishlist entries, and reviews.
- Orders own their line items via cascade delete.
- Carts own cart items via cascade delete.
- Product shares optionally bind a product and a chosen variant.

### Soft Deletes

Products, variants, and categories use `deletedAt` instead of hard deletes for normal removal paths. Most public queries explicitly filter out soft-deleted rows.

---

## 5. Authentication and Access Control

### Providers and Session Model

The current auth layer uses NextAuth v5 with these providers:

- Google OAuth
- Microsoft Entra ID
- Credentials login using email or phone number plus password

The adapter uses `primaryDrizzleDb` so auth flows always hit the primary database. Session handling currently uses:

- JWT session strategy
- secure cookie names in production
- `httpOnly`, `sameSite=lax`, and `secure` in production

Although NextAuth tables such as `Session` still exist in the schema, the active runtime session strategy is JWT, not database sessions.

### Credentials Flow

The credentials provider supports:

- email or phone number lookup
- bcrypt-based password verification
- rejection of OAuth-only accounts without a password hash
- auth event logging for successful and failed logins

### Authorization

Role-based access control is enforced with the `role` field on the session user object:

- `CUSTOMER` for storefront and account access
- `ADMIN` for admin APIs and admin screens

Replica lag is treated as a real concern. Consistency-sensitive auth and account flows use the primary database directly instead of the replica-aware composite client.

---

## 6. Request and Data Flows

### Public Read Flow

The current public read path prefers Server Components and direct DB access.

Example pattern:

1. A page such as `/shop` renders on the server.
2. It fetches categories and bestsellers directly from Drizzle.
3. It optionally uses Upstash Search to resolve matching product IDs.
4. It falls back to DB search when the search service is unavailable.
5. It returns pre-rendered HTML plus the minimum client logic required for interactivity.

### Products API Flow

`GET /api/products` now behaves as a layered read path:

1. Parse pagination, category, and search params.
2. If a search term exists, try Upstash Search first.
3. If search is available, fetch matched IDs and hydrate products in ID order.
4. Otherwise fall back to DB search through Drizzle helpers.
5. Return `Cache-Control` headers using `s-maxage` and `stale-while-revalidate`.

### Order Read/Write Flow

Authenticated order routes are dynamic and session-aware:

1. `auth()` resolves the current user.
2. `GET /api/orders` rejects anonymous access.
3. `POST /api/orders` validates the caller and delegates to `lib/order-service`.
4. Service code handles validation, pricing, stock checks, persistence, cache invalidation, and downstream events.

### Cart Model

The current cart architecture still supports two ownership modes:

- authenticated carts keyed by `userId`
- guest carts keyed by `sessionId`

The database remains the source of truth, while Redis can cache cart results when configured.

Guest cart cookies use a signed `cart_session` value with the schema `v1.<sessionId>.<hmac>`:

- `sessionId` is the opaque guest cart identifier stored in the `Cart.sessionId` column.
- `hmac` is an HMAC-SHA256 signature over the literal string `cart-session:v1.<sessionId>` using `NEXTAUTH_SECRET`.
- The cookie is issued as `HttpOnly`, `SameSite=Lax`, and `Secure` in production with a 30-day lifetime.
- Authenticated cart reads and writes may merge a guest cart into the user cart, then rotate the cookie to a fresh guest session identifier so the previous guest session cannot be replayed.

### Product Variant and Pricing Model

Variant behavior in the live codebase is more capable than the earlier document described:

- variants can override image and image gallery content
- each variant has independent stock
- price is base product price plus variant price modifier
- order items snapshot unit price at order time
- order items can carry a `customizationNote`

---

## 7. Caching, Search, and State

### Two cache layers, one responsibility each

The application has two independent caches. Confusing them is the most common
source of stale-data bugs, so the boundary is explicit:

| Layer                            | Owns                                                                                                          | Does **not** own                                                      |
| -------------------------------- | ------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------- |
| Cache Components (`"use cache"`) | Render output for the prerendered public shell, invalidated by tag                                            | Cross-instance data reuse for route handlers                          |
| Redis (`getCachedData`)          | Cart, orders, admin lists, sales, exchange rates, share/pincode lookups, and the payloads of public read APIs | Anything inside a `"use cache"` scope — a nested Redis read is banned |
| PostgreSQL                       | The correctness floor: every cached path degrades to a direct query                                           | —                                                                     |

A `"use cache"` scope must never nest a Redis read. Doing so stores the same
rows twice under two independent expiries and splits invalidation across two
systems, so tag revalidation could clear one copy while the other keeps
serving superseded data. Cached scopes therefore call the database directly
(`db.products.findById(id, false)`, `db.products.findBestsellers({ withCache: false })`).

In a serverless deployment the two layers also differ in durability: the Cache
Components store is per-instance and does not survive a deployment, whereas
Redis is shared across instances. Redis remains the mechanism for cross-instance
reuse; Cache Components is what puts catalog markup into the initial HTML.

### Cache Components model

`next.config.ts` sets `cacheComponents: true` and declares three named
`cacheLife` profiles, anchored to the matching `CACHE_TTL` entries in
`src/lib/cache.ts` so the two layers cannot disagree:

| Profile    | `stale` | `revalidate` | `expire` | Used by                       |
| ---------- | ------- | ------------ | -------- | ----------------------------- |
| `catalog`  | 60      | 300          | 3600     | shop listing, bestsellers     |
| `product`  | 60      | 900          | 3600     | product detail                |
| `taxonomy` | 300     | 3600         | 86400    | category list, category chips |

Every cached scope names a profile explicitly; an implicit lifetime is a defect,
not a default. Time bounds are the safety net — tags are the freshness
mechanism. The tag vocabulary lives in `src/lib/cache-tags.ts`:

| Helper             | Tag                    | Revalidated by                                                          |
| ------------------ | ---------------------- | ----------------------------------------------------------------------- |
| `productTag(id)`   | `product:<id>`         | product/variant/option writes; order stock side effects                 |
| `productListTag()` | `products:list`        | anything that changes catalog membership (create, delete, bulk, import) |
| `bestsellersTag()` | `products:bestsellers` | order creation side effects, product delete                             |
| `categoriesTag()`  | `categories:list`      | category create, update, delete, reorder                                |

`revalidateCacheTags(tags, context)` is called from the same functions that
already perform Redis invalidation (`invalidateProductCaches` in
`src/lib/cache.ts`, `invalidateOrderCaches` in
`src/features/orders/services/order-cache.ts`), so the two layers cannot drift.
A tag revalidation failure is logged through `logError` and never fails the
originating write — the database is already updated, and the `cacheLife` bound
still guarantees eventual freshness.

Cached scopes may not read sessions, cookies, or headers. Currency remains a
client-side display concern in `CurrencyContext`, so cached price markup stays
currency-agnostic.

### Redis Caching Strategy

The cache layer in `lib/redis.ts` is optional and implements:

- fresh-hit reads
- stale-while-revalidate behavior
- distributed lock acquisition with a 10-second TTL
- `waitUntil()` background refresh on stale hits
- graceful fetch-through behavior when Redis is unavailable

Cache invalidation supports both exact-key deletes and glob-based invalidation through Redis `SCAN`.

Representative cache families include:

- product lists and product detail pages
- bestseller lists
- category lists
- cart snapshots
- user order lists and order detail records
- admin lists for products, orders, users, and sales
- daily exchange-rate snapshots
- product-share resolution

### Search Architecture

Product search is split into two layers:

1. Upstash Search, when configured, provides indexed lookup by query and optional category.
2. Drizzle/SQL fallback preserves functionality when search infra is missing or degraded.

Order search follows a similar hybrid strategy:

- try Redis-backed order search helpers first
- fall back to direct SQL search against orders, product names, and variant names
- cache successful DB search results for short periods

### Client State and Providers

The root layout composes these providers in the browser:

- Redux store
- theme provider
- currency provider
- NextAuth session provider
- toast notifications

This means user identity, theme selection, currency formatting, and shared UI state are available globally without turning the whole app into a client-rendered shell.

---

## 8. Async Work, Email, and Scheduled Jobs

### Durable Checkout Processing

The HTTP request the customer waits on never verifies payment or creates an
order. `enqueueCheckoutForUser` validates the submission, persists a
`CheckoutRequest` row, hands it to an orchestrator, and returns.

Processing then runs as four independently repeatable steps, all exported from
`features/cart/services/checkout-service.ts`:

1. **Preflight** — skip when the request is missing, already has an order, or is
   already settled. Read-only apart from a self-healing status write.
2. **Claim** — compare-and-swap the row into `PROCESSING`. Duplicate publishes,
   queue redeliveries, webhook triggers and durable retries all race here; only
   the winner proceeds.
3. **Create order** — verify payment and persist the order. These stay in one
   call on purpose: "money confirmed" and "order exists" must either both happen
   or neither, so there is never a window where a customer is charged with no
   order. The step is idempotent in both directions: it returns any order that
   already exists instead of creating a second one, and if a peer trigger wins
   the race to the insert it adopts that order rather than recording a failure.
4. **Record failure** — classify the error. Client-side failures (4xx) are
   terminal; anything else resets to `PENDING` for another attempt.

Inngest (`/api/inngest`, triggered by `checkout/request.created`) is the sole
orchestrator. Each step is checkpointed, so a retry resumes after the last
completed step and never re-verifies payment.

`enqueueCheckoutForUser` publishes to Inngest and, only if that publish fails or
Inngest is unconfigured, processes inline via `waitUntil`. The publish is given a
bounded wall-clock budget so a degraded Inngest API hands over to the inline path
instead of holding the customer's request open until the platform kills it at
`maxDuration`. The payment webhook is an independent trigger for the same steps.

Two invariants keep a killed worker from stranding a request:

- Every route that can hold a claim declares `maxDuration = 30`, which is below
  `STALE_PROCESSING_CLAIM_MS`, so a live claim can never be stolen mid-flight.
- `STALE_PROCESSING_CLAIM_MS` is below the queue's `retryAfterSeconds`, so the
  redelivery that follows a killed worker can actually reclaim the request.

Duplicate orders are impossible regardless: `Order.checkoutRequestId` and
`Order.paymentTransactionId` are both unique.

### Inventory Reservation

Because the order — and therefore the stock decrement — is created by the
durable pipeline rather than by the request the customer waits on, the units a
shopper has committed to are still on the shelf for as long as the queue takes.
Reservations close that window by taking an explicit hold at request acceptance.

`features/orders/services/stock-reservation.ts` is the only module that writes
reservation state. It owns two pieces of storage:

- `StockReservation` — the ledger. One row per checkout request × variant, with
  status `HELD`, `CONSUMED`, `RELEASED` or `EXPIRED`, an `expiresAt` stamp, and
  `UNIQUE (checkoutRequestId, variantId)` so a replayed grant cannot double-hold.
- `ProductVariant.reservedStock` — a denormalised counter of units currently
  held. Availability is `stock - reservedStock`, computed on read and never
  stored.

The grant is a single conditional statement per variant:

```sql
UPDATE "ProductVariant"
   SET "reservedStock" = "reservedStock" + $q
 WHERE id = $v AND "deletedAt" IS NULL AND stock - "reservedStock" >= $q
RETURNING id
```

Zero rows updated *is* the denial — the same compare-and-swap idiom the codebase
uses for coupon `usageCount` and the order stock decrement, so no two concurrent
requests can be granted the same last unit. The grant is all-or-nothing and
locks variants in sorted id order to avoid deadlock between overlapping carts.

Every transition is claim-shaped, so replays are harmless:

- **Consume** — inside the same transaction as the order insert and stock
  decrement, `HELD → CONSUMED` and `reservedStock` drops by the consumed units.
- **Release** — on terminal checkout failure and on retry exhaustion, best
  effort: a failed release is logged and never masks the original failure.
- **Expire** — `expire-stock-reservations` runs every five minutes, claims at
  most 500 rows whose `expiresAt` has passed **by the database clock**, and
  returns their units. The 30-minute TTL is far longer than the pipeline's
  worst observed latency, so expiry only ever reclaims abandoned holds.

Restock (`Order.stockRestoredAt`) credits `stock` only. Reserved units are
already accounted for by the ledger, so a cancellation never inflates the
counter.

Availability is deliberately kept **out** of `"use cache"` catalog scopes: a
cached page may show a slightly stale number, but every rejecting decision point
— add to cart, cart read, order validation — recomputes it per request. Order
validation runs on behalf of a request that already holds its own reservation,
so it adds that request's held quantities back before comparing.

Admin surfaces expose the split: the checkout-requests dashboard shows
reservation state and expiry, variant views show on-hand / reserved / available,
and a manual release (`orders:update`, audit-logged) exists for a stuck request.
Editing a variant's stock below its reserved quantity is rejected with 409.
`application_stock_reservations_total` counts each outcome
(`granted`, `denied`, `consumed`, `released`, `expired`, `manually_released`).

### Checkout Settlement Push

The payment page does not ask whether the order exists yet; it is told.

Every settlement in `checkout-service.ts` goes through one status writer, which
announces terminal statuses on a per-request Inngest Realtime channel
(`checkout:{id}`). Whichever path settles the request — the durable run, the
inline `waitUntil` fallback, the payment webhook, the retry-exhaustion handler
or the status self-heal — the announcement happens at that single seam.

`GET /api/checkout/{id}/stream` bridges the channel to the browser as
Server-Sent Events, which keeps the Inngest SDK server-side: the browser needs
no subscription token and ships no extra client bundle. The route authorizes the
request once (the status read doubles as the ownership check, so another
customer's request is a 404 before any subscription opens), emits the current
status immediately, then holds the connection for a window shorter than the
platform's request ceiling so it can close cleanly and let the browser reopen.

Realtime is an accelerator, not the contract:

- The `CheckoutRequest` row stays the source of truth. The bridge re-reads it on
  a timer behind the subscription — slowly when Realtime is connected, briskly
  when it is not — so a dropped message, or an environment with no Inngest keys
  at all, still settles the wait.
- The announcement is best-effort and bounded by the same publish budget as
  event dispatch. It runs after the status write, and cannot fail it.
- The browser (`features/cart/services/checkout-stream.ts`) reconnects on a
  stream that ends without a settlement and gives up only at its own deadline.

The customer-visible win is latency: settlement arrives when the order exists
rather than at the next poll tick. The systemic win is that the wait no longer
spends rate-limit budget per tick on a bucket shared with the rest of the API.

### Async Email Delivery

Email dispatch is event-driven.

The current flow is:

1. Domain code publishes a typed event (`order/created`, `order/status.changed`,
   `order/refunded`, `auth/*.requested`) through `dispatchWorkflowEvent()`.
2. An Inngest function consumes it. Payloads are Zod-validated at the event
   boundary via `eventType()`.
3. Duplicate sends are prevented by the function's `idempotency` key rather than
   a database lookup.
4. Each function dispatches through `lib/notifications/order-notifications.ts`
   and, on terminal failure, records the message via `onFailure`.

### Notification Fan-out and Preferences

`lib/notifications/order-notifications.ts` is the single fan-out point for order
notifications and is used by the Inngest email functions as well as the direct
fallbacks in order creation and admin status updates. For every send it:

1. Resolves the recipient from the customer email. Guests (no user row) keep the
   defaults, so receipts still reach them while marketing stays opt-in.
2. Sends the email only when the transactional email channel is enabled, logging
   `notification_suppressed_by_preference` otherwise.
3. Sends Web Push only for signed-in recipients that enabled the push channel.

### Web Push

Push uses the PWA service worker (`public/sw.js`), which handles `push`,
`notificationclick`, and `pushsubscriptionchange`. Delivery requires a VAPID key
pair (`VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`, optional `VAPID_SUBJECT`); when
unset, push is skipped and email delivery is unaffected. Subscriptions are
per-device, stored in `PushSubscription`, and endpoints the push service reports
as `404`/`410` are deleted so revoked/expired grants do not accumulate. Push
failures never block the email path.

### Email Providers

Email delivery currently prefers Google SMTP when configured and falls back to MailerSend when available. If neither provider is configured, the app logs a skipped email event rather than crashing the request.

### Failed Email Persistence and Retry

Non-successful sends are tracked in the `FailedEmail` table with:

- attempt count
- retriable flag
- current status (`pending`, `failed`, `sent`)
- full error history
- timestamps for created, last attempted, and sent

Retry behavior currently caps scheduled retries at 20 records per run and 5 attempts per record.

### Scheduled Jobs

Scheduled work is declared as `cron` triggers on Inngest functions, so there is
no separate cron endpoint to authenticate:

- `retry-failed-emails` daily at 02:30 UTC
- `refresh-exchange-rates` every 6 hours
- `scan-abandoned-carts` daily at 10:00 UTC
- `expire-stock-reservations` every 5 minutes

Each scan fans out one event per item rather than looping in a single
invocation, so a slow provider cannot stall the batch and every item retries
independently.

### Exchange Rate Refresh

The exchange-rate cron job:

- fetches INR-based rates from an external API
- normalizes supported currencies (`USD`, `EUR`, `GBP`) against INR
- stores the result in cache using a date-scoped key
- uses TTL until the next UTC midnight, with a stale window for safe refresh

---

## 9. Security, Configuration, and Deployment

### Runtime Security Controls

Current security controls visible in code include:

- HTTPS redirect in production via `proxy.ts`
- `Strict-Transport-Security` header on all routes
- a CSP that whitelists Google, Microsoft, Vercel Analytics, and approved image hosts
- `Referrer-Policy` and `Permissions-Policy` headers
- secure auth cookies in production
- request validation with Zod across env and API inputs
- Inngest signature verification on the `/api/inngest` serve endpoint

### Environment Validation

Environment variables are parsed at import time through a Zod schema in `lib/env.ts`. Invalid configuration fails fast during startup rather than producing partial runtime behavior.

### Optional Edge Configuration

`lib/edge-config.ts` exposes optional remote config for:

- feature flags such as maintenance mode, sale mode, wishlist, and reviews
- shipping settings such as free-shipping threshold and delivery estimates

When Vercel Edge Config is not configured, the app uses hard-coded safe defaults.

### Deployment Shape

The project is designed for Vercel-style serverless deployment with:

- App Router pages and route handlers
- cron routes declared in `vercel.json`
- Blob-hosted assets whitelisted in `next.config.ts`
- analytics and performance instrumentation built into the root layout

---

## 10. Performance Characteristics

### Rendering Strategy

The storefront runs on the Cache Components model. A production build reports
117 routes: 23 fully static (`○`), 21 partially prerendered (`◐`), and 73
dynamic (`ƒ`).

- `/shop` — static shell plus a cached bestsellers rail; the `searchParams`-driven catalog grid streams into a `Suspense` hole.
- `/products/[id]` — cached product read with `cacheLife('product')` and `cacheTag(productTag(id))`; the AI feature flag and `?v=` variant preselection stream separately. The top 20 products by sales volume are prerendered at build time via `generateStaticParams`, and the rest are generated on demand.
- Cart, orders, wishlist, account, and every `/admin` surface read session state outside any cached scope, so no personalized markup can enter the shell.
- User- and admin-specific APIs stay dynamic route handlers.

Two build-time constraints are worth knowing before touching this area:

- `generateStaticParams` may not return an empty array under Cache Components (`EmptyGenerateStaticParamsError`, Next.js `E898`). `/products/[id]` therefore returns a single stand-in id when the catalog cannot be read, and resolves that id to `notFound()` without a query.
- An error thrown out of a `"use cache"` scope aborts that route's prerender even if a caller catches it. A cached scope that must degrade has to absorb its own failure; one that must not cache a failed read has to be kept off the prerendered param list.

### Query and Read Optimization

The main read-path optimizations are:

- direct DB access from Server Components
- read-replica routing via `drizzleDb`
- primary DB pinning for consistency-sensitive paths
- targeted relation loading instead of over-fetching
- SQL-level bestseller ranking instead of in-memory sorting

### Cache and Search Optimization

- product and category reads are cached behind Redis when available
- search uses indexed lookup first and SQL fallback second
- order lookups reuse Redis hashes and sets where configured
- background cache refresh avoids blocking stale responses

### Failure Tolerance as a Performance Feature

A notable current architectural trait is graceful degradation:

- no Redis means direct fetches still work
- no Search means DB search still works
- no Edge Config means defaults are returned
- no email provider means order flows do not fail purely because email infra is absent

This keeps the storefront operational even when optional edge services are unavailable.

---

## Summary

The current architecture is a replica-aware, serverless-first Next.js commerce application with optional edge accelerators layered around a stable PostgreSQL core. The biggest differences from earlier versions are the move to the Cache Components rendering model for public pages (a prerendered shell with streamed per-request holes, replacing segment-level ISR), JWT-based auth sessions, richer domain schema, optional search and edge-config infrastructure, and the addition of asynchronous email plus scheduled maintenance jobs.

For deployment details, see [docs/deployment.md](./deployment.md).
For setup guidance, see [docs/getting-started.md](./getting-started.md).
