# Implementation Plan: Cozy Shop UI Redesign

**Branch**: `001-cozy-shop-ui` | **Date**: 2026-03-15 | **Spec**: [spec.md](spec.md)
**Input**: Feature specification from `/specs/001-cozy-shop-ui/spec.md`

## Summary

Transform the e-commerce site into a warm, cottagecore-themed shop called "The Kiyon Store." The redesign is purely visual — no backend, API, or database changes. It introduces a comprehensive CSS design token system (light + dark mode), Playfair Display decorative typography, inline SVG decorative elements, and warm-styled components across all customer-facing pages. The admin panel is excluded except for a category dropdown improvement (FR-038) and dark mode form element fix (FR-039), both already implemented in Phase 2.

## Technical Context

**Language/Version**: TypeScript 5.9, Next.js 16.1.6 (App Router), React 19.2.4
**Primary Dependencies**: Tailwind CSS v4.1 (CSS-first config), next/font/google (Playfair Display + Nunito), Redux Toolkit 2.11, NextAuth v5
**Storage**: N/A — no backend/DB changes (FR-035)
**Testing**: Vitest 4.0 + React Testing Library 16.3 (426+ existing tests), Playwright for E2E
**Target Platform**: Web (serverless on Vercel), responsive: mobile 375px / tablet 768px / desktop 1440px
**Project Type**: Web application (Next.js App Router)
**Performance Goals**: LCP < 2.5s (SC-006), no layout shifts from fonts/hero image
**Constraints**: WCAG 2.1 AA in both light and dark mode (FR-031), no admin panel visual changes except FR-038/FR-039, no new JS animation libraries, zero test regressions
**Scale/Scope**: ~30 component files + ~10 page files modified, ~50 tasks total

### Completed Work (Phase 1–2, T001–T007)

The following foundational work is already implemented and verified:

| Task | Artifact                                                                                          | Status      |
| ---- | ------------------------------------------------------------------------------------------------- | ----------- |
| T001 | Branch checkout, npm install, dev server                                                          | ✅ Complete |
| T002 | CSS design tokens (light + dark) in `globals.css`                                                 | ✅ Complete |
| T003 | `--font-display` CSS variable + `font-display` utility                                            | ✅ Complete |
| T004 | `focus-warm` utility for keyboard navigation                                                      | ✅ Complete |
| T005 | `prefers-reduced-motion` media query                                                              | ✅ Complete |
| T006 | Playfair Display font import, metadata update in `layout.tsx`                                     | ✅ Complete |
| T007 | FloralCartIcon + ButterflyAccent + MushroomAccent + FloralBorder in `DecorativeElements.tsx`      | ✅ Complete |
| —    | `PRODUCT_CATEGORIES` constant in `lib/constants/categories.ts`                                    | ✅ Complete |
| —    | Admin ProductFormModal category dropdown (FR-038)                                                 | ✅ Complete |
| —    | Dark mode `select option` styling (FR-039)                                                        | ✅ Complete |
| —    | Theme animation keyframes + utilities (shimmer, fade, float, etc.)                                | ✅ Complete |
| —    | `shadow-warm`, `shadow-warm-lg`, `bg-warm-gradient`, `text-warm-heading`, `border-warm` utilities | ✅ Complete |
| —    | `--surface` token (light: `#ffffff`, dark: `#241c16`)                                             | ✅ Complete |

### Remaining Work (T008–T062)

All remaining tasks are UI component and page styling changes, organized by user story priority:

- **Phase 3 (US1)**: Shared UI components, header, footer, hero, homepage, skeletons — T008–T027
- **Phase 4 (US2)**: Product grid, cards, filters, detail page, product loading/error states — T028–T038
- **Phase 5 (US3)**: Cart page styling — T039–T040
- **Phase 6 (US4)**: About page brand story — T041–T042
- **Phase 7 (US5)**: Decorative element placement across pages — T043–T049
- **Phase 8 (US6)**: Responsive, contrast, focus, dark mode, reduced motion audits — T050–T054
- **Phase 9**: Regression testing, lint, admin safety, performance, visual comparison, E2E — T055–T062

## Constitution Check

_GATE: Must pass before Phase 0 research. Re-check after Phase 1 design._

The project constitution (`.specify/memory/constitution.md`) uses a generic template without project-specific rules. No custom gates, principles, or constraints are defined beyond the template placeholders. Therefore:

- **Gate status**: PASS (no constitution violations possible — no rules defined)
- **Feature-specific constraints** are enforced by the spec itself:
  - FR-034: No admin visual changes (except FR-038/FR-039)
  - FR-035: No backend changes
  - SC-005: Zero test regressions
  - FR-031: WCAG 2.1 AA in both modes

### Post-Phase 1 Re-check

- **No data model violations**: Feature is UI-only; no schema, API, or state changes
- **No dependency violations**: Only `next/font/google` addition (Playfair Display) — no new runtime dependencies
- **No scope creep**: Admin exceptions (FR-038, FR-039) already implemented in Phase 2
- **Gate status**: PASS

## Project Structure

### Documentation (this feature)

```text
specs/001-cozy-shop-ui/
├── plan.md              # This file
├── research.md          # Phase 0 output — technology decisions
├── data-model.md        # Phase 1 output — design tokens, component entities
├── quickstart.md        # Phase 1 output — development workflow guide
├── contracts/
│   └── ui-contracts.md  # Phase 1 output — visual/component contracts
├── tasks.md             # Phase 2 output (NOT created by /speckit.plan)
└── checklists/          # Visual verification checklists
```

### Source Code (repository root)

```text
app/
├── globals.css              # ✅ Design tokens, utilities, animations (Phase 2 complete)
├── layout.tsx               # ✅ Font config, metadata (Phase 2 complete)
├── page.tsx                 # Homepage composition — T022, T046
├── error.tsx                # Global error boundary — T023
├── loading.tsx              # Global loading skeleton — T024
├── about/page.tsx           # Brand story redesign — T041, T042, T048
├── cart/page.tsx            # Cart styling — T040, T048
├── products/
│   ├── [id]/page.tsx        # Product detail — T035, T047
│   ├── [id]/loading.tsx     # Product detail skeleton — T038
│   ├── error.tsx            # Products error — T036
│   └── loading.tsx          # Products listing skeleton — T037
├── admin/                   # OUT OF SCOPE (FR-034)
└── api/                     # OUT OF SCOPE (FR-035)

components/
├── ui/
│   ├── DecorativeElements.tsx  # ✅ FloralCartIcon, Butterfly, Mushroom, FloralBorder (Phase 2)
│   ├── Card.tsx                # T008
│   ├── GradientButton.tsx      # T009
│   ├── GradientHeading.tsx     # T010
│   ├── Badge.tsx               # T011
│   ├── CtaButton.tsx           # T012
│   └── EmptyState.tsx          # T013
├── layout/
│   ├── Header.tsx              # T015–T017
│   ├── CartIcon.tsx            # T018
│   └── Footer.tsx              # T019
├── sections/
│   ├── Hero.tsx                # T020, T021
│   ├── ProductGrid.tsx         # T028–T030, T047
│   ├── QuickAddButton.tsx      # T031
│   └── StockBadge.tsx          # T032
├── cart/
│   └── CartItemRow.tsx         # T039
├── product/
│   ├── ProductStockBadge.tsx   # T033
│   └── VariationButton.tsx     # T034
├── skeletons/
│   ├── HeaderSkeleton.tsx      # T025
│   ├── HeroSkeleton.tsx        # T026
│   └── ProductCardSkeleton.tsx # T027
├── admin/                      # OUT OF SCOPE (FR-034, except FR-038 already done)
└── icons/                      # Static icon components

lib/
├── constants/categories.ts     # ✅ PRODUCT_CATEGORIES, CATEGORY_FILTERS (complete)
└── [everything else]           # OUT OF SCOPE (FR-035)

public/
├── warm-bg.jpeg                # Hero background illustration
├── normal-bg.jpeg              # Background texture
├── prototype1.jpeg             # Design reference 1
├── prototype2.jpeg             # Authoritative design prototype
└── cart.jpeg                   # Cart reference image
```

**Structure Decision**: Existing Next.js App Router structure is maintained. No new directories needed. All changes are modifications to existing files within `app/`, `components/`, and `app/globals.css`. The only new file created in Phase 2 was `lib/constants/categories.ts`.

## Complexity Tracking

No constitution violations to justify. The feature is a pure UI restyling within existing architecture — no new patterns, abstractions, or dependencies introduced.
