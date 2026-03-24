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

As of March 2026, the project is a Next.js 16 App Router storefront running primarily as a server-rendered application with ISR for public pages and dynamic route handlers for user- and admin-specific data.

Key current-state points:

- Public pages such as the home page and shop page use `revalidate = 60` instead of forcing every request dynamic.
- The application uses Neon PostgreSQL through Drizzle with a primary connection plus an optional read replica via `withReplicas`.
- Authentication is handled by NextAuth v5 with Google OAuth, Microsoft Entra ID, and credentials-based login.
- Sessions use JWT strategy with secure cookies, while the Drizzle adapter persists auth-related records such as users, accounts, and verification tokens.
- Redis, Upstash Search, QStash, MailerSend, Google SMTP, and Vercel Edge Config are all optional integrations; the codebase degrades gracefully when those environment variables are absent.
- Email delivery is asynchronous and event-driven, with failed-email persistence plus retry cron jobs.
- Exchange rates are refreshed on a schedule and cached by UTC date.

---

## 2. System Overview

The architecture is a serverless-first e-commerce system built around a small number of stable layers:

```
┌──────────────────────────────────────────────────────────────┐
│                    Presentation Layer                        │
│  Next.js App Router                                          │
│  • Server Components by default                              │
│  • Client Components for interactivity                       │
│  • Root providers: Redux, Theme, Currency, Session, Toast    │
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
│  • Optional QStash delivery for async email events           │
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

| Technology    | Version | Purpose                                               |
| ------------- | ------- | ----------------------------------------------------- |
| React         | 19.2.4  | Rendering, client interactivity, server components    |
| Next.js       | 16.1.6  | App Router, route handlers, ISR, image optimization   |
| TypeScript    | 5.9.3   | Static typing across app, services, and tests         |
| Tailwind CSS  | 4.1.18  | Styling system and design tokens                      |
| Redux Toolkit | 2.11.2  | Shared client state for cart, orders, admin, wishlist |

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
| Upstash QStash                    | Signed async email event delivery                       |
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
- Store domain entities such as products, categories, variations, carts, wishlists, reviews, and failed emails use short base62-style IDs.
- Orders use a dedicated short order ID format.

### Core Domain Tables

Current schema highlights:

- `User`: email, optional password hash, optional phone number, role, currency preference, image metadata.
- `Product`: base product record with `image`, `images`, category label, stock, and soft-delete timestamp.
- `ProductVariation`: per-variation stock, image set, name, design name, price modifier, soft-delete timestamp.
- `Category`: standalone category table with sort order and soft-delete support.
- `Order`: user association, customer snapshot fields, status, tracking number, shipping provider, timestamps.
- `OrderItem`: product snapshot with optional variation and `customizationNote`.
- `Cart` and `CartItem`: authenticated and guest cart support.
- `Wishlist` and `Review`: user engagement features.
- `ProductShare`: immutable short-link mapping for shareable product URLs.
- `FailedEmail`: retry queue and delivery history for email workflows.

### Relationship Model

- Users have many orders, accounts, password history rows, and wishlist entries.
- Products have many variations, order items, cart items, wishlist entries, and reviews.
- Orders own their line items via cascade delete.
- Carts own cart items via cascade delete.
- Product shares optionally bind a product and a chosen variation.

### Soft Deletes

Products, variations, and categories use `deletedAt` instead of hard deletes for normal removal paths. Most public queries explicitly filter out soft-deleted rows.

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

### Product Variation and Pricing Model

Variation behavior in the live codebase is more capable than the earlier document described:

- variations can override image and image gallery content
- each variation has independent stock
- price is base product price plus variation price modifier
- order items snapshot unit price at order time
- order items can carry a `customizationNote`

---

## 7. Caching, Search, and State

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
- fall back to direct SQL search against orders, product names, and variation names
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

### Async Email Delivery

Email dispatch is event-driven.

The current flow is:

1. Domain code emits a QStash-compatible event payload.
2. `POST /api/services/email` receives the event.
3. The route optionally verifies the QStash signature.
4. It validates the payload with Zod.
5. It prevents duplicate sends by checking `FailedEmail` for already-sent records of the same reference.
6. It dispatches either order confirmation or order status update email logic.

### Email Providers

Email delivery currently prefers Google SMTP when configured and falls back to MailerSend when available. If neither provider is configured, the app logs a skipped email event rather than crashing the request.

### Failed Email Persistence and Retry

Non-successful sends are tracked in the `FailedEmail` table with:

- attempt count
- retriable flag
- current status (`pending`, `failed`, `sent`)
- full error history
- timestamps for created, last attempted, and sent

Retry behavior currently caps cron retries at 20 records per run and 5 attempts per record.

### Scheduled Jobs

Vercel cron is now part of the architecture:

- `/api/cron/retry-emails` every 15 minutes
- `/api/cron/refresh-rates` every 6 hours

Both routes require either:

- `Authorization: Bearer <CRON_SECRET>` when a secret is configured, or
- the expected `vercel-cron` user agent fallback

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
- QStash signature verification for async email entry points

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

The current storefront is not universally dynamic. Public pages now lean on ISR where appropriate:

- home page: `revalidate = 60`
- shop page: `revalidate = 60`
- user- and admin-specific APIs: dynamic route handlers where personalization is required

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

The current architecture is a replica-aware, serverless-first Next.js commerce application with optional edge accelerators layered around a stable PostgreSQL core. The biggest differences from earlier versions are the move to ISR-first public pages, JWT-based auth sessions, richer domain schema, optional search and edge-config infrastructure, and the addition of asynchronous email plus scheduled maintenance jobs.

For deployment details, see [docs/deployment.md](./deployment.md).
For setup guidance, see [docs/getting-started.md](./getting-started.md).
