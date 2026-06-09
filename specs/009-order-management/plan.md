# Implementation Plan: Order Management

**Branch**: `009-order-management` | **Date**: 2026-06-09 | **Spec**: [spec.md](./spec.md)  
**Input**: Feature specification from `specs/009-order-management/spec.md`

**Note**: This plan documents the existing shipped implementation by reverse-engineering the current code paths. It is not a proposal for source-code changes.

## Summary

Document the customer order management feature as implemented: authenticated checkout creates durable checkout requests, a queue consumer creates `PENDING` orders with item/variant rows and stock updates, customers can view/search paginated order history, inspect order detail with lifecycle/tracking data, and cancel only pending orders. The implementation uses Next.js App Router route handlers, Redux Toolkit client state for order detail/cancellation, Drizzle over PostgreSQL primary/replica clients, Redis caching/search where configured, Zod validation, and the modular email/QStash delivery system.

## Technical Context

**Language/Version**: TypeScript 5.9 with strict Next.js App Router code  
**Primary Dependencies**: Next.js 16 App Router, React 19, Redux Toolkit, NextAuth v5, Drizzle ORM, Zod, Upstash Redis/Search, QStash/Vercel queue helpers, modular Nodemailer/SendGrid email stack  
**Storage**: PostgreSQL via Drizzle (`primaryDrizzleDb` for checkout/order mutations, `drizzleDb` read composite for reads), Redis hashes/sets/search index for order cache/search, failed email records in PostgreSQL  
**Testing**: Vitest + React Testing Library for route/service/component coverage; Playwright for checkout/order UI flows where changed  
**Target Platform**: Serverless Next.js web application with client order pages under localized public routes  
**Project Type**: Single Next.js application  
**Performance Goals**: Order history paginates at 20 default / 100 maximum API limit, cache order lists/details, use Redis Search for broad order search with database fallback  
**Constraints**: Authenticated customer ownership only; exactly-one order per checkout request; no customer cancellation after `PENDING`; queue/email fallbacks must not lose order state  
**Scale/Scope**: Checkout submission, order creation, order list/search, order detail/cancellation, admin status lifecycle, Redis/email integration

## Constitution Check

_GATE: Must pass before implementation._

- **Server-First + Client Boundaries**: Route handlers and services own data access; client components are used for checkout review, order list interaction, and order detail/cancellation state.
- **Type Safety End-to-End**: Zod schemas validate checkout/order status payloads; TypeScript interfaces mirror API response shapes; Drizzle schema defines enums and relations.
- **Security by Default**: `auth()` protects customer APIs/pages, `assertOwnership` hides cross-user order access, admin status APIs use `checkAdminAuth`.
- **Reliability and Idempotency**: Checkout requests are durable, queue processing checks for an existing order by `checkoutRequestId`, queue exhaustion recovery marks failures safely.
- **Observability**: Business/performance/error logs record checkout queueing, order creation/failure, status updates, email queueing, Redis/search fallbacks, and retry exhaustion.

## Project Structure

### Documentation (this feature)

```text
specs/009-order-management/
├── spec.md
├── plan.md
└── tasks.md
```

### Source Code (repository root)

```text
src/
├── app/
│   ├── [locale]/(public)/checkout/review/page.tsx
│   ├── [locale]/(public)/orders/
│   │   ├── OrdersClient.tsx
│   │   ├── page.tsx
│   │   └── [id]/page.tsx
│   └── api/
│       ├── checkout/route.ts
│       ├── checkout/[id]/route.ts
│       ├── orders/route.ts
│       ├── orders/[id]/route.ts
│       ├── queue/checkout-orders/route.ts
│       ├── services/email/route.ts
│       └── admin/orders/[id]/route.ts
├── features/
│   ├── cart/
│   │   ├── services/checkout-service.ts
│   │   ├── validations.ts
│   │   └── components/OrderPolicyConfirmDialog.tsx
│   └── orders/
│       ├── actions/orders.ts
│       ├── components/OrderListCard.tsx
│       ├── components/OrdersSearchForm.tsx
│       ├── services/order-service.ts
│       ├── services/order-search.ts
│       ├── services/orders-search-index.ts
│       ├── services/order-summary.ts
│       ├── store/ordersSlice.ts
│       └── validations.ts
└── lib/
    ├── schema.ts
    ├── short-id.ts
    ├── serializers.ts
    ├── cache.ts
    ├── redis.ts
    ├── email/
    ├── qstash-events.ts
    └── types.ts

__tests__/
├── app/api/checkout/
├── app/api/orders/
├── features/cart/
├── features/orders/
└── lib/email/
```

**Structure Decision**: Keep order-management behavior split by runtime responsibility: checkout durability in `features/cart/services/checkout-service.ts`, order persistence/search in `features/orders/services/*`, customer APIs under `src/app/api/orders` and `src/app/api/checkout`, and customer UI under localized `orders` and `checkout/review` routes. This spec intentionally references `specs/003-order-policy-dialog` for the separate policy confirmation dialog rather than duplicating that feature's policy-copy scope.

## Delivery Phases

1. **Checkout foundation**: Validate checkout input, persist `CheckoutRequest`, enqueue `checkout-orders`, poll `/api/checkout/[id]`, and recover failed queue attempts.
2. **Order persistence**: Create `Order`/`OrderItem` rows in a primary transaction, validate products/variants, decrement stock, serialize created order, and invalidate affected caches.
3. **History/search**: Serve authenticated `/api/orders` with cursor/offset pagination, total count, Redis Search or database fallback, and customer order cards.
4. **Detail/cancellation**: Serve authenticated `/api/orders/[id]`, enforce ownership, render lifecycle/detail UI, and allow customer cancellation only while `PENDING`.
5. **Lifecycle notifications**: Support admin status/tracking updates, update Redis/cache state, and queue or fallback-send order confirmation/status emails.
6. **Validation/documentation**: Maintain route/service/component tests for the documented behavior and keep this spec distinct from the order-policy dialog specification.
