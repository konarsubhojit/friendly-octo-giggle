# Implementation Plan: Admin Product Variation Management

**Branch**: `002-admin-variation-management` | **Date**: 2026-03-19 | **Spec**: [spec.md](spec.md)
**Input**: Feature specification from `/specs/002-admin-variation-management/spec.md`

## Summary

Add full CRUD management for product variations in the admin panel. This includes: a new dedicated product edit page (`/admin/products/[id]`) replacing the current modal-based editing pattern, variation API endpoints for create/update/soft-delete, Zod validation schemas, a `deletedAt` column on `productVariations` for soft delete, and filtering of soft-deleted variations from all customer-facing queries. The admin page displays product details alongside a variations section with inline create/edit forms and a deletion confirmation modal.

## Technical Context

**Language/Version**: TypeScript 5.9, React 19.2, Next.js 16.1  
**Primary Dependencies**: Drizzle ORM 0.45, Redux Toolkit 2.11, Zod 4.3, Tailwind CSS v4.1, NextAuth v5, Vercel Blob  
**Storage**: PostgreSQL (Neon Serverless) + Redis (ioredis 5.9)  
**Testing**: Vitest 4.0 + jsdom + React Testing Library 16.3 + Playwright  
**Target Platform**: Serverless web (Vercel / AWS Lambda)  
**Project Type**: Web application (Next.js App Router, fullstack)  
**Performance Goals**: API responses <500ms, page load <2s, cache invalidation <60s propagation  
**Constraints**: Serverless (no in-memory state across requests), 25 variations max per product, soft-delete for order history integrity  
**Scale/Scope**: ~50 products currently, up to 25 variations each, admin-only feature

## Constitution Check

_GATE: Must pass before Phase 0 research. Re-check after Phase 1 design._

| #   | Principle               | Status | Notes                                                                                                                                               |
| --- | ----------------------- | ------ | --------------------------------------------------------------------------------------------------------------------------------------------------- |
| I   | Server-First Rendering  | PASS   | Product edit page is a Server Component; variation form is Client Component (requires interactivity). No `next/dynamic` with `{ ssr: false }` used. |
| II  | Type Safety End-to-End  | PASS   | New Zod schemas for variation create/update. Drizzle typed queries. No raw SQL.                                                                     |
| III | Testing Discipline      | PASS   | Unit tests for new validation schemas, API routes, and Redux slice changes. Playwright for admin UI.                                                |
| IV  | Serverless & Caching    | PASS   | No in-memory state. Redis cache invalidation on variation writes. ISR-compatible.                                                                   |
| V   | Security by Default     | PASS   | All variation endpoints check `auth()` + `role === "ADMIN"`. Input validated with Zod. Parameterized queries via Drizzle.                           |
| VI  | Observability & Logging | PASS   | New API routes wrapped with `withApiLogging`. Errors via `handleApiError`.                                                                          |
| VII | Simplicity & YAGNI      | PASS   | No speculative abstractions. Reuses existing patterns (upload, cache, auth). Schema change is minimal (one column addition).                        |

**Gate result: ALL PASS** — Proceed to Phase 0.

## Project Structure

### Documentation (this feature)

```text
specs/002-admin-variation-management/
├── plan.md              # This file
├── research.md          # Phase 0: Research findings
├── data-model.md        # Phase 1: Entity model + schema changes
├── quickstart.md        # Phase 1: Dev setup for this feature
├── contracts/           # Phase 1: API contracts
│   └── variation-api.md # Variation CRUD endpoints
└── tasks.md             # Phase 2: Implementation tasks (via /speckit.tasks)
```

### Source Code (repository root)

```text
lib/
├── schema.ts                          # MODIFY: Add deletedAt to productVariations
├── validations.ts                     # MODIFY: Add variation Zod schemas
├── db.ts                              # MODIFY: Filter soft-deleted variations in queries
├── cache.ts                           # MODIFY: Add variation cache key patterns
└── features/admin/adminSlice.ts       # MODIFY: Add variation thunks + state

app/
├── admin/products/[id]/
│   └── page.tsx                       # NEW: Dedicated product edit page
├── api/admin/products/[id]/
│   └── variations/
│       ├── route.ts                   # NEW: GET (list) + POST (create) variation
│       └── [variationId]/
│           └── route.ts               # NEW: PUT (update) + DELETE (soft-delete) variation

components/admin/
├── ProductEditForm.tsx                # NEW: Product details edit form (extracted from modal)
├── VariationList.tsx                  # NEW: Variation cards list with empty state
├── VariationFormModal.tsx             # NEW: Create/edit variation modal form
└── DeleteConfirmModal.tsx             # EXISTING: Reused for variation deletion

drizzle/
└── XXXX_add_variation_soft_delete.sql # NEW: Migration for deletedAt column

__tests__/
├── lib/validations.test.ts            # MODIFY: Add variation schema tests
├── lib/features/admin/adminSlice.test.ts  # MODIFY: Add variation state tests
├── app/api/admin/products/[id]/
│   └── variations/route.test.ts       # NEW: Variation API tests
└── components/admin/
    ├── VariationList.test.tsx          # NEW: Variation list component tests
    └── VariationFormModal.test.tsx     # NEW: Variation form component tests
```

**Structure Decision**: Follows the existing Next.js App Router convention. New API routes nest under the product `[id]` segment. New components go in `components/admin/`. The product edit page is a new route at `/admin/products/[id]`.

## Complexity Tracking

> No constitution violations — no entries needed.
