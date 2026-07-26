# Implemented Feature Catalog

**Verified against the application routes and services on 2026-07-12.** This catalog describes shipped behavior; feature specifications under `specs/` provide acceptance criteria and traceability.

## Storefront and discovery

- Responsive home, shop, product, marketing, help, shipping, returns, contact, blog, press, and careers pages.
- Product catalog with category, price, stock, rating, variant-count, and sort controls.
- Search suggestions, zero-result recovery, trending discovery, click analytics, and database fallback when hosted search is unavailable.
- Product details with image galleries, multidimensional option selection, variant-specific price/stock/media, reviews and voting, sharing links, recently viewed products, and bestsellers.
- AI product assistant for guests and authenticated customers. Guest identity is one-way hashed, history is persisted only for signed-in users, and exact stock counts are not disclosed.

## Cart, checkout, and orders

- Signed guest cart cookie, authenticated cart persistence, guest-to-account merge, stock-aware quantity controls, variant labels, and customization notes.
- Address capture and Indian pincode lookup, shipping pricing, order-policy acknowledgment, and recoverable validation/errors.
- Staged shipping, payment, review, and confirmation pages.
- Idempotent checkout requests persisted before Vercel Queue processing, with status polling and duplicate-order protection.
- Pluggable payment gateways behind a single `PaymentGateway` interface: Razorpay (online capture with signed verification and webhook reconciliation) and Cash on Delivery (order stays `PENDING` and settles to `PAID` when delivery is confirmed).
- Authenticated order history, hybrid order search, compact item summaries, detail/status tracking, and transactional emails.

## Identity and personalization

- Credentials login by email or phone, Google OAuth, and Microsoft personal-account OAuth through NextAuth v5 JWT sessions.
- Registration, email verification, forgot/reset/change password, password history, login abuse protection, and CUSTOMER/ADMIN authorization.
- Read-only account overview with explicit edit modes, reusable addresses, currency preferences, recent orders, and wishlist management.
- Notification preference centre covering transactional and marketing messaging across email, browser push, and SMS/WhatsApp channels.
- INR, USD, EUR, and GBP display with cached daily exchange rates.

## PWA and resilience

- Web app manifest, install prompt, icons, screenshots, shortcuts, service-worker registration, and localized offline fallback.
- Web push order-status notifications delivered through the PWA service worker, with per-device opt-in and automatic cleanup of expired or revoked subscriptions.
- Public ISR/server rendering, image placeholders, responsive images, skeletons, error boundaries, and mobile-safe layouts.
- Optional Redis caching with stampede prevention and stale-while-revalidate; core reads degrade to PostgreSQL when optional infrastructure is absent.

## Administration

- Responsive dashboards for products, variants/options, categories, orders, checkout requests, users, reviews, sales, failed email, and search indexes.
- Product option generation, variant reorder, category drag/reorder, soft deletion, image upload, and stock management.
- Bulk product/order actions, product CSV import, CSV exports for products/orders/users/reviews, and sales export.
- Order status/tracking controls, user role changes, review moderation, search reindexing, queue visibility, and audit logging.

## Platform operations

- PostgreSQL with Drizzle, short public IDs, transactions, primary/read-replica routing, migrations, and idempotent bootstrap support.
- Redis caching and order search, Upstash Search with SQL fallback, Vercel Blob, Vercel Queues, QStash email delivery, provider retries, and failed-email persistence.
- Pino request logging with correlation IDs, Sentry instrumentation, Prometheus metrics, synthetic health checks, scheduled exchange-rate refresh, and failed-email retry jobs.
- Zod request/environment validation, rate limiting, ownership checks, signed guest identifiers, secure webhook/worker verification, and cache invalidation after writes.

## Acceptance coverage

Unit and integration tests live under `__tests__/`. Playwright suites cover public and admin routes, accessibility, product options, cart/checkout policy and recovery, orders, AI stock privacy, responsive layouts, and the current platform smoke scenarios. Run the mandatory gates before release:

```bash
npm run lint
npx tsc --noEmit
npm test
npm run build
```
