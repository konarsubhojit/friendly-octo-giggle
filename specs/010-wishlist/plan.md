# Implementation Plan: Wishlist

**Branch**: `010-wishlist` | **Date**: 2026-06-09 | **Spec**: [spec.md](./spec.md)  
**Input**: Feature specification from `/specs/010-wishlist/spec.md`

**Note**: This plan documents an existing shipped feature by mapping the implementation to the Specify plan format.

## Summary

Document the shipped account-backed wishlist feature: authenticated users can save/unsave products through reusable heart controls, view saved products on `/wishlist`, and rely on persisted PostgreSQL rows for cross-session/device state. The implementation uses Next.js App Router API routes, NextAuth session checks, Drizzle query helpers, Redux Toolkit thunks/state, Zod request validation, and existing product serialization/price display utilities.

## Technical Context

**Language/Version**: TypeScript 5.x with strict project conventions  
**Primary Dependencies**: Next.js App Router, React client components, NextAuth, Redux Toolkit, Drizzle ORM, Zod, next/image  
**Storage**: PostgreSQL via Drizzle `Wishlist` table with `User` and `Product` foreign keys  
**Testing**: Vitest + React Testing Library + route tests under `__tests__/`  
**Target Platform**: Next.js storefront web application on serverless-compatible runtime  
**Project Type**: Single Next.js application  
**Performance Goals**: Keep wishlist controls lightweight in product grids; avoid duplicate persisted rows; fetch full product data only for wishlist page needs  
**Constraints**: Authenticated-only persistence; no guest-local wishlist; no cross-user data access; optimistic UI does not automatically roll back on thunk failure  
**Scale/Scope**: Storefront-wide Redux slice, two API route handlers, one wishlist page route, reusable heart button, product grid and mobile PDP integration

## Constitution Check

_GATE: Must pass before implementation._

- **Server-First Rendering**: Wishlist page and button are client components only where session, Redux, click handling, and browser state require it.
- **Type Safety End-to-End**: API request body validation uses Zod and data access uses typed Drizzle schema/query helpers.
- **Security by Default**: Every API operation checks `auth()` and scopes database reads/writes to `session.user.id`.
- **Data Integrity**: Database uniqueness on `(userId, productId)` and conflict-do-nothing inserts make add operations idempotent.
- **Accessibility**: Wishlist controls expose product-specific labels, `aria-pressed`, hidden decorative SVGs, loading, auth-required, empty, and error states.
- **Testing Discipline**: Existing tests cover slice reducers/thunks, button behavior, route authorization, route success paths, and DB query helpers.

## Project Structure

### Documentation (this feature)

```text
specs/010-wishlist/
├── spec.md
├── plan.md
└── tasks.md
```

### Source Code (repository root)

```text
src/
├── app/
│   ├── api/wishlist/
│   │   ├── route.ts
│   │   └── [productId]/route.ts
│   └── [locale]/(public)/wishlist/
│       ├── page.tsx
│       ├── loading.tsx
│       └── error.tsx
├── components/layout/header/
│   └── UserMenu.tsx
├── features/
│   ├── product/components/ProductGrid.tsx
│   └── wishlist/
│       ├── components/WishlistButton.tsx
│       └── store/wishlistSlice.ts
├── app/[locale]/(public)/products/[id]/components/
│   └── StickyMobileActionBar.tsx
└── lib/
    ├── schema.ts
    ├── db-queries.ts
    └── store.ts

__tests__/
├── app/api/wishlist/
├── features/wishlist/components/
├── lib/features/wishlist/
└── lib/db-queries.test.ts
```

**Structure Decision**: Keep wishlist as a storefront feature slice under `src/features/wishlist`, backed by narrow App Router API endpoints and shared DB query helpers. Product surfaces consume only the reusable `WishlistButton`; the wishlist route owns full saved-product rendering and removal UX.

## Complexity Tracking

No constitution violations or unusual complexity are required. The shipped feature reuses existing store, API utility, auth, logging, schema, serialization, and UI component patterns.

## Delivery Phases

1. **Data model**: Add the `Wishlist` table with user/product foreign keys, uniqueness, and relations in `src/lib/schema.ts`.
2. **Data access**: Implement `db.wishlists` helpers for product ids, full products, idempotent add, removal, and membership checks in `src/lib/db-queries.ts`.
3. **API contract**: Expose authenticated `GET /api/wishlist`, `POST /api/wishlist`, and `DELETE /api/wishlist/{productId}` routes with Zod validation and structured error handling.
4. **Client state**: Add Redux Toolkit wishlist state, thunks, and optimistic toggle behavior in `src/features/wishlist/store/wishlistSlice.ts`; mount the slice in `src/lib/store.ts`.
5. **Interactive controls**: Implement `WishlistButton` and integrate it into product grid cards plus the mobile product detail sticky action bar.
6. **Wishlist destination**: Implement localized `/wishlist` page with auth-required, loading, error, empty, grid, product navigation, formatted prices, and removal flows.
7. **Navigation and validation**: Add user-menu navigation and automated tests for reducers, thunks, button behavior, API routes, and DB helper behavior.
