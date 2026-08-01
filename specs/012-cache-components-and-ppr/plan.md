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

## Complexity Tracking

| Violation                                                                                      | Why needed                                                                                                                               | Simpler alternative rejected because                                                                                                                                                                                                             |
| ---------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Constitution IV previously mandated ISR via `revalidate`; this work removes every `revalidate` | Next.js 16.2 fails the build with `Route segment config "revalidate" is not compatible with 'nextConfig.cacheComponents'` (verified, R2) | Keeping ISR means not adopting Cache Components at all, which is the entire feature. Resolved by amending Constitution IV (v1.2.0 → v2.0.0, MAJOR: an existing principle is redefined backward-incompatibly) per Governance, ahead of this plan. |
| Removing `runtime = 'nodejs'` from the upload route                                            | Cache Components rejects the `runtime` segment config; Node.js is already the default for route handlers                                 | No supported way to keep the pin; the guarantee is re-established by testing the Azure Blob path rather than by a config export.                                                                                                                 |
| A `Suspense` boundary above the root client provider tree                                      | `configureStore` uses `Math.random()`, which aborts the prerender of every static page (verified, R4)                                    | Making the store deterministic means patching Redux Toolkit's internals; deferring store creation changes hydration semantics for every page.                                                                                                    |
