# Feature Specification: Current Platform Capabilities

**Created**: 2026-07-12  
**Status**: Implemented  
**Input**: Keep documentation, specifications, and browser acceptance coverage aligned with the latest shipped application features.

> **Superseded in part — 2026-08-07.** Localization and locale-prefixed routing
> were removed from the product in PR #407. The original text below is preserved
> unchanged for traceability, because it explains why the localization
> assertions in `playwright-tests/latest-features.spec.ts` and the `/en/shop`
> probe in `playwright.config.ts` were written. Each affected clause carries an
> inline superseded note. There is no `src/app/[locale]` route segment and
> `src/proxy.ts` performs no locale rewriting; every browser route is unprefixed.
> Recorded by `014-documentation-and-instruction-reconciliation`.

## User Scenarios & Testing _(mandatory)_

### User Story 1 - Localized, installable storefront (Priority: P1)

> **Superseded 2026-08-07 (localization only).** The PWA and offline half of
> this story still ships. The localization half does not: there is no language
> switcher and no locale-prefixed routing. Scenarios 1, 2, and the "localized"
> qualifier in 4 no longer describe current behavior.

A customer can browse through English or Spanish locale-prefixed routes, retain language/currency preferences, install the storefront, and reach a useful offline fallback.

**Acceptance scenarios**

1. ~~`/` resolves to the default locale and supported internal links retain their locale prefix.~~ (Superseded 2026-08-07: routes are unprefixed.)
2. ~~Changing language navigates to the equivalent supported locale route.~~ (Superseded 2026-08-07: no language switcher exists.)
3. The web manifest exposes standalone display metadata, icons, screenshots, and Shop/Cart shortcuts.
4. The offline route offers retry and home actions. (Superseded 2026-08-07: it is no longer localized; `src/app/(public)/offline/` is a single unprefixed route.)

### User Story 2 - Resilient product discovery (Priority: P1)

A customer can search, filter, inspect variants, use suggestions and reviews, and ask product questions even when optional acceleration services are unavailable.

**Acceptance scenarios**

1. Search supports facets, sorting, suggestions, zero-result recovery, and click analytics.
2. Hosted search failure falls back to database behavior where supported.
3. Product option dimensions choose a valid variant with corresponding price, media, and availability.
4. Guest AI chat works without persisting history or exposing exact stock counts.

### User Story 3 - Durable commerce workflow (Priority: P1)

A customer can preserve a guest cart through sign-in, complete staged checkout, and receive one order despite retries.

**Acceptance scenarios**

1. Guest cart ownership uses a signed opaque session and merges after authentication.
2. Policy acknowledgment and valid shipping/contact data are required.
3. Shipping, payment, review, and confirmation stages preserve staged state across navigation. (Superseded 2026-08-07: the original wording said "remain locale-safe"; there are no locales.)
4. Repeated checkout submissions with one idempotency key do not create duplicate orders.
5. Queue processing exposes pending, processing, completed, and failed outcomes.

### User Story 4 - Complete account and admin operations (Priority: P2)

Customers manage profile, addresses, preferences, wishlist, and orders; administrators manage the full operational lifecycle.

**Acceptance scenarios**

1. Account data and addresses are owner-scoped, and role checks protect admin resources.
2. Admins can manage catalog structure, products/options/variants, orders, users, reviews, sales, failed emails, checkout requests, and search indexes.
3. Bulk actions and CSV import/export preserve authorization, validation, and audit behavior.
4. Responsive admin tables switch to usable mobile cards without viewport overflow.

### Edge Cases

- ~~Unsupported locales return not found rather than rendering mixed-locale content.~~ (Superseded 2026-08-07: no locale segment exists, so there is no unsupported-locale case.)
- Missing optional Redis, search, AI, queue, email, Blob, Sentry, or Edge Config settings disable only dependent behavior.
- Queue retries, webhook retries, and duplicate browser submits remain idempotent.
- Logs and metrics exclude passwords, tokens, payment secrets, raw guest addresses, and exact private inventory.

## Requirements _(mandatory)_

### Functional Requirements

- ~~**FR-001**: Browser routes MUST preserve a supported locale prefix; API routes MUST remain unprefixed.~~ (Superseded 2026-08-07: all routes, browser and API, are unprefixed.)
- **FR-002**: The platform MUST expose installable PWA metadata and an offline fallback. (Superseded 2026-08-07: the fallback is no longer localized.)
- **FR-003**: Search MUST provide resilient fallback behavior and accessible suggestion interactions.
- **FR-004**: Guest AI requests MUST use a one-way identity and MUST NOT persist conversation history.
- **FR-005**: AI responses MUST NOT disclose exact stock counts.
- **FR-006**: Checkout MUST validate stock, ownership, policy acceptance, and idempotency before order creation.
- **FR-007**: Async checkout state MUST be observable by customers and administrators.
- **FR-008**: Customer and admin mutations MUST enforce session, ownership, role, Zod validation, and cache invalidation as applicable.
- **FR-009**: Optional infrastructure failures MUST preserve core database-backed storefront behavior where a fallback exists.
- **FR-010**: Current feature documentation and browser acceptance tests MUST be updated with shipped behavior.

## Success Criteria _(mandatory)_

- **SC-001**: Public, accessibility, PWA, and responsive smoke checks pass in Playwright. (Superseded 2026-08-07: the locale checks were removed from scope with the feature; the assertions still present in `playwright-tests/latest-features.spec.ts` are known-stale and unowned.)
- **SC-002**: Cart, checkout, product options, AI privacy, and order-flow browser checks pass.
- **SC-003**: Admin route, responsive layout, and operational navigation checks pass.
- **SC-004**: Lint, TypeScript, unit tests, and production build pass before release.
