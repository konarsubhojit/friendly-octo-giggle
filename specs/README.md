# Feature Specification Index

Specifications define expected behavior; [the implemented feature catalog](../docs/features.md) records the verified current product surface.

| Spec | Capability | Current implementation |
| --- | --- | --- |
| 001 | Cozy shop UI | Responsive warm theme, localization, accessibility, and PWA behavior shipped |
| 002 | Variation management | Product options, generated combinations, variant media/price/stock, and reorder shipped |
| 003 | Order policy | Required acknowledgment integrated with queued checkout |
| 004 | Admin integration | Responsive operational dashboards, bulk actions, and import/export shipped |
| 005 | Account and personalization | Wishlist, addresses, preferences, recent orders, and cart merge shipped; notifications remain future scope |
| 006 | Authentication/security | Credentials/OAuth, verification, recovery, password history, and abuse controls shipped |
| 007 | Cart and checkout | Signed guest cart, staged checkout, idempotency, and queue processing shipped |
| 008 | Catalog and search | Facets, suggestions, analytics, fallback search, reviews, sharing, and AI assistant shipped |
| 009 | Orders | Customer history plus admin lifecycle, search, export, and queue monitoring shipped |
| 010 | Wishlist | Authenticated persistence and storefront controls shipped |
| 011 | Current platform capabilities | Localization, PWA, AI, operations, and cross-feature acceptance baseline shipped |

Implementation snapshots in each `spec.md` identify the current state without rewriting the original acceptance history. New behavior must update the owning specification, its tasks, documentation, and the closest Playwright suite.
