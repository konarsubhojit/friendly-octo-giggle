# Implementation Plan: Cache Components and Partial Prerendering

**Branch**: `012-cache-components-and-ppr` | **Date**: 2026-08-01 | **Spec**: [spec.md](./spec.md)  
**Input**: Feature specification from `/specs/012-cache-components-and-ppr/spec.md`

## Summary

Enable the Next.js 16 Cache Components model (`cacheComponents`, `"use cache"`, `cacheLife`, `cacheTag`) so the storefront serves a prerendered static shell with streamed dynamic holes, and retire the legacy segment model (`export const dynamic` / `export const revalidate`) that Next.js 16.2 rejects outright once Cache Components is on.

The migration has four separable parts, in dependency order:

1. **Unblock the build** — remove the 72 incompatible segment-config exports, stop swallowing Next.js prerender bail-out signals in `handleApiError`, add a `Suspense` boundary above the client provider tree, and make the one page that renders per-request data without reading request data (`/admin`) declare itself dynamic.
2. **Cache the catalog** — move public catalog reads (shop listing, product detail, categories, bestsellers) into `"use cache"` scopes with explicit `cacheLife` profiles and entity-keyed `cacheTag` values.
3. **Invalidate on write** — call `revalidateTag` alongside the Redis invalidation that already exists in product/variant/category mutation paths and in the durable order side-effect function.
4. **Prebuild the popular pages** — add a bounded `generateStaticParams` to `/products/[id]`.

Redis is not replaced. It keeps ownership of cross-instance, per-request data (cart, orders, admin lists, exchange rates, share/pincode lookups); Cache Components owns render-output caching for the prerendered shell.

## Technical Context

**Language/Version**: TypeScript 6.0 (strict), React 19.2.7, Next.js 16.2.11 (App Router, Turbopack build)  
**Primary Dependencies**: `next/cache` (`cacheLife`, `cacheTag`, `revalidateTag`), `next/server` (`connection`), `next/navigation` (`unstable_rethrow`), Drizzle ORM, `@upstash/redis`, Inngest, NextAuth v5  
**Storage**: PostgreSQL (Neon serverless) via Drizzle; Upstash Redis for cross-request caching; Upstash Search for catalog discovery  
**Testing**: Vitest + React Testing Library (`__tests__/`), Playwright (`playwright-tests/`)  
**Target Platform**: Vercel serverless (Node.js runtime), CDN in front of every public route  
**Project Type**: Single Next.js application (`src/app`, `src/features`, `src/lib`)  
**Performance Goals**: No LCP regression on `/shop` and `/products/[id]`; catalog markup present in initial HTML with JavaScript disabled  
**Constraints**: No user-specific data may enter a cached scope; the change set must be revertable in one commit; Redis being unavailable must not turn cached routes into errors  
**Scale/Scope**: 93 build-time routes; 60 `force-dynamic` exports, 11 `revalidate` exports, 1 `runtime` export to remove; 13 pages and 47 route handlers to classify

## Constitution Check

_GATE: checked before Phase 0 and re-checked after the design below._

| Principle                              | Assessment                                                                                                                                                                                                                                              |
| -------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| I. Server-First Rendering              | PASS — reinforced. Cached scopes are Server Components; no new `'use client'` boundaries are introduced.                                                                                                                                                |
| II. Type Safety End-to-End             | PASS — cache tags are produced by typed helper functions in `src/lib/cache-tags.ts`; no raw tag strings at call sites.                                                                                                                                  |
| III. Testing Discipline                | PASS — new tag helpers and the `handleApiError` rethrow path get Vitest coverage; the rendering change is verified through Playwright against a production build.                                                                                       |
| IV. Serverless & Caching Architecture  | PASS — as of constitution v2.0.0. Principle IV previously mandated ISR via `revalidate`, which Next.js 16.2 rejects alongside `cacheComponents`; it was amended to mandate the Cache Components model this feature implements. See Complexity Tracking. |
| V. Security by Default                 | PASS with risk — the highest-risk part of this work. Every authenticated surface must read request data outside any cached scope. Enforced by the classification table below and by a two-session Playwright check.                                     |
| VI. Observability & Structured Logging | PASS — improved. Today `handleApiError` logs Next.js prerender bail-out signals as `api_error` and `withLogging` records them as HTTP 500s; both are false alarms that this work removes.                                                               |
| VII. Simplicity & YAGNI                | PASS — no new dependency. Four new cache-life profiles and one tag-vocabulary module, sized to the scopes that actually exist.                                                                                                                          |
| VIII. DRY Shared Utilities             | PASS — tag names and revalidation live in `src/lib/cache-tags.ts` and are called from the same functions that already perform Redis invalidation, rather than being repeated in 15 route files.                                                         |

## Phase 0 — Research findings (verified 2026-08-01 by build probe)

Each finding below was produced by temporarily enabling `cacheComponents` and running `npm run build` against this working tree, then reverting. They replace assumptions with observed behavior.

- **R1 — `cacheComponents` is a stable top-level config in 16.2.11.** It is set as `cacheComponents: true` in `next.config.ts` (not under `experimental`), and the build banner reports `- Cache Components enabled`.
- **R2 — Enabling the flag alone fails the build with 72 Turbopack errors**, all of the form `Route segment config "<name>" is not compatible with 'nextConfig.cacheComponents'. Please remove it.` The breakdown is exactly: 60 × `dynamic`, 11 × `revalidate`, 1 × `runtime` (`src/app/api/upload/route.ts`). There is no incremental/per-route opt-in; removal is all-or-nothing.
- **R3 — `handleApiError` swallows Next.js prerender bail-out signals.** With the segment configs removed, the build prerenders `GET` route handlers; handlers that read `request.url` or `nextUrl.searchParams` throw an internal `needs to bail out of prerendering` signal that `src/lib/api-utils.ts` catches and converts into a JSON 500. Observed for `/api/products`, `/api/products/bestsellers`, `/api/search`, `/api/search/suggest`. Calling `unstable_rethrow(error)` from `next/navigation` as the first statement of `handleApiError` fixes it. `withLogging`/`withApiLogging` in `src/lib/api-middleware.ts` additionally emit a misleading `statusCode: 500` log line for the same signal before rethrowing.
- **R4 — The client provider tree blocks prerendering of every otherwise-static page.** `makeStore()` in `src/lib/store.ts` calls `configureStore`, whose ID generation uses `Math.random()`; because `StoreProvider` is mounted directly in `src/app/layout.tsx`, the build fails with `Route "/auth/error" used 'Math.random()' inside a Client Component without a Suspense boundary above it`. A `Suspense` boundary above `AppProviders` in the root layout resolves it.
- **R5 — A per-request page that never reads request data is prerendered and fails.** `/admin` (`src/app/admin/page.tsx`) is the only admin page with no page-level auth call; its data function `getAdminSalesDashboardData` calls `new Date()`, producing `Route "/admin" used 'new Date()' before accessing either uncached data ... or Request data`. Awaiting `connection()` (or performing the missing page-level auth check) makes it explicitly dynamic. Every other admin page already calls `requireAdminPermission`/`checkAdminAuth`, which reads cookies and is therefore self-classifying.
- **R6 — With R2–R5 addressed and no other change, the production build succeeds** (93 routes). The mechanical migration alone yields: fully static (`○`) marketing, auth and checkout-step pages; partial prerender (`◐`) for `/shop`, `/products/[id]`, `/cart`, `/orders`, `/orders/[id]`, `/wishlist`, `/auth/signin`, `/auth/error` and all 13 admin pages; dynamic (`ƒ`) for all route handlers and `/s/[key]`. **Important:** at that point the `◐` catalog pages stream _all_ data on every request — the shell is static but nothing is cached. The `"use cache"` work in Phase 2 is what puts catalog data into the prerendered shell, which is what SC-002 requires.
- **R7 — Tag API shape in 16.2.** `revalidateTag(tag, profile)` takes a **required second argument** (`string | { expire?: number }`). `updateTag(tag)` is Server-Action-only (read-your-own-writes), so the admin mutation _route handlers_ in this codebase must use `revalidateTag`. Both are imported from `next/cache`.
- **R8 — `Date.now()` and `crypto.randomUUID()` are permitted inside a `"use cache"` scope** (the cache work-unit store is exempt from the sync-IO guard), so nesting `getCachedData` inside `"use cache"` will not fail the build. It is nonetheless rejected by design: it would double-cache, put a Redis round trip inside the prerender path, and split invalidation across two systems. Cached scopes read the database directly.

### Additional findings (verified 2026-08-02 during Phase 4–7 implementation)

- **R9 — `generateStaticParams` may not return an empty array under Cache Components.** Doing so aborts the build with `EmptyGenerateStaticParamsError` (Next.js error code `E898`, thrown from `next/dist/build/static-paths/app.js` whenever `isRoutePPREnabled` and the result set is empty). Spec US4 acceptance 3 — "degrade to prerendering no product routes instead of failing" — therefore has no literal expression. It is satisfied by returning a single stand-in id, `__no_products__`, which no 7-character Base62 product id can hold, so it can never shadow a real product.
- **R10 — An error thrown out of a `"use cache"` scope aborts that route's prerender even when a caller catches it.** Observed on `/products/__no_products__`: `getProduct` catches the rejection from `getCachedProduct` and returns `null`, yet the build still reported `Error occurred prerendering page` and exited. The resolution keeps the rethrow (a failed read must never be cached) and instead resolves the stand-in id to `null` **before** entering the cached scope, so the degraded build performs no query that can fail. The same constraint explains why `getCachedBestsellers` in `src/app/(public)/shop/page.tsx` absorbs its own failure rather than delegating it.
- **R11 — `/api/metrics` was prerendered as `○` after its `force-dynamic` export was removed.** The handler renders in-process Prometheus counters, so a static route would have served the build-time snapshot (all zeros) for the lifetime of the deployment; the `Cache-Control: no-store` header does not prevent this, because it governs downstream caches rather than Next.js's own static output. The route now calls `await connection()`. `/api/health` remains `○` deliberately: it returns a constant literal, so a prerendered response is both correct and faster.

## Route classification (FR-007)

Every current `force-dynamic` (60), `revalidate` (11) and `runtime` (1) declaration, with its post-migration class.

### Class A — Per-request; remove the config, no cached scope (47 route handlers)

Every one of these reads a session, request body, search params, headers or a webhook signature, and stays dynamic (`ƒ`) with no code change beyond deleting the export.

- `src/app/api/account/`: `route.ts`-level handlers for `addresses`, `addresses/[id]`, `notifications`, `push-subscriptions` (4)
- `src/app/api/admin/`: `coupons`, `coupons/[id]`, `coupons/redemptions`, `email-failures`, `export/orders`, `export/products`, `export/reviews`, `export/users`, `import/products`, `orders`, `orders/[id]`, `orders/[id]/refund`, `orders/bulk`, `products`, `products/[id]`, `products/[id]/options`, `products/[id]/options/[optionId]`, `products/[id]/options/generate`, `products/[id]/variants`, `products/[id]/variants/reorder`, `products/bulk`, `reviews`, `sales`, `sales/export`, `users`, `users/[id]`, `variants`, `variants/[variantId]` (28)
- `src/app/api/cart/`: `route.ts`, `coupon`, `items/[id]` (3)
- `src/app/api/checkout/`: `route.ts`, `[id]`, `[id]/stream` (3)
- `src/app/api/orders/`: `route.ts`, `[id]` (2)
- `src/app/api/wishlist/`: `route.ts`, `[productId]` (2)
- `src/app/api/payments/webhook/`: `route.ts`, `[provider]` (2)
- `src/app/api/reviews/route.ts`, `src/app/api/share/route.ts`, `src/app/api/inngest/route.ts` (3)

**Justification for keeping them dynamic**: each is either session-scoped, a mutation, a stream, or signature-verified. None may be prerendered, and none needs to be — a dynamic route handler is the default under Cache Components.

### Class B — Per-request pages; remove the config (13 pages)

| Page                                        | Why per-request                               | Change beyond config removal                        |
| ------------------------------------------- | --------------------------------------------- | --------------------------------------------------- |
| `src/app/(public)/cart/page.tsx`            | `auth()` in the page body                     | none                                                |
| `src/app/(public)/orders/page.tsx`          | `auth()` in the page body                     | none                                                |
| `src/app/(public)/wishlist/page.tsx`        | `auth()` in the page body                     | none                                                |
| `src/app/(public)/auth/signin/page.tsx`     | sign-in form, `searchParams` read client-side | none (becomes `◐`)                                  |
| `src/app/admin/page.tsx`                    | admin dashboard, **no page-level auth call**  | `await connection()` **and** an explicit auth check |
| `src/app/admin/sales/page.tsx`              | `checkAdminAuth('analytics:read')`            | none                                                |
| `src/app/admin/coupons/page.tsx`            | `checkAdminAuth('coupons:manage')`            | none                                                |
| `src/app/admin/categories/page.tsx`         | `requireAdminPermission('products:write')`    | none                                                |
| `src/app/admin/checkout-requests/page.tsx`  | `requireAdminPermission('orders:read')`       | none                                                |
| `src/app/admin/email-failures/page.tsx`     | `requireAdminPermission('system:manage')`     | none                                                |
| `src/app/admin/search/page.tsx`             | `requireAdminPermission('system:manage')`     | none                                                |
| `src/app/admin/products/[id]/page.tsx`      | `requireAdminPermission('products:read')`     | none                                                |
| `src/app/admin/products/[id]/edit/page.tsx` | `requireAdminPermission('products:read')`     | none                                                |

### Class C — Cacheable; remove `revalidate`, no data reads (8 marketing pages)

`src/app/(public)/` `about`, `blog`, `careers`, `contact`, `help`, `press`, `returns`, `shipping` — all render constants only. Dropping `revalidate = 3600` makes them fully static (`○`) with no cache scope required.

### Class D — Cacheable-with-holes; the actual migration work (3 surfaces)

| Surface                                   | Current                            | Target                                                                                                                                               |
| ----------------------------------------- | ---------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------- |
| `src/app/(public)/shop/page.tsx`          | `revalidate = 60`, Redis in-render | Static shell; `"use cache"` scopes for bestsellers and category chips; the `searchParams`-driven search result stays in the existing `Suspense` hole |
| `src/app/(public)/products/[id]/page.tsx` | `revalidate = 60`                  | `"use cache"` product read + `generateStaticParams`; AI flag and any session-scoped region behind `Suspense`                                         |
| `src/app/api/categories/route.ts`         | `revalidate = 60`                  | `"use cache"` inside the handler — it reads no request data                                                                                          |

### Class E — Runtime pin (1)

`src/app/api/upload/route.ts` exports `runtime = 'nodejs'`, which Cache Components rejects. Node.js is the default runtime for route handlers, so the export is removed and the Azure/Vercel Blob upload path is re-verified rather than re-pinned.

### Unclassified-but-affected public reads (no config today, no change required)

`src/app/api/products/route.ts`, `src/app/api/products/[id]/route.ts`, `src/app/api/products/bestsellers/route.ts`, `src/app/api/search*`, `src/app/api/exchange-rates/route.ts` keep their Redis caching and their `Cache-Control` headers. They are consumed by client components, not by the prerender, and stay dynamic.

## Verified post-migration classification (FR-007, SC-006, verified 2026-08-02)

`npm run build` reports **117 routes**: 23 static (`○`), 21 partially prerendered (`◐`), and 73 dynamic (`ƒ`). The `force-dynamic` count in `src/app` is **0**, down from 60; `revalidate` is 0, down from 11; `runtime` is 0, down from 1. Every remaining dynamic surface is justified below, so no route relies on an unrecorded decision.

### Static (`○`) — 23 routes

| Route(s)                                                                              | Why a prerendered response is correct                                                                                                                  |
| ------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `/`                                                                                   | `redirect('/shop')` and nothing else.                                                                                                                  |
| `/about`, `/blog`, `/careers`, `/contact`, `/help`, `/press`, `/returns`, `/shipping` | Class C marketing pages; constants only.                                                                                                               |
| `/account`, `/checkout/{shipping,review,payment,confirmation}`                        | Client components that fetch their own per-user data after hydration. The server renders no session-derived markup, so the shell carries no user data. |
| `/auth/{register,forgot-password,reset-password,verify-email}`                        | Client forms; the token/`searchParams` reads happen in the browser.                                                                                    |
| `/offline`, `/manifest.webmanifest`, `/sitemap.xml`, `/_not-found`                    | Static assets and constant metadata.                                                                                                                   |
| `/api/health`                                                                         | Returns a constant literal. Prerendering it is both correct and faster than a cold start (contrast `/api/metrics` in R11).                             |

### Partially prerendered (`◐`) — 21 routes

| Route(s)                                        | Static shell                             | Dynamic hole                                                                                   |
| ----------------------------------------------- | ---------------------------------------- | ---------------------------------------------------------------------------------------------- |
| `/shop`                                         | Heading, bestsellers rail (cached)       | `searchParams`-driven catalog grid                                                             |
| `/products/[id]`                                | Product record (cached, 20 ids prebuilt) | AI feature flag and `?v=` variant preselection                                                 |
| `/cart`, `/orders`, `/orders/[id]`, `/wishlist` | Layout chrome                            | Everything behind the page-body `auth()` call                                                  |
| `/auth/signin`, `/auth/error`                   | Form chrome                              | `searchParams` (`callbackUrl`, `error`) read client-side                                       |
| `/admin` and the 12 other `/admin/**` pages     | Layout chrome                            | Everything behind `checkAdminAuth` / `requireAdminPermission` (and `connection()` on `/admin`) |

No `◐` shell contains session-derived markup: the four `"use cache"` scopes in the codebase (`src/app/(public)/shop/page.tsx` ×2, `src/app/(public)/products/[id]/page.tsx`, `src/app/api/categories/route.ts`) read only `db`/`drizzleDb`, and neither they nor `src/lib/db-queries.ts` call `auth()`, `cookies()`, or `headers()` (FR-008, FR-013, T035).

### Dynamic (`ƒ`) — 73 routes

| Group                                                                                                                                                                                                                                                     | Count | Justification                                                                                                                                                                                                                                                                                                                                                             |
| --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Session-scoped and mutating handlers: `/api/admin/**` (33), `/api/account/**` (5), `/api/cart/**` (3), `/api/checkout/**` (3), `/api/orders/**` (2), `/api/wishlist/**` (2), `/api/payments/webhook/**` (2), `/api/reviews`, `/api/share`, `/api/inngest` | 53    | Class A, reconciled against the build. Each reads a session, request body, search params, a stream, or a webhook signature. Dynamic is the default under Cache Components; none carries a segment config. The plan's original count of 47 omitted `/api/account`, the three `/api/admin/categories` handlers, `/api/admin/reviews/[id]`, and `/api/admin/search/reindex`. |
| `/api/auth/**` (6) and `/api/upload`                                                                                                                                                                                                                      | 7     | Credential handling and multipart uploads; both read the request body. `/api/upload` no longer pins `runtime = 'nodejs'` (Class E) — Node.js is already the default for route handlers.                                                                                                                                                                                   |
| Public read APIs: `/api/products` (3), `/api/search` (3), `/api/exchange-rates`, `/api/pincode/[code]`, `/api/reviews/vote`, `/api/ai/products/[id]/chat`                                                                                                 | 10    | Consumed by client components, not by the prerender. They keep their Redis caching and `Cache-Control` headers rather than moving into a `"use cache"` scope.                                                                                                                                                                                                             |
| `/api/categories`                                                                                                                                                                                                                                         | 1     | Handler is dynamic, but its body is a `"use cache"` scope, so the query is cached and tag-invalidated while the response headers stay per-request.                                                                                                                                                                                                                        |
| `/api/metrics`                                                                                                                                                                                                                                            | 1     | In-process Prometheus counters; opts out of prerendering with `connection()` (R11).                                                                                                                                                                                                                                                                                       |
| `/s/[key]`                                                                                                                                                                                                                                                | 1     | Short-link resolution followed by a redirect; the key is request data.                                                                                                                                                                                                                                                                                                    |

## Cache design

### Cache-life profiles (`next.config.ts` → `cacheLife`)

Named profiles keep FR-003 enforceable by review — a scope either names a profile or it is wrong. Values are anchored to the existing `CACHE_TTL` constants in `src/lib/cache.ts` so the two layers do not disagree.

| Profile    | `stale` | `revalidate` | `expire` | Used by                       | Anchored to                    |
| ---------- | ------- | ------------ | -------- | ----------------------------- | ------------------------------ |
| `catalog`  | 60      | 300          | 3600     | shop listing, bestsellers     | `CACHE_TTL.PRODUCTS_LIST` 600  |
| `product`  | 60      | 900          | 3600     | product detail                | `CACHE_TTL.PRODUCT_DETAIL` 900 |
| `taxonomy` | 300     | 3600         | 86400    | category list, category chips | `CACHE_TTL.CATEGORIES_LIST`    |

Time-based bounds are the safety net, not the freshness mechanism: tags are (FR-004, FR-005).

### Tag vocabulary (`src/lib/cache-tags.ts`, new)

| Helper             | Tag                    | Revalidated by                                                                     |
| ------------------ | ---------------------- | ---------------------------------------------------------------------------------- |
| `productTag(id)`   | `product:<id>`         | product/variant/option update, delete, reorder; order stock side effects           |
| `productListTag()` | `products:list`        | product create, delete, bulk ops, import; anything that changes catalog membership |
| `bestsellersTag()` | `products:bestsellers` | order creation side effects, product delete                                        |
| `categoriesTag()`  | `categories:list`      | category create, update, delete, reorder                                           |

Coupons deliberately have no tag: no cached scope reads coupon data (cart pricing is per-request), so FR-005's coupon clause resolves to “no cached scope depends on it”, recorded here rather than satisfied with a dead tag.

### Where revalidation is called

`revalidateTag` is called from the same functions that already call the Redis invalidators, so the two can never drift:

- `src/lib/db-queries.ts` — `db.products.create` / `update` / `delete` (already call `invalidateProductCaches`)
- `src/app/api/admin/products/**`, `src/app/api/admin/variants/**`, `src/app/api/admin/import/products/route.ts` — the 12 call sites that currently call `invalidateProductCaches(...)` inherit the tag call by routing it through the shared invalidator
- `src/app/api/admin/categories/**` — category writes gain a `categoriesTag()` revalidation
- `src/features/orders/services/order-cache.ts` — the shared order invalidator, which the durable `invalidateOrderCachesFunction` (`src/features/orders/inngest/side-effects.ts`) already calls with `productIds`

Every `revalidateTag` call is wrapped so a failure is logged through `logError` with operation context and never fails the originating write (FR-012).

### Division of responsibility (FR-010, documented in `docs/architecture.md`)

| Layer                            | Owns                                                                                  | Does not own                                              |
| -------------------------------- | ------------------------------------------------------------------------------------- | --------------------------------------------------------- |
| Cache Components (`"use cache"`) | Render output for the prerendered public shell; tag-based invalidation of that output | Cross-instance data reuse for route handlers              |
| Redis (`getCachedData`)          | Cart, orders, admin lists, sales, exchange rates, share/pincode; API route payloads   | Anything inside a `"use cache"` scope (explicitly banned) |
| Database                         | The correctness floor — every cached path degrades to a direct query                  | —                                                         |

## Project Structure

### Documentation (this feature)

```text
specs/012-cache-components-and-ppr/
├── spec.md
├── plan.md   # this file
└── tasks.md
```

### Source Code (repository root)

```text
next.config.ts                     # cacheComponents: true, cacheLife profiles
src/
├── app/
│   ├── layout.tsx                 # Suspense above AppProviders
│   ├── (public)/
│   │   ├── shop/page.tsx          # cached catalog scopes + existing Suspense hole
│   │   ├── products/[id]/page.tsx # cached product scope + generateStaticParams
│   │   └── {about,blog,careers,contact,help,press,returns,shipping}/page.tsx
│   ├── admin/**/page.tsx          # segment config removal; connection() on /admin
│   └── api/
│       ├── categories/route.ts    # "use cache" handler
│       └── **/route.ts            # segment config removal (47 handlers)
├── lib/
│   ├── cache-tags.ts              # NEW — tag vocabulary + logged revalidation
│   ├── cache.ts                   # Redis invalidators also revalidate tags
│   ├── api-utils.ts               # unstable_rethrow in handleApiError
│   ├── api-middleware.ts          # do not log bail-out signals as 500s
│   └── db-queries.ts              # catalog reads usable without Redis wrapping
└── features/orders/services/order-cache.ts  # order write → product/listing tags

__tests__/
├── lib/cache-tags.test.ts         # NEW
├── lib/api-utils.test.ts          # rethrow behavior
└── lib/cache.test.ts              # invalidator now also revalidates tags

playwright-tests/
├── public-pages.spec.ts           # no-JS shell assertions
└── admin-views.spec.ts            # cross-session isolation

docs/architecture.md, docs/development.md   # FR-015
```

**Structure Decision**: keep the existing single-application layout. The only new module is `src/lib/cache-tags.ts`, which exists so tag strings are typed and produced in one place (Principle VIII) instead of being written inline at ~15 mutation call sites.

## Delivery phases

1. **Unblock** — config flag, 72 segment-config removals, `unstable_rethrow`, provider `Suspense`, `/admin` `connection()` + auth check. Build passes; behavior otherwise unchanged.
2. **Cache the catalog** — tag/life vocabulary, `"use cache"` scopes on shop, product detail and `/api/categories`, `Suspense` fallbacks reusing `src/components/skeletons/`.
3. **Invalidate on write** — tag revalidation wired into the existing Redis invalidators and the order side-effect function.
4. **Prebuild** — `generateStaticParams` for the top products, degrading to an empty list when the database is unreachable at build time.
5. **Prove and document** — no-JS shell checks, two-session isolation checks, Redis-down check, LCP before/after, Playwright against a production build, `docs/architecture.md` and `docs/development.md` updates.

## Rollback (FR-014)

The change set is one commit. Reverting it restores `cacheComponents: false` (absent) together with all 72 segment configs in the same operation, because Next.js rejects the two states in combination — a partial revert cannot build, which is what makes the single-commit rule enforceable rather than aspirational.

## Release validation (T043–T047, verified 2026-08-02)

All measurements below were taken against the dev database (5 published products, 6 categories) on one machine, with the migrated tree and the pre-migration tree (`develop`, `c35a86c`) built and served in turn from the same shell, the same environment variables, and the same `next start` port.

### T047 — Quality gates (SC-001)

| Command                                   | Result                                                                                                      |
| ----------------------------------------- | ----------------------------------------------------------------------------------------------------------- |
| `npm run lint`                            | pass, no findings                                                                                           |
| `npx tsc --noEmit -p tsconfig.check.json` | pass                                                                                                        |
| `npm test`                                | pass — 293 files, 3446 tests                                                                                |
| `npm run build`                           | pass — Cache Components enabled, 98 pages generated, 5 `/products/[id]` routes prerendered from the catalog |

The build was additionally run with an unreachable database to confirm the degradation paths: `generateStaticParams` logged `product_static_params` and fell back to the stand-in id (R9), `getCachedBestsellers` logged `shop_bestsellers_fetch` and returned an empty rail (R10), and the build still completed.

### T044 — Redis unavailable (SC-007)

Procedure: production build served with `UPSTASH_REDIS_REST_URL`, `UPSTASH_REDIS_REST_TOKEN`, and `REDIS_URL` removed from the server process (confirmed through `/proc/<pid>/environ`), so `getRedisClient()` returns `null` for every call. Each route was requested without JavaScript (plain HTTP) and checked for database-derived content.

| Route                       | Status | Database content in the response                  |
| --------------------------- | ------ | ------------------------------------------------- |
| `/`                         | 200    | static marketing shell (no catalog read)          |
| `/shop`                     | 200    | catalog product names present in the initial HTML |
| `/products/ruJaxwb`         | 200    | product name present in the HTML                  |
| `/api/categories`           | 200    | all six categories, cached scope reading Postgres |
| `/api/products`             | 200    | product payload                                   |
| `/api/products/bestsellers` | 200    | bestseller payload                                |

No errors were logged for the run. This is the expected shape: the cached scopes read the database directly (`db.products.findBestsellers({ withCache: false })`, `db.products.findById(id, false)`, `drizzleDb`), and every uncached read goes through `getCachedData`, which invokes its fetcher when no Redis client exists.

### T043 — Largest Contentful Paint before and after (SC-003)

Method: headless Chrome 150 driven over the DevTools Protocol against `next start`, `Emulation.setCPUThrottlingRate: 4` and `Network.emulateNetworkConditions` at 10 Mbps / 40 ms, LCP read from a `PerformanceObserver` (`buffered: true`) 4 s after `load`. Warm figures are the median of five navigations after a discarded warm-up; cold figures are the first navigation against a freshly started server.

| Route               | LCP before (warm) | LCP after (warm) | LCP before (cold) | LCP after (cold) | LCP element |
| ------------------- | ----------------- | ---------------- | ----------------- | ---------------- | ----------- |
| `/shop`             | 192 ms            | 192 ms           | 220 ms            | 196 ms           | `<h1>`      |
| `/products/ruJaxwb` | 584 ms            | 568 ms           | 608 ms            | 608 ms           | `<img>`     |
| `/`                 | 180 ms            | 184 ms           | —                 | —                | `<h1>`      |

No route regresses. `/shop` improves by 24 ms on a cold server, which is the case this feature targets: the shell no longer waits on a database round trip. The `/` delta of 4 ms sits inside the sample spread (before 176–196 ms, after 168–204 ms) and is noise. Product detail LCP is bound by the remote hero image, not by rendering, which is why it is unchanged.

These are local, single-machine numbers taken over loopback; they are directionally sound for a same-machine before/after comparison but are not field data. `@vercel/speed-insights` is already mounted, so real-user LCP for the same three routes should be read from Speed Insights after the deployment lands.

### T046 — Single revertable change set (FR-014)

- The change set is `origin/develop...HEAD`: 9 commits, 127 files, +2409/−573. Squash-merging it produces the single commit FR-014 requires.
- `git diff origin/develop...HEAD | git apply -R --check` reverse-applies cleanly, so the whole set reverts as one unit.
- The reverted state builds: `develop` at `c35a86c` was checked out into a scratch worktree and `npm run build` completed there in this same session.
- A partial revert does not build, as claimed: setting `cacheComponents: false` while the `"use cache"` scopes remain fails compilation with `To use "use cache", please enable the feature flag cacheComponents in your Next.js config` at `src/app/(public)/products/[id]/page.tsx`, `src/app/(public)/shop/page.tsx` (both scopes), and `src/app/api/categories/route.ts`. The reverse case is R2.

### T045 — Playwright against a production build (SC-008)

Deferred, not satisfied. The suite is not runnable as it stands: `playwright.config.ts` still probes `/en/shop`, which is not in the route tree, and `global-setup.ts` requires credentials for a seeded account. Making the suite runnable was owned by `013-e2e-in-continuous-integration`, which this feature declared as a dependency until that specification was withdrawn on 2026-08-07; the repair is now unowned. The Playwright specs added by this feature (`public-pages.spec.ts`, `product-navigation.spec.ts`, `session-isolation.spec.ts`, `admin-views.spec.ts`) are committed and will be exercised once the suite is repaired. The rendering claims those specs assert were verified here by other means: the no-JavaScript shell content in the T044 table above, and the classification table in this plan.

## Complexity Tracking

| Violation                                                                                      | Why needed                                                                                                                               | Simpler alternative rejected because                                                                                                                                                                                                             |
| ---------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Constitution IV previously mandated ISR via `revalidate`; this work removes every `revalidate` | Next.js 16.2 fails the build with `Route segment config "revalidate" is not compatible with 'nextConfig.cacheComponents'` (verified, R2) | Keeping ISR means not adopting Cache Components at all, which is the entire feature. Resolved by amending Constitution IV (v1.2.0 → v2.0.0, MAJOR: an existing principle is redefined backward-incompatibly) per Governance, ahead of this plan. |
| Removing `runtime = 'nodejs'` from the upload route                                            | Cache Components rejects the `runtime` segment config; Node.js is already the default for route handlers                                 | No supported way to keep the pin; the guarantee is re-established by testing the Azure Blob path rather than by a config export.                                                                                                                 |
| A `Suspense` boundary above the root client provider tree                                      | `configureStore` uses `Math.random()`, which aborts the prerender of every static page (verified, R4)                                    | Making the store deterministic means patching Redux Toolkit's internals; deferring store creation changes hydration semantics for every page.                                                                                                    |
