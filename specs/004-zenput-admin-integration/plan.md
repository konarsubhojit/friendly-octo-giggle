# Implementation Plan: Zenput Admin Integration

**Branch**: `004-zenput-admin-integration` | **Date**: 2025-07-16 | **Spec**: [spec.md](./spec.md)  
**Input**: Feature specification from `specs/004-zenput-admin-integration/spec.md`

## Summary

Replace every custom-styled native `<input>`, `<textarea>`, and `<select>` element
in the admin product and variation form modals with zenput@1 library components
(TextInput, TextArea, NumberInput, SelectInput, FileInput). Simultaneously replace
the card-grid and card-list layouts on the Products and Orders admin pages with
zenput DataTable. No API routes, Redux slices, data-fetching hooks, or database
schema are modified — this is a pure UI-layer migration.

## Technical Context

**Language/Version**: TypeScript 6.0.2 with `strict: true`  
**Primary Dependencies**: React 19.2, Next.js 16.2 (App Router), zenput@1.0.0,
Tailwind CSS v4, Redux Toolkit 2.x, react-hot-toast  
**Storage**: N/A — no schema or data layer changes  
**Testing**: Vitest 4.x + React Testing Library 16.x (unit); Playwright 1.59.x (E2E/UI)  
**Target Platform**: Next.js App Router (`app/` directory), Vercel serverless  
**Project Type**: Web application — admin sub-section, client-side UI components  
**Performance Goals**: Admin page Time-to-Interactive must not increase by more than 10%
after adding zenput (SC-006); zenput@1.0.0 adds ~131 transitive packages, isolated to
admin bundle  
**Constraints**: Tailwind CSS v4 in use — zenput ships its own styles so any conflicts
must be isolated at the component boundary. `AdditionalImageRow` native inputs are
explicitly out of scope and must remain unchanged (no zenput equivalent exists for
multi-image management)  
**Scale/Scope**: 4 files modified; 4 user stories; 15 form-field replacements (7 in
ProductFormModal including currency selector, 8 in VariationFormModal including currency selector); 2 DataTable integrations

## Constitution Check

_GATE: Must pass before Phase 0 research. Re-check after Phase 1 design._

| #    | Principle                                                                  | Status        | Notes                                                                                                                                                                                                                                                                              |
| ---- | -------------------------------------------------------------------------- | ------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| I    | **Server-First Rendering** — only add `'use client'` when needed           | ✅ PASS       | All 4 modified files are already `'use client'` components (they use hooks, browser state, and event handlers). No new client boundaries are introduced.                                                                                                                           |
| II   | **Type Safety End-to-End** — strict TypeScript, Zod for runtime boundaries | ✅ PASS       | No new runtime input boundaries; only UI components change. zenput exports full TypeScript types. Row-mapper objects must satisfy `DataTableRecord` (`Record<string, any>`) — trivially compatible. All props must be typed explicitly at call sites.                              |
| III  | **Testing Discipline** — Vitest unit tests + Playwright for UI changes     | ✅ PASS       | FR-030 and SC-005 mandate Playwright verification. Unit tests for `ProductFormModal` and `VariationFormModal` must be updated to replace native element queries with zenput component queries. Coverage must not decrease (SC-008).                                                |
| IV   | **Serverless & Caching Architecture**                                      | ✅ PASS / N/A | No server-side code, API routes, caching, or background jobs are touched.                                                                                                                                                                                                          |
| V    | **Security by Default** — auth checks, RBAC, OWASP                         | ✅ PASS       | Admin route protection via `checkAdminAuth()` is upstream of the changed components and is not modified. FR-028 explicitly prohibits touching auth logic. All zenput interactive components must remain keyboard-accessible (FR-029, SC-007).                                      |
| VI   | **Observability & Structured Logging**                                     | ✅ PASS / N/A | No API routes are modified; `withApiLogging` middleware is unaffected.                                                                                                                                                                                                             |
| VII  | **Simplicity & YAGNI** — justify new dependencies                          | ✅ PASS       | zenput@1 is the direct subject of the feature requirement. No speculative abstractions. `AdditionalImageRow` is explicitly left as a native input (no zenput multi-image equivalent exists). Currency selectors are now replaced with zenput SelectInput per updated requirements. |
| VIII | **DRY Shared Utilities** — extract when 3+ files share logic               | ✅ PASS       | The two DataTable column definitions (products, orders) live in separate page files and share no logic. The validation-state helper (`fieldError ? 'error' : 'default'`) appears in both form modals; if it reaches a third file it must be extracted to `lib/`. Not required yet. |

**Post-Design Re-check**: Re-evaluate Principle II (type safety of row-mapper shapes) and
Principle III (updated test queries) after Phase 1 data-model work.

## Project Structure

### Documentation (this feature)

```text
specs/004-zenput-admin-integration/
├── plan.md         ← this file
├── research.md     ← Phase 0 output
├── data-model.md   ← Phase 1 output
├── quickstart.md   ← Phase 1 output
└── tasks.md        ← Phase 2 output (/speckit.tasks — NOT created by /speckit.plan)
```

_No `contracts/` directory: this feature makes no changes to public-facing API
surfaces, CLI schemas, or inter-service interfaces._

### Source Code (repository root)

```text
src/
├── features/admin/
│   ├── components/
│   │   ├── ProductFormModal.tsx      ← replace 7 native fields with zenput components
│   │   └── VariationFormModal.tsx    ← replace 8 native fields with zenput components
│   └── hooks/
│       └── useProductForm.ts         ← read-only reference; no changes
├── app/admin/
│   ├── products/
│   │   └── page.tsx                  ← replace card grid with zenput DataTable
│   └── orders/
│       └── page.tsx                  ← replace AdminOrderCard list with zenput DataTable

__tests__/
└── features/admin/components/
    ├── ProductFormModal.test.tsx      ← update queries for zenput components
    └── VariationFormModal.test.tsx    ← update queries for zenput components

playwright-tests/admin/
├── products.spec.ts                  ← verify DataTable + form fields + Playwright screenshot
└── orders.spec.ts                    ← verify DataTable + View action + Playwright screenshot
```

**Structure Decision**: Single Next.js App Router project. All changes are within the
existing `src/features/admin/` and `src/app/admin/` directories. No new directories
are created. Test files mirror the source path under `__tests__/` (co-located unit
tests) and `playwright-tests/admin/` (UI tests), matching the project's established
conventions.

## Complexity Tracking

> No constitution violations requiring justification. Section left intentionally blank.
