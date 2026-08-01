# Feature Specification Index

Specifications define expected behavior; [the implemented feature catalog](../docs/features.md) records the verified current product surface.

| Spec | Capability                    | Current implementation                                                                                     |
| ---- | ----------------------------- | ---------------------------------------------------------------------------------------------------------- |
| 001  | Cozy shop UI                  | Responsive warm theme, localization, accessibility, and PWA behavior shipped                               |
| 002  | Variation management          | Product options, generated combinations, variant media/price/stock, and reorder shipped                    |
| 003  | Order policy                  | Required acknowledgment integrated with queued checkout                                                    |
| 004  | Admin integration             | Responsive operational dashboards, bulk actions, and import/export shipped                                 |
| 005  | Account and personalization   | Wishlist, addresses, preferences, recent orders, and cart merge shipped; notifications remain future scope |
| 006  | Authentication/security       | Credentials/OAuth, verification, recovery, password history, and abuse controls shipped                    |
| 007  | Cart and checkout             | Signed guest cart, staged checkout, idempotency, and queue processing shipped                              |
| 008  | Catalog and search            | Facets, suggestions, analytics, fallback search, reviews, sharing, and AI assistant shipped                |
| 009  | Orders                        | Customer history plus admin lifecycle, search, export, and queue monitoring shipped                        |
| 010  | Wishlist                      | Authenticated persistence and storefront controls shipped                                                  |
| 011  | Current platform capabilities | Localization, PWA, AI, operations, and cross-feature acceptance baseline shipped                           |

## Next-phase specifications

Specifications 012-023 are proposed work, grouped into three epics. Each is drafted against the verified state of the working tree rather than against documentation, and each opens with a `Baseline (verified 2026-08-01)` section recording what was checked.

### Epic — Phase 1: Foundation

Framework capability the project pays for but does not use, plus the verification and documentation gaps that make every later change riskier than it needs to be.

| Spec | Capability                                   | Problem it addresses                                                                                    |
| ---- | -------------------------------------------- | ------------------------------------------------------------------------------------------------------- |
| 012  | Cache Components and PPR                     | 60 `force-dynamic` route segments, no `generateStaticParams`, zero use of `"use cache"` on Next.js 16.2 |
| 013  | E2E in continuous integration                | Playwright suites exist but never run in CI, so a permanently failing suite went unnoticed              |
| 014  | Documentation and instruction reconciliation | README, docs, and the constitution reference commands, files, and services that do not exist            |
| 015  | Build and DX modernization                   | React Compiler, typed routes, Turbopack filesystem cache, and package-import optimization all unadopted |

### Epic — Phase 2: Correctness and commerce depth

One real correctness defect, then the commerce capability whose absence is most visible to customers.

| Spec | Capability                   | Problem it addresses                                                                             |
| ---- | ---------------------------- | ------------------------------------------------------------------------------------------------ |
| 016  | Inventory reservation        | Stock is validated at checkout request but decremented later, leaving a measured oversell window |
| 017  | Personalized recommendations | Recommendations are static; browsing and purchase history are not used                           |
| 018  | Self-service returns         | Refunds are admin-only; customers have no return request path                                    |
| 019  | Stock and price alerts       | Out-of-stock demand and price sensitivity are entirely uncaptured                                |

### Epic — Phase 3: AI, interaction quality, and revenue levers

Differentiating capability, built on the foundation the earlier phases establish.

| Spec | Capability                            | Problem it addresses                                                                                   |
| ---- | ------------------------------------- | ------------------------------------------------------------------------------------------------------ |
| 020  | Storefront AI assistant               | The AI assistant is confined to a single product page and cannot help across the catalog or an order   |
| 021  | Interaction modernization             | View Transitions, `<Activity>`, and Server Actions are installed but unused; checkout loses step state |
| 022  | Loyalty, store credit, and gift cards | Every discount is coupon-shaped; customers cannot own, earn, or be refunded into a balance             |
| 023  | Payment methods expansion             | Single prepaid provider, and partial refunds are misreported as full refunds                           |

Implementation snapshots in each `spec.md` identify the current state without rewriting the original acceptance history. New behavior must update the owning specification, its tasks, documentation, and the closest Playwright suite.
