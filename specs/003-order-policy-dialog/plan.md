# Implementation Plan: Order Policy Confirmation

**Branch**: `003-order-policy-dialog` | **Date**: 2026-03-25 | **Spec**: `/Users/subho/sources/repos/friendly-octo-giggle/specs/003-order-policy-dialog/spec.md`
**Input**: Feature specification from `/Users/subho/sources/repos/friendly-octo-giggle/specs/003-order-policy-dialog/spec.md`

## Summary

Add a pre-submit order policy confirmation step to the cart checkout flow that blocks the existing checkout request until the shopper reviews an itemized order breakdown, pricing totals, and the no-cancellation/no-refund damaged-item replacement policy. Implement it as a dedicated client-side dialog in the current checkout form, centralize the policy copy in a shared typed module for reuse on the cart, Help, and Returns surfaces, and cover the behavior with Vitest and Playwright without changing the existing `/api/checkout` contract.

## Technical Context

**Language/Version**: TypeScript 5.9.3, React 19.2.4, Next.js 16.1.6  
**Primary Dependencies**: Next.js App Router, Redux Toolkit, NextAuth v5 beta, Tailwind CSS v4, react-hot-toast, Zod, Drizzle ORM  
**Storage**: PostgreSQL via Neon/Drizzle and Redis/Upstash already exist; this feature adds no new persistence  
**Testing**: Vitest 4 + React Testing Library + jest-dom, Playwright 1.58 with accessibility checks  
**Target Platform**: Serverless Next.js web app on Vercel for modern desktop/mobile browsers  
**Project Type**: Single Next.js web application  
**Performance Goals**: Open the review dialog from existing client state with no extra pre-confirmation network request; preserve current checkout enqueue flow and keep perceived pre-submit interaction near-instant  
**Constraints**: Must use an accessible dialog with checkbox-gated confirmation; must keep policy wording and support email consistent across cart, Help, and Returns; must preserve current `/api/checkout` request/response shape; must stay compliant with serverless, strict TypeScript, and existing currency formatting patterns  
**Scale/Scope**: Cart checkout flow, Help page, Returns page, shared policy content, unit/component tests, and one Playwright checkout verification flow

## Constitution Check

_GATE: Must pass before Phase 0 research. Re-check after Phase 1 design._

- **I. Server-First Rendering**: PASS. The cart page is already a Client Component because it depends on Redux and session hooks. The plan keeps the new confirmation behavior inside that existing client boundary and does not introduce unsupported client-only dynamic imports into Server Components.
- **II. Type Safety End-to-End**: PASS. Shared policy copy will be typed in code, existing checkout payload types remain unchanged, and no new raw API boundary is introduced.
- **III. Testing Discipline**: PASS. Plan includes new Vitest coverage for dialog gating and shared policy content plus Playwright verification for the checkout flow and screenshots for the changed UI.
- **IV. Serverless & Caching Architecture**: PASS. No new long-lived process or in-memory cross-request state is introduced. The existing serverless checkout route remains the only mutation boundary.
- **V. Security by Default**: PASS. Authentication and authorization continue to flow through the current checkout route. No new secrets or privileged endpoints are added.
- **VI. Observability & Structured Logging**: PASS. Existing `/api/checkout` logging stays intact because the feature defers submission rather than replacing the route.
- **VII. Simplicity & YAGNI**: PASS. The design uses a feature-specific dialog and a small shared policy constant module rather than introducing CMS/config infrastructure.
- **VIII. DRY Shared Utilities**: PASS. Policy wording is centralized once and reused across all in-scope surfaces. Order/pricing summary rendering can be extracted only where reuse actually occurs.

**Post-Design Re-check**: PASS. The design artifacts keep the change scoped to current app boundaries, avoid new persistence or API churn, and explicitly centralize reused content to prevent policy drift.

## Project Structure

### Documentation (this feature)

```text
specs/003-order-policy-dialog/
├── plan.md
├── research.md
├── data-model.md
├── quickstart.md
├── contracts/
│   └── checkout-policy-dialog.md
└── tasks.md
```

### Source Code (repository root)

```text
app/
├── cart/page.tsx
├── help/page.tsx
└── returns/page.tsx

components/
├── cart/
│   ├── CheckoutForm.tsx
│   ├── CartItemRow.tsx
│   └── OrderPolicyConfirmDialog.tsx        # new
└── ui/
    └── ConfirmDialog.tsx

lib/
├── constants/
│   └── checkout-policies.ts                # new
├── order-summary.ts
├── types.ts
└── features/cart/

__tests__/
├── components/cart/
│   ├── CheckoutForm.test.tsx               # new
│   └── OrderPolicyConfirmDialog.test.tsx   # new
├── app/
│   ├── help/page.test.tsx                  # new or extended
│   └── returns/page.test.tsx               # new or extended
└── lib/constants/
    └── checkout-policies.test.ts           # new

playwright-tests/
├── cart.spec.ts                            # extend or reference
└── checkout-policy.spec.ts                 # new
```

**Structure Decision**: Keep the feature inside the existing single-app Next.js structure. Interactive checkout changes stay in `components/cart/`, canonical policy content lives in `lib/constants/`, customer-facing policy pages stay under `app/`, and verification is split between `__tests__/` and `playwright-tests/`.

## Complexity Tracking

No constitution violations or complexity exceptions are expected for this feature.
