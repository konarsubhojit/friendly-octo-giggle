# Implementation Plan: Shopping Cart and Checkout

**Branch**: `007-shopping-cart-and-checkout` | **Date**: 2026-06-09 | **Spec**: [spec.md](./spec.md)  
**Input**: Feature specification from `specs/007-shopping-cart-and-checkout/spec.md`

## Summary

Document the shipped shopping cart and checkout hand-off: Redux-driven cart UI, authenticated and guest cart identity, PostgreSQL cart persistence with Redis-backed reads, stock-aware line mutations, guest-to-user merge behavior, structured shipping collection, and queue-backed checkout request processing that creates orders asynchronously.

## Technical Context

**Language/Version**: TypeScript 5.9 (`strict: true`) with React 19.2  
**Primary Dependencies**: Next.js App Router, Redux Toolkit, NextAuth v5, Drizzle ORM, Zod, Upstash Redis, Vercel Queue/functions, React Hot Toast  
**Storage**: PostgreSQL via Drizzle for carts, cart items, checkout requests, and orders; Redis/application cache for cart read optimization; browser localStorage/sessionStorage for pending guest and checkout hand-off data  
**Testing**: Vitest + React Testing Library for unit/component/route tests; Playwright for checkout/cart UI flows where required  
**Target Platform**: Next.js web application running serverless route handlers and client components  
**Project Type**: Single Next.js application  
**Performance Goals**: Keep cart reads fast through Redis/cache, avoid duplicate carts under concurrent requests, and keep checkout order creation durable through queued processing  
**Constraints**: Cart/checkout pages require authentication; guest add intent is preserved separately; all cart mutations must enforce ownership and stock; checkout request status must be user-owned; checkout queue processing must be idempotent  
**Scale/Scope**: Public product, cart, shipping, review, confirmation UI plus cart/checkout API routes, cart services, queue consumer, schema entities, Redux thunks, and cache helpers

## Constitution Check

_GATE: Must pass before implementation._

- **Server-First Rendering**: Existing cart and checkout route pages are client components because they depend on Redux, session state, browser storage, and interactive forms; server route handlers own persistence.
- **Type Safety End-to-End**: Cart and checkout payloads are validated with Zod schemas and typed service interfaces before persistence or queue publication.
- **Security by Default**: Ownership checks protect cart item mutations and checkout request status; guest cookies are HMAC-signed and HTTP-only.
- **Data Consistency**: Primary Drizzle client is used for cart mutations, unique constraints prevent duplicate owner carts and duplicate product/variant lines, and checkout requests link to orders for idempotency.
- **Graceful Degradation**: Redis read optimization is best-effort; cache misses or failures fall back to PostgreSQL without changing behavior.

## Project Structure

### Documentation (this feature)

```text
specs/007-shopping-cart-and-checkout/
├── spec.md
├── plan.md
└── tasks.md
```

### Source Code (repository root)

```text
src/
├── app/
│   ├── [locale]/(public)/cart/
│   │   ├── page.tsx
│   │   ├── loading.tsx
│   │   └── error.tsx
│   ├── [locale]/(public)/checkout/
│   │   ├── shipping/page.tsx
│   │   ├── review/page.tsx
│   │   └── confirmation/page.tsx
│   ├── api/cart/
│   │   ├── route.ts
│   │   └── items/[id]/route.ts
│   ├── api/checkout/
│   │   ├── route.ts
│   │   └── [id]/route.ts
│   └── api/queue/checkout-orders/route.ts
├── features/
│   ├── cart/
│   │   ├── components/
│   │   ├── services/
│   │   ├── store/cartSlice.ts
│   │   ├── validations.ts
│   │   └── utils/variant-label.ts
│   └── orders/services/order-summary.ts
└── lib/
    ├── schema.ts
    ├── cache.ts
    ├── redis.ts
    ├── api-client.ts
    └── queue.ts

__tests__/
├── app/api/cart/
├── app/api/checkout/
├── features/cart/
└── components/cart/
```

**Structure Decision**: The shipped implementation keeps cart domain logic in `src/features/cart`, uses `src/app/api/*` route handlers for mutations and checkout status, keeps queue consumption under `src/app/api/queue`, and derives cart/checkout UI from Redux selectors and shared order-summary helpers.

## Delivery Phases

1. **Schema and identity foundation**: Define short-ID carts, unique owner/session identity, cart items, checkout requests, guest session signing, and Zod contracts.
2. **Cart API and persistence**: Implement get/add/update/remove/clear flows with ownership checks, stock validation, cache invalidation, and Redis read backfill.
3. **Guest continuity**: Add localStorage pending cart support and server-side guest-session merge/rotation into authenticated carts.
4. **Cart UI**: Render authenticated cart, grouped variants, quantity controls, customization notes, currency-formatted totals, empty/auth states, and navigation to shipping.
5. **Checkout hand-off**: Collect structured address, save optional address, persist pending checkout data, review policies/items/totals, enqueue checkout requests, poll status, clear cart, and show confirmation.
6. **Queue processing and recovery**: Consume checkout queue messages, process order creation idempotently, update status, fall back on publish failure, and mark retry-exhausted failures.
7. **Validation**: Cover service, route, Redux, UI, and queue paths with unit/integration tests plus manual Playwright verification for the shipped purchase flow.
