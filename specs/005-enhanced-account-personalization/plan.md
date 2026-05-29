# Implementation Plan: Enhanced Account, Wishlist, and Personalization

**Branch**: `005-enhanced-account-personalization` | **Date**: 2026-05-27 | **Spec**: [spec.md](./spec.md)  
**Input**: Feature specification from `specs/005-enhanced-account-personalization/spec.md`

## Summary

Deliver a phased enhancement to account and commerce experience: synchronized persistent wishlists, a richer account dashboard, personalized homepage modules, per-user currency preferences, event-driven notifications (including back-in-stock/price-drop), guest cart merge prompts, and upgraded out-of-stock/backorder UX. Keep existing APIs and data access patterns where possible while extending schema/services in tightly scoped increments.

## Technical Context

**Language/Version**: TypeScript 6.x (`strict: true`)  
**Primary Dependencies**: Next.js App Router, Drizzle ORM, NextAuth, Redux Toolkit, Upstash/queue tooling, existing mailer stack  
**Storage**: PostgreSQL via Drizzle + Redis caching where already established  
**Testing**: Vitest + React Testing Library + route/service tests already present in `__tests__/`  
**Target Platform**: Next.js web app (serverless runtime + client components)  
**Project Type**: Single Next.js application  
**Performance Goals**: Maintain current page responsiveness while adding personalization and notification orchestration  
**Constraints**: No cross-user data leakage; idempotent notification processing; currency fallback when rate data is unavailable  
**Scale/Scope**: New account/wishlist/personalization/notification data paths spanning API routes, feature services, and account/home UI sections

## Constitution Check

_GATE: Must pass before implementation._

- **Server-First Rendering**: Preserve server rendering defaults; add/retain client boundaries only where interaction state requires it.
- **Type Safety End-to-End**: Extend schema and service types for new entities and API contracts.
- **Testing Discipline**: Add route/service/component tests for each user-facing flow.
- **Security by Default**: Enforce per-user access checks, dedupe notification events, and avoid exposing personalized data in shared caches.
- **Observability**: Emit logs/metrics for notification queue outcomes and merge/personalization fallbacks.

## Project Structure

### Documentation (this feature)

```text
specs/005-enhanced-account-personalization/
├── spec.md
├── plan.md
└── tasks.md
```

### Source Code (repository root)

```text
src/
├── app/
│   ├── account/
│   ├── api/account/
│   ├── api/wishlist/
│   ├── api/notifications/
│   └── api/cron/
├── features/
│   ├── account/
│   ├── wishlist/
│   ├── cart/
│   └── notifications/
└── lib/
    ├── db-queries.ts
    ├── schema.ts
    ├── cache.ts
    └── metrics.ts

__tests__/
├── app/api/
├── features/
└── lib/
```

**Structure Decision**: Extend existing domain slices (`wishlist`, `cart`, `account`) and add a dedicated `notifications` feature area for queue/delivery orchestration. Reuse established API and test placement patterns.

## Delivery Phases

1. **Data & contracts**: Add schema/entities and typed query helpers for wishlist sync, currency preference, subscriptions, notification events.
2. **User-facing flows**: Expand account dashboard + homepage personalization + currency preference controls.
3. **Event processing**: Add background notification jobs (order status, sale campaigns, stock/price triggers) with retries and dedupe.
4. **Commerce UX polish**: Add guest cart merge prompt path and out-of-stock/backorder improvements across PDP/cart.
5. **Validation**: Complete route/service/component tests and documentation updates per acceptance criteria.
