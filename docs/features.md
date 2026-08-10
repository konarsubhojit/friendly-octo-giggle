# Implemented Feature Catalog

**Verified against the application routes and services on 2026-08-07.** This catalog describes shipped behavior; feature specifications under `specs/` provide acceptance criteria and traceability. Where this catalog and the code disagree, the code is authoritative.

## Storefront and discovery

- Responsive home, shop, product, marketing, help, shipping, returns, contact, blog, press, and careers pages.
- Product catalog with category, price, stock, rating, variant-count, and sort controls.
- Search suggestions, zero-result recovery, trending discovery, click analytics, and database fallback when hosted search is unavailable.
- Product details with image galleries, multidimensional option selection, variant-specific price/stock/media, reviews and voting, sharing links, recently viewed products, and bestsellers.
- Personalized recommendation rails on the product page, the cart, the `/shop` landing page, and the zero-result search state. Affinity scores are recomputed nightly at 04:00 UTC from three server-side signals over a rolling 180-day window: order co-purchase (weight 1.0), wishlist co-occurrence (0.5), and share co-occurrence (0.25). Associations backed by fewer than three distinct orders or shoppers are discarded during aggregation, which suppresses both statistical noise and any inference of an individual basket. On a representative volume of 2 000 products and 5 000 orders the full scoring run completes in about 6.4 seconds and produces roughly 3 700 associations. Every surface falls back to category-scoped bestsellers when scores are absent, fully filtered out, or Redis is unavailable, so a rail is never empty and a cache outage never breaks a page. Recommendation responses expose an availability boolean only — never an inventory or sales count. Recently viewed products act as client-supplied anchor seeds at selection time and are never persisted server-side, so a guest leaves no profile behind.
- AI product assistant for guests and authenticated customers. Guest identity is one-way hashed, history is persisted only for signed-in users, and exact stock counts are not disclosed.

## Cart, checkout, and orders

- Signed guest cart cookie, authenticated cart persistence, guest-to-account merge, stock-aware quantity controls, variant labels, and customization notes.
- Address capture and Indian pincode lookup, shipping pricing, order-policy acknowledgment, and recoverable validation/errors.
- Staged shipping, payment, review, and confirmation pages.
- Idempotent checkout requests persisted before Inngest processing, with a pushed completion status (Realtime → SSE) and duplicate-order protection.
- Inventory reservations taken atomically at checkout acceptance, consumed with the order, released on failure, and expired by a thirty-minute sweep, so queued requests cannot oversell the shelf.
- Pluggable payment gateways behind a single `PaymentGateway` interface: Razorpay (online capture with signed verification and webhook reconciliation) and Cash on Delivery (order stays `PENDING` and settles to `PAID` when delivery is confirmed).
- Authenticated order history, hybrid order search, compact item summaries, detail/status tracking, and transactional emails.
- Self-service damaged-item returns: a customer opens a claim from the delivered order within the per-category window, attaches photos in product, and tracks the claim through approval, receipt, and refund without contacting support. A short video, when asked for, is sent over Instagram DM quoting the return ID — the handle is never stored against the account. Approved receipts restock the originating variant exactly once; the refund is a separate, separately permissioned action so a gateway rejection can be retried without re-restocking. Cash on Delivery never reaches the gateway: the obligation is recorded as a pending manual settlement an operator confirms by hand.

## Identity and personalization

- Credentials login by email or phone, Google OAuth, and Microsoft personal-account OAuth through NextAuth v5 JWT sessions.
- Registration, email verification, forgot/reset/change password, password history, login abuse protection, and CUSTOMER/ADMIN authorization.
- Read-only account overview with explicit edit modes, reusable addresses, currency preferences, recent orders, and wishlist management.
- Notification preference centre covering transactional and marketing messaging across email, browser push, and SMS/WhatsApp channels.
- INR, USD, EUR, and GBP display with cached daily exchange rates.

## PWA and resilience

- Web app manifest, install prompt, icons, screenshots, shortcuts, service-worker registration, and an offline fallback route.
- Web push order-status notifications delivered through the PWA service worker, with per-device opt-in and automatic cleanup of expired or revoked subscriptions.
- Public pages served via Cache Components (prerendered shell with streamed per-request holes), image placeholders, responsive images, skeletons, error boundaries, and mobile-safe layouts.
- Optional Redis caching with stampede prevention and stale-while-revalidate; core reads degrade to PostgreSQL when optional infrastructure is absent.

## Administration

- Responsive dashboards for products, variants/options, categories, orders, checkout requests, users, reviews, sales, failed email, search indexes, and recommendation scores.
- Recommendation status screen reporting the last score refresh, pair and anchor counts, and the active window and minimum-support thresholds, with a manual recompute that publishes the same event the nightly cron fires.
- Product option generation, variant reorder, category drag/reorder, soft deletion, image upload, and stock management.
- Bulk product/order actions, product CSV import, CSV exports for products/orders/users/reviews, and sales export.
- Order status/tracking controls, user role changes, review moderation, search reindexing, queue visibility, and audit logging.
- Returns triage queue gated on `orders:returns`, with order context, evidence thumbnails, a mandatory decision reason recorded on every approval and rejection, a CSV export, and an audit row per decision. Actions that move money require `orders:refund` instead.
- Reservation visibility on checkout requests and variants (on-hand/reserved/available), audited manual release of a stuck hold, and rejection of stock edits below reserved quantity.

## Platform operations

- PostgreSQL with Drizzle, short public IDs, transactions, primary/read-replica routing, migrations, and idempotent bootstrap support.
- Redis caching and order search, Upstash Search with SQL fallback, Vercel Blob, Inngest durable workflows, async email delivery, provider retries, and failed-email persistence.
- Pino request logging with correlation IDs, Sentry instrumentation, Prometheus metrics, a `GET /api/health` liveness endpoint, scheduled exchange-rate refresh, product-affinity scoring, and failed-email retry jobs.
- Zod request/environment validation, rate limiting, ownership checks, signed guest identifiers, secure webhook/worker verification, and cache invalidation after writes.

## Acceptance coverage

Unit and integration tests live under `__tests__/`. Playwright suites cover public and admin routes, accessibility, product options, cart/checkout policy and recovery, orders, AI stock privacy, responsive layouts, and the current platform smoke scenarios. Run the mandatory gates before release:

```bash
npm run lint
npx tsc --noEmit -p tsconfig.check.json
npm test
npm run build
npm run docs:check
```

Playwright is not currently runnable end to end: `playwright.config.ts` probes a
`/en/shop` URL removed with localization in PR #407, and
`playwright-tests/latest-features.spec.ts` still asserts Spanish routing.
Repairing the suite is unowned; see `specs/README.md`.
