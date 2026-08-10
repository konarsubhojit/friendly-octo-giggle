# Feature Specification Index

Specifications define expected behavior; [the implemented feature catalog](../docs/features.md) records the verified current product surface.

| Spec | Capability                    | Current implementation                                                                                                      |
| ---- | ----------------------------- | --------------------------------------------------------------------------------------------------------------------------- |
| 001  | Cozy shop UI                  | Responsive warm theme, accessibility, and PWA behavior shipped; localization was removed in PR #407                         |
| 002  | Variation management          | Product options, generated combinations, variant media/price/stock, and reorder shipped                                     |
| 003  | Order policy                  | Required acknowledgment integrated with queued checkout                                                                     |
| 004  | Admin integration             | Responsive operational dashboards, bulk actions, and import/export shipped                                                  |
| 005  | Account and personalization   | Wishlist, addresses, preferences, recent orders, and cart merge shipped; notifications remain future scope                  |
| 006  | Authentication/security       | Credentials/OAuth, verification, recovery, password history, and abuse controls shipped                                     |
| 007  | Cart and checkout             | Signed guest cart, staged checkout, idempotency, and queue processing shipped                                               |
| 008  | Catalog and search            | Facets, suggestions, analytics, fallback search, reviews, sharing, and product-page AI assistant shipped                    |
| 009  | Orders                        | Customer history plus admin lifecycle, search, export, and queue monitoring shipped                                         |
| 010  | Wishlist                      | Authenticated persistence and storefront controls shipped                                                                   |
| 011  | Current platform capabilities | PWA, AI, operations, and cross-feature acceptance baseline shipped; the localization clauses are marked superseded in place |

## Next-phase specifications

Specifications 012, 014-023 are proposed work, grouped into three epics. Each is drafted against the verified state of the working tree rather than against documentation, and each opens with a `Baseline (verified 2026-08-01)` section recording what was checked.

### Epic — Phase 1: Foundation — rendering model and stack modernization

Framework capability the project pays for but does not use, plus the documentation gaps that make every later change riskier than it needs to be.

| Spec | Capability                                   | Problem it addresses                                                                                                                                                                                                                                                                              |
| ---- | -------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 012  | Cache Components and PPR                     | 60 `force-dynamic` route segments, no `generateStaticParams`, zero use of `"use cache"` on Next.js 16.2                                                                                                                                                                                           |
| 014  | Documentation and instruction reconciliation | README, docs, and the constitution reference commands, files, and services that do not exist                                                                                                                                                                                                      |
| 015  | Build and DX modernization                   | React Compiler, typed routes, Turbopack filesystem cache, and package-import optimization all unadopted — **implemented**; typed routes and the React Compiler are on, the Turbopack cache was already on by default, and package-import optimization measured as a null result and was not added |

Specification 013, "E2E in continuous integration", was withdrawn on 2026-08-07 and its directory removed. Running the Playwright suite in CI and repairing its drifted assertions is currently unowned; any specification that needs browser-level verification must arrange it itself.

**Known-stale Playwright assertions (unowned).** Localization was removed from the product in PR #407, but the test tree was never repaired. `playwright-tests/latest-features.spec.ts` still asserts Spanish locale routing and `playwright.config.ts` still probes a `/en/shop` URL that no longer exists in the route tree. Specification 014 recorded this drift in the documentation and specification surfaces but did not touch test code; specification 012's task T045 is blocked on the same repair. Whoever next needs the Playwright suite owns fixing it.

## Status

Every specification directory carries a `spec.md`. Directories 001-012 and 014-016 additionally carry a `plan.md` and a `tasks.md`; 017-023 are specifications only, awaiting planning.

| Spec    | Directory                                          | Artifacts         | Status                                                        |
| ------- | -------------------------------------------------- | ----------------- | ------------------------------------------------------------- |
| 001     | `001-cozy-shop-ui`                                 | spec, plan, tasks | Implemented                                                   |
| 002     | `002-admin-variation-management`                   | spec, plan, tasks | Implemented                                                   |
| 003     | `003-order-policy-dialog`                          | spec, plan, tasks | Implemented                                                   |
| 004     | `004-zenput-admin-integration`                     | spec, plan, tasks | Implemented                                                   |
| 005     | `005-enhanced-account-personalization`             | spec, plan, tasks | Implemented; notifications remain future scope                |
| 006     | `006-authentication-and-account-security`          | spec, plan, tasks | Implemented                                                   |
| 007     | `007-shopping-cart-and-checkout`                   | spec, plan, tasks | Implemented                                                   |
| 008     | `008-product-catalog-and-search`                   | spec, plan, tasks | Implemented                                                   |
| 009     | `009-order-management`                             | spec, plan, tasks | Implemented                                                   |
| 010     | `010-wishlist`                                     | spec, plan, tasks | Implemented                                                   |
| 011     | `011-current-platform-capabilities`                | spec, plan, tasks | Implemented; localization clauses superseded 2026-08-07       |
| 012     | `012-cache-components-and-ppr`                     | spec, plan, tasks | Implemented; T045 deferred on the unrepaired Playwright suite |
| ~~013~~ | —                                                  | —                 | Withdrawn 2026-08-07; directory removed                       |
| 014     | `014-documentation-and-instruction-reconciliation` | spec, plan, tasks | In progress                                                   |
| 015     | `015-build-and-dx-modernization`                   | spec, plan, tasks | Implemented; T022 and T038 deferred (see below)               |
| 016     | `016-inventory-reservation`                        | spec, plan, tasks | Implemented                                                   |
| 017     | `017-personalized-recommendations`                 | spec              | Proposed; not planned                                         |
| 018     | `018-self-service-returns`                         | spec              | Proposed; not planned                                         |
| 019     | `019-stock-and-price-alerts`                       | spec              | Proposed; not planned                                         |
| 020     | `020-storefront-ai-assistant`                      | spec              | Proposed; not planned                                         |
| 021     | `021-interaction-modernization`                    | spec              | Proposed; not planned                                         |
| 022     | `022-loyalty-and-store-credit`                     | spec              | Proposed; not planned                                         |
| 023     | `023-payment-methods-expansion`                    | spec              | Proposed; not planned                                         |

**015 deferred tasks.** T022 (run the Playwright suite against a production build with the compiler on) is blocked on the unowned, drifted Playwright suite described above. T038 (record the CI build-job duration on both sides of the cache-key change) cannot be read until the new key has been saved and restored at least once, which requires two build runs on the branch.

### Epic — Phase 2: Correctness and commerce depth

One real correctness defect, then the commerce capability whose absence is most visible to customers.

| Spec | Capability                   | Problem it addresses                                                                                                                                                                                                     |
| ---- | ---------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| 016  | Inventory reservation        | Stock is validated at checkout request but decremented later, leaving a measured oversell window — **implemented**; holds are taken at request acceptance, consumed with the order, and expired by a thirty-minute sweep |
| 017  | Personalized recommendations | Recommendations are static; browsing and purchase history are not used                                                                                                                                                   |
| 018  | Self-service returns         | Refunds are admin-only; customers have no return request path                                                                                                                                                            |
| 019  | Stock and price alerts       | Out-of-stock demand and price sensitivity are entirely uncaptured                                                                                                                                                        |

### Epic — Phase 3: AI, interaction quality, and revenue levers

Differentiating capability, built on the foundation the earlier phases establish.

| Spec | Capability                            | Problem it addresses                                                                                   |
| ---- | ------------------------------------- | ------------------------------------------------------------------------------------------------------ |
| 020  | Storefront AI assistant               | The AI assistant is confined to a single product page and cannot help across the catalog or an order   |
| 021  | Interaction modernization             | View Transitions, `<Activity>`, and Server Actions are installed but unused; checkout loses step state |
| 022  | Loyalty, store credit, and gift cards | Every discount is coupon-shaped; customers cannot own, earn, or be refunded into a balance             |
| 023  | Payment methods expansion             | Single prepaid provider, and partial refunds are misreported as full refunds                           |

Implementation snapshots in each `spec.md` identify the current state without rewriting the original acceptance history. New behavior must update the owning specification, its tasks, documentation, and the closest Playwright suite.
