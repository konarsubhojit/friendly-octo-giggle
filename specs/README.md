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

Specifications 012, 014-024 are proposed work, grouped into three epics. Each is drafted against the verified state of the working tree rather than against documentation, and each opens with a `Baseline (verified …)` section recording what was checked. **Specifications 019-024 were re-verified against the tree on 2026-08-10**, after 016, 017, and 018 shipped; each now carries a `Last reviewed` date alongside its baseline.

### Epic — Phase 1: Foundation — rendering model and stack modernization

Framework capability the project pays for but does not use, plus the documentation gaps that make every later change riskier than it needs to be.

| Spec | Capability                                    | Problem it addresses                                                                                                                                                                                                                                                                              |
| ---- | --------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 012  | Cache Components and PPR                      | 60 `force-dynamic` route segments, no `generateStaticParams`, zero use of `"use cache"` on Next.js 16.2                                                                                                                                                                                           |
| 014  | Documentation and instruction reconciliation  | README, docs, and the constitution reference commands, files, and services that do not exist                                                                                                                                                                                                      |
| 015  | Build and DX modernization                    | React Compiler, typed routes, Turbopack filesystem cache, and package-import optimization all unadopted — **implemented**; typed routes and the React Compiler are on, the Turbopack cache was already on by default, and package-import optimization measured as a null result and was not added |
| 025  | Provider-neutral image storage (R2 migration) | Azure Blob Storage was a second, unexercised upload provider requiring its own SDK — **implemented**; replaced with Cloudflare R2 behind the same `StorageAdapter` interface as Vercel Blob, with dual-read fallback, a resumable migration script, and an edge-resizing Cloudflare Worker        |

Specification 013, "E2E in continuous integration", was withdrawn on 2026-08-07 and its directory removed. Running the Playwright suite in CI and repairing its drifted assertions is currently unowned; any specification that needs browser-level verification must arrange it itself.

**Known-stale Playwright assertions (unowned).** Localization was removed from the product in PR #407, but the test tree was never repaired. `playwright-tests/latest-features.spec.ts` still asserts Spanish locale routing and `playwright.config.ts` still probes a `/en/shop` URL that no longer exists in the route tree. Specification 014 recorded this drift in the documentation and specification surfaces but did not touch test code; specification 012's task T045 is blocked on the same repair. Whoever next needs the Playwright suite owns fixing it.

## Status

Every specification directory carries a `spec.md`. Directories 001-012 and 014-018 additionally carry a `plan.md` and a `tasks.md`; 019-024 are specifications only, awaiting planning.

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
| 017     | `017-personalized-recommendations`                 | spec, plan, tasks | Implemented                                                   |
| 018     | `018-self-service-returns`                         | spec, plan, tasks | Implemented                                                   |
| 019     | `019-stock-and-price-alerts`                       | spec              | Proposed; baseline re-verified 2026-08-10; ready to plan      |
| 020     | `020-storefront-ai-assistant`                      | spec              | Proposed; baseline re-verified 2026-08-10; ready to plan      |
| 021     | `021-interaction-modernization`                    | spec              | Proposed; baseline re-verified 2026-08-10; ready to plan      |
| 022     | `022-loyalty-and-store-credit`                     | spec              | Proposed; baseline re-verified 2026-08-10; ready to plan      |
| 023     | `023-payment-methods-expansion`                    | spec              | Proposed; scope revised 2026-08-10; ready to plan             |
| 024     | `024-admin-console-revamp`                         | spec, checklists  | Proposed; baseline added 2026-08-10; ready to plan            |
| 025     | `025-provider-neutral-image-storage`               | spec              | Implemented                                                   |

### Review of 2026-08-10 — what changed in the proposed specifications

016, 017, and 018 shipped, which invalidated parts of every downstream baseline. The specifications were re-verified against the working tree and corrected in place:

- **019** — every dependency it named has now shipped. `availableUnits` in `src/lib/stock-availability.ts` is now the required availability definition rather than a conditional one, and approved returns are a second restock origin dispatch must observe. The feature itself is still entirely absent.
- **020** — two original premises were wrong. The assistant is already order-aware (`fetchOrderStatusContext`) and already assembles comparison, recommendation, and review context. What it lacks is a non-product-anchored entry point, model-directed retrieval, and a cache key that is not product-scoped. Quotas, streaming, history, and the privacy guardrails are all already in place.
- **021** — `015` shipped, so the React Compiler is now part of the baseline and no longer confounds an INP measurement; the sequencing dependency is discharged. The "checkout discards all state" claim was corrected: `PendingCheckoutSchema` persists a fixed field list to `sessionStorage`, and everything outside that list is what is lost.
- **022** — the refund surface it plugs into is stronger than assumed: partial refunds, a refundable-balance calculation, and `PARTIALLY_REFUNDED` all exist, so store credit is an alternative settlement instrument rather than a refund-arithmetic fix. A new requirement keeps balance redemption out of `Order.discountAmount`.
- **023** — **scope materially revised.** The partial-refund defect the specification opened with has been fixed; User Story 1 is demoted to a regression guarantee. The real gap found in its place is that the checkout payment step renders a static "coming soon" placeholder and never asks the shopper to choose a provider, so a fully working Razorpay gateway is unreachable. A new P1 User Story 5 covers payment-method selection and now leads the specification.
- **024** — a verified baseline was added. Its "every list screen is bespoke" framing was corrected: `AdminDataView` is a real shared list surface, but only four of the fifteen screens use it, so the FR-A work is extension plus adoption rather than invention. The returns, checkout-requests, and recommendations screens shipped since drafting and were added as conversion candidates. `AdminAuditLog` was confirmed to have no reader anywhere in the tree.

### Sequencing guidance

The next-phase specifications are deliberately loosely coupled; none of 019-024 blocks another. Two ordering preferences are worth respecting:

- **024 before the admin-facing slices of 019, 022, and 023.** Each of those adds an admin screen. Built before 024, they add another bespoke screen that 024 then has to convert; built after, they land on the unified surface and on a readable audit trail for free.
- **023's payment-method selection before its remaining stories.** A second provider and additional methods are unreachable by a shopper until the checkout offers a choice at all.

Everything else can be taken in any order. In particular, **020 and 024 have no dependency on 019, 021, 022, or 023** and can be taken next as a pair — they touch disjoint parts of the tree (storefront AI services and API surface versus the admin presentation layer).

Both, however, need browser-level verification, and the Playwright suite is unowned and drifted (see below). 024's accessibility and keyboard requirements (FR-H01 through FR-H07) cannot be honestly verified without it, so whichever of the two is taken first should expect to absorb that repair.

**015 deferred tasks.** T022 (run the Playwright suite against a production build with the compiler on) is blocked on the unowned, drifted Playwright suite described above. T038 (record the CI build-job duration on both sides of the cache-key change) cannot be read until the new key has been saved and restored at least once, which requires two build runs on the branch.

### Epic — Phase 2: Correctness and commerce depth

One real correctness defect, then the commerce capability whose absence is most visible to customers.

| Spec | Capability                   | Problem it addresses                                                                                                                                                                                                     |
| ---- | ---------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| 016  | Inventory reservation        | Stock is validated at checkout request but decremented later, leaving a measured oversell window — **implemented**; holds are taken at request acceptance, consumed with the order, and expired by a thirty-minute sweep |
| 017  | Personalized recommendations | Recommendations are static; browsing and purchase history are not used — **implemented**; `ProductAffinityScore` is computed by an Inngest job and served through personalized rails                                     |
| 018  | Self-service returns         | Refunds are admin-only; customers have no return request path — **implemented**; return requests, evidence, a state machine, and admin triage all shipped                                                                |
| 019  | Stock and price alerts       | Out-of-stock demand and price sensitivity are entirely uncaptured                                                                                                                                                        |

### Epic — Phase 3: AI, interaction quality, and revenue levers

Differentiating capability, built on the foundation the earlier phases establish.

| Spec | Capability                            | Problem it addresses                                                                                                                                        |
| ---- | ------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 020  | Storefront AI assistant               | The assistant is reachable only from a product page, and its retrieval is keyword-triggered rather than model-directed, so open-ended discovery is unserved |
| 021  | Interaction modernization             | View Transitions, `<Activity>`, and Server Actions are installed but unused; checkout preserves only a fixed field list of step state                       |
| 022  | Loyalty, store credit, and gift cards | Every discount is coupon-shaped; customers cannot own, earn, or be refunded into a balance                                                                  |
| 023  | Payment methods expansion             | Checkout offers no payment-method selection at all, and there is a single prepaid provider behind it                                                        |
| 024  | Admin console revamp                  | Fifteen admin screens, one shared list surface used by four of them, three create/edit patterns, and an audit log with no reader                            |

Implementation snapshots in each `spec.md` identify the current state without rewriting the original acceptance history. New behavior must update the owning specification, its tasks, documentation, and the closest Playwright suite.
