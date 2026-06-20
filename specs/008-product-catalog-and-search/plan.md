# Implementation Plan: Product Catalog and Search

**Branch**: `008-product-catalog-and-search` | **Date**: 2026-06-09 | **Spec**: [spec.md](./spec.md)  
**Input**: Feature specification from `specs/008-product-catalog-and-search/spec.md`

## Summary

Document the shipped customer-facing catalog, detail, and discovery feature: locale-prefixed shop browsing, server-rendered/ISR catalog data, API-backed filtering and pagination, Redis/Upstash-powered search with database fallback, bestseller and sold-count aggregation, product detail variant selection, stock-aware add-to-cart behavior, currency formatting, and recently viewed products. This plan reflects the existing implementation and preserves separation from the visual styling scope documented in `specs/001-cozy-shop-ui`.

## Technical Context

**Language/Version**: TypeScript 6.x (`strict: true`)  
**Primary Dependencies**: Next.js 16 App Router, React 19, Drizzle ORM 0.45, NextAuth v5, Redux Toolkit, Upstash Redis, Upstash Search, Zod 4  
**Storage**: PostgreSQL via Drizzle read-replica composite (`drizzleDb`/`db`) plus Redis cache/search; client localStorage/sessionStorage for recent searches, recently viewed, and exchange-rate cache  
**Testing**: Vitest + React Testing Library for units/components/routes; Playwright for customer UI flows and accessibility when UI changes occur  
**Target Platform**: Next.js web app deployed as serverless functions with App Router Server Components and Client Components  
**Project Type**: Single Next.js application  
**Performance Goals**: Serve shop/detail with ISR (`revalidate = 60`), keep product APIs CDN-cacheable, avoid loading the full catalog for bestsellers, cache repeated list/detail/search/sold-count queries, and use infinite-scroll batch loading  
**Constraints**: Do not expose deleted products/variants; preserve locale-prefixed navigation; validate all query parameters; keep search resilient when Upstash Search is not configured; avoid caching high-cardinality free-text product list queries  
**Scale/Scope**: Customer-facing shop route, product detail route, product/search APIs, search-discovery service, cache helpers, Drizzle query helpers, and product feature components

## Constitution Check

_GATE: Must pass before implementation._

- **Server-First Rendering**: Shop and product pages remain Server Components with ISR; client components are used only for search input/dialog, filtering controls, infinite scroll, variant selection, cart actions, wishlist, and recently viewed behavior.
- **Type Safety End-to-End**: Product, variant, search, and API contracts use TypeScript types and Zod validation for public query/body parsing.
- **Data Consistency**: Public reads use existing Drizzle read clients and cache helpers; product mutations/admin updates invalidate product-related caches outside this feature scope.
- **Search Resilience**: Upstash Search is optional and must return `null`/fallback to database search on missing env vars or failures.
- **Accessibility & Localization**: Search dialog/buttons, stock labels, filters, and internal navigation retain ARIA labels and locale-aware links.

## Project Structure

### Documentation (this feature)

```text
specs/008-product-catalog-and-search/
├── spec.md
├── plan.md
└── tasks.md
```

### Source Code (repository root)

```text
src/
├── app/
│   ├── [locale]/(public)/shop/page.tsx
│   ├── [locale]/(public)/shop/loading.tsx
│   ├── [locale]/(public)/shop/error.tsx
│   ├── [locale]/(public)/products/[id]/page.tsx
│   ├── [locale]/(public)/products/[id]/ProductClient.tsx
│   ├── [locale]/(public)/products/[id]/components/
│   ├── [locale]/(public)/products/[id]/lib/
│   ├── api/products/route.ts
│   ├── api/products/[id]/route.ts
│   ├── api/products/bestsellers/route.ts
│   └── api/search/
│       ├── route.ts
│       ├── suggest/route.ts
│       └── click/route.ts
├── components/
│   ├── SearchBar.tsx
│   └── ui/LocaleLink.tsx
├── contexts/
│   ├── CurrencyContext.tsx
│   └── LocaleContext.tsx
├── features/
│   ├── cart/
│   ├── product/
│   │   ├── components/
│   │   ├── hooks/useRecentlyViewed.ts
│   │   └── variant-utils.ts
│   └── wishlist/
└── lib/
    ├── cache.ts
    ├── db-queries.ts
    ├── search-discovery.ts
    ├── search/
    ├── schema.ts
    └── types.ts

__tests__/
├── app/api/products/
├── app/api/search/
├── app/[locale]/(public)/shop/
├── app/[locale]/(public)/products/[id]/
├── components/
├── features/product/
└── lib/
```

**Structure Decision**: Keep catalog/detail/search behavior within the existing Next.js app: Server Components own initial data and ISR, route handlers expose paginated/search APIs, `lib/search-discovery.ts` coordinates search/filter/sort/fallback behavior, `lib/db-queries.ts` owns Drizzle reads and aggregations, and product feature components own reusable client UI.

## Delivery Phases

1. **Catalog data foundation**: Products, variants, categories, sold counts, bestsellers, cache keys, and public route handlers.
2. **Shop discovery UI**: Shop page, ProductGrid, filter URL state, SearchBar suggestions, infinite scroll, empty-state suggestions/trending links.
3. **Search services**: Upstash Search indexing/search client, cached product ID lookup, `/api/search`, `/api/search/suggest`, and click/zero-result telemetry.
4. **Product detail flow**: Product page metadata/ISR, ProductClient, image carousel, variant/option resolution, stock badges, share button, reviews, and recently viewed tracking.
5. **Cart integration**: Variant-required add-to-cart, guest pending cart, authenticated Redux cart thunk, quantity clamping, stock/all-in-cart panels, and mobile sticky action bar.
6. **Validation**: Unit/route/component coverage plus Playwright checks for browse, filter, search, detail, variant, and stock/add-to-cart flows.
