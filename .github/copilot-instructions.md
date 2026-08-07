# GitHub Copilot Instructions for E-commerce Project

## DEFAULT AGENT: Software Engineer Agent (MANDATORY)

**The [Software Engineer Agent](./agents/swe.agent.md) is the default operating mode for this repository.** Apply it to every non-trivial request, whether or not the user explicitly selected it in the agent picker, and regardless of which GitHub/Copilot agent session started the work.

**On every session start:**

1. Read [`.github/agents/swe.agent.md`](./agents/swe.agent.md) and adopt its principles, constraints, and command loop as your operating contract.
2. State once, up front: `Operating under the Software Engineer Agent contract (.github/agents/swe.agent.md).`
3. If the user selected a different custom agent (e.g. a speckit agent), that agent's workflow takes precedence for its specific phase — but the SWE agent's quality gates and final review/remediation gate still apply before any commit.

**Non-negotiable inherited behaviors** — these apply even when the agent file is not loaded:

- **Autonomous execution** — never ask "shall I proceed?"; announce the action and execute it. Stop only for a hard blocker via the Escalation Protocol.
- **Pre-PR validation** — `npm run lint`, `npx tsc --noEmit -p tsconfig.check.json`, `npm test`, `npm run build`, and `npm run docs:check` must all pass before any commit or PR. `npm run build` is mandatory; it is the only gate that catches Next.js route-type and prerender/manifest errors.
- **Mandatory final gate** — before the final commit, run the [`branch-diff-review`](./skills/branch-diff-review/SKILL.md) skill, then **always** run [`branch-diff-remediate`](./skills/branch-diff-remediate/SKILL.md). Loop the pair until the verdict is `READY TO COMMIT` with an empty remediation queue. `BLOCKER`, `CRITICAL`, and `MAJOR` findings all block the commit.
- **SonarQube analysis** — run `sonarqube_analyze_file` on every file you create or modify, plus `sonarqube_list_potential_security_issues` on auth, API, upload, and DB code.
- **Documented decisions** — record the rationale for every significant design or trade-off decision.

**When to deviate:** only for trivial, read-only requests (a one-line question, a file lookup, an explanation). Anything that writes code, changes schema, or touches configuration runs the full contract.

## Project Overview

This is a highly scalable e-commerce website built with Next.js 16, TypeScript, PostgreSQL, Redis, and NextAuth for authentication. It's designed to run as serverless on-demand functions.

**This file is the single architecture description for agent consumption.** No
other file in the repository restates the stack or the directory layout;
`.github/copilot/instructions.md` defers here. When this file and the working
tree disagree, **the code is authoritative** — correct this file rather than the
code, and `npm run docs:check` guards the mechanically checkable claims.

## Technology Stack

Versions below are the ranges declared in `package.json`. When they and
`package.json` disagree, `package.json` is authoritative.

- **Framework**: Next.js 16.3 with App Router, Cache Components enabled (TypeScript 6.0)
- **React**: 19.2
- **Database**: PostgreSQL (Neon Serverless) with Drizzle ORM 0.45 (`src/lib/db.ts`)
- **State Management**: Redux Toolkit 2.12; slices live in their owning feature module under `src/features/*/store/`
- **Currency**: `CurrencyContext` with INR as the stored base currency, `useCurrency()` hook (`src/lib/currency.ts`)
- **Theme**: `ThemeContext` with default/baby-pink themes, `useTheme()` hook
- **Cache**: Upstash Redis 1.38 (HTTP-based) with stampede prevention (`src/lib/redis.ts`), plus Next.js Cache Components tags (`src/lib/cache-tags.ts`)
- **Search**: Upstash Search 0.1 with SQL fallback (`src/lib/search/`)
- **Authentication**: NextAuth.js v5 (5.0.0-beta.32) with Google OAuth + email/password + phone/password, DrizzleAdapter, **JWT sessions** (`src/lib/auth.config.ts`)
- **Password**: bcryptjs 3.0 with password history tracking (`src/features/auth/services/password.ts`)
- **Background jobs**: Inngest 4.13 durable functions (`src/lib/inngest/`), registered in `src/lib/inngest/registry.ts` and served by `/api/inngest`
- **Email**: Nodemailer 9.0, modular email system (`src/lib/email/` — providers, templates, retry, failed-emails)
- **Payments**: provider registry in `src/lib/payments/` (Razorpay and cash-on-delivery)
- **Styling**: Tailwind CSS v4.3
- **Validation**: Zod 4.4 for runtime type checking (`src/lib/validations/`)
- **IDs**: Base62 short IDs (7-char alphanumeric) via `src/lib/short-id.ts` for products, orders, carts, and related entities. Uses `varchar(7)` in DB schema.
- **Logging**: Pino 10 (structured JSON in production, pretty-print in dev) (`src/lib/logger.ts`)
- **Error monitoring**: Sentry 10 (`sentry.*.config.ts`, `src/instrumentation.ts`)
- **Testing**: Vitest 4.1 with jsdom + React Testing Library 16.3 + @testing-library/jest-dom
- **E2E Testing**: Playwright 1.62 with axe-core accessibility testing
- **Image Storage**: Vercel Blob 2.5 or Azure Blob Storage 12.33, selected in `src/lib/image-storage.ts`
- **Edge Config**: Vercel Edge Config 1.4 for feature flags and shipping config (`src/lib/edge-config.ts`)
- **Analytics**: Vercel Analytics
- **API Client**: `src/lib/api-client.ts` — typed HTTP abstraction for Redux thunks (DIP pattern)

## Code Style Guidelines

### TypeScript

- Use strict TypeScript everywhere
- Prefer type inference over explicit types when obvious
- Use Zod schemas for runtime validation
- Define types in `src/lib/types.ts` or under `src/lib/validations/`
- Use modern TypeScript features (satisfies, const assertions, template literals)

```typescript
// Good
const config = {
  timeout: 5000,
  retries: 3,
} as const satisfies ConfigType

// Use Zod for validation
const schema = z.object({ name: z.string() })
type Input = z.infer<typeof schema>
```

### React & Next.js

- Use Server Components by default
- Add 'use client' only when necessary (hooks, browser APIs, interactivity)
- Use Server Actions for mutations
- Implement proper error boundaries
- Use Suspense for loading states

```typescript
// Server Component (default)
export default async function Page() {
  const data = await fetchData();
  return <div>{data}</div>;
}

// Client Component (when needed)
'use client';
export function InteractiveButton() {
  const [count, setCount] = useState(0);
  return <button onClick={() => setCount(count + 1)}>{count}</button>;
}
```

### API Routes

- Use `src/lib/api-utils.ts` helpers for responses
- Always validate input with Zod schemas
- Use proper HTTP status codes
- Handle errors with `handleApiError`
- Return type-safe responses with `apiSuccess`/`apiError`

```typescript
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const validated = MySchema.parse(body)
    const result = await processData(validated)
    return apiSuccess({ result })
  } catch (error) {
    return handleApiError(error)
  }
}
```

### Database (Drizzle ORM)

- Always use Drizzle client from `src/lib/db.ts`
- `src/lib/db.ts` exposes three clients:
  - `drizzleDb` — read-replica composite (default for Server Components and public reads)
  - `primaryDrizzleDb` — primary/writer (use for auth, account, cart mutations, order status, admin writes, any read-after-write flow)
  - `readDrizzleDb` — replica reader (rarely imported directly; `drizzleDb` routes reads here automatically)
- For consistency-sensitive route handlers, import as: `import { primaryDrizzleDb as drizzleDb } from "@/lib/db";`
- `READ_DATABASE_URL` env var is optional; falls back to `DATABASE_URL`
- Use transactions for multi-step operations
- Include relations when needed with `with`
- Use proper indexing in schema
- Convert DateTime to ISO string for API responses

```typescript
const result = await drizzleDb.query.products.findMany({
  where: gt(schema.products.stock, 0),
  with: { variations: true },
})
```

#### Database Migrations

- Use Drizzle Kit for all database schema changes
- Never modify the database without creating a migration
- Always create descriptive migration names
- Test migrations in development before deploying

**Creating a Migration:**

```bash
# After modifying lib/schema.ts, generate a migration
npm run db:generate

# This will:
# 1. Generate SQL migration files in drizzle/
# 2. Review the generated SQL before applying
# 3. Apply the migration: npm run db:migrate
```

**Migration Workflow:**

1. Modify `src/lib/schema.ts` with your changes
2. Run `npm run db:generate` to generate the migration
3. Review the generated SQL in `drizzle/` directory
4. Run `npm run db:migrate` to apply to development
5. Test the migration in development
6. Commit both schema.ts and migration files
7. In production, run `npm run db:migrate`

**Important Notes:**

- Migrations are applied in order based on timestamp
- Never edit existing migration files after they've been applied
- Use normalized relational tables with proper foreign keys
- Add indexes for frequently queried fields
- Use `@@index` for single fields, `@@unique` for constraints

### Caching Strategy

- Use `getCachedData` from `src/lib/redis.ts` for read-heavy endpoints
- Set appropriate TTL (60s for products)
- Invalidate cache on writes with `invalidateCache`
- Use stale-while-revalidate pattern
- Always implement stampede prevention

```typescript
const data = await getCachedData(
  'cache:key',
  60, // TTL in seconds
  async () => await fetchFromDB(),
  10 // Stale time
)
```

### Authentication

- Use `auth()` from `src/lib/auth.ts` to get the session in Server Components
- Sessions are **JWT**, not database-backed (`session.strategy: 'jwt'` in
  `src/lib/auth.config.ts`). `src/proxy.ts` gates admin routes by reading the
  JWT with `getToken` from `next-auth/jwt`, which keeps the Drizzle adapter out
  of the edge bundle.
- Supports Google OAuth + email/password + phone/password credentials
- Admin **API routes** MUST use `checkAdminAuth` from
  `src/features/admin/services/admin-auth.ts`; admin **pages** MUST use
  `requireAdminPermission` from
  `src/features/admin/services/admin-page-auth.ts`. Inline auth checks in
  individual route files are prohibited.
- Use the `ProtectedRoute` component (`src/components/ui/ProtectedRoute.tsx`)
  for client-side protected pages
- Never expose sensitive data in client components
- Registration: `POST /api/auth/register` with email, password, name
- Password change: `POST /api/auth/change-password` (requires session)
- Password history tracked via `src/features/auth/services/password.ts` (prevents reuse of last 2 passwords)

```typescript
import { connection } from 'next/server'
import { checkAdminAuth } from '@/features/admin/services/admin-auth'

export default async function AdminPage() {
  // Admin screens are per-request; state that explicitly under Cache Components
  await connection()

  const authCheck = await checkAdminAuth('analytics:read')
  if (!authCheck.authorized) {
    redirect('/')
  }
  // Admin content
}
```

## File Structure

All application code lives under `src/`. Route segments are in `src/app/`,
domain modules in `src/features/`, shared utilities in `src/lib/`, and
presentational components in `src/components/`. Do not create top-level
`app/`, `lib/`, or `components/` directories.

```text
src/
  app/                    # Next.js App Router
    (public)/             # Storefront route group: shop, products, cart,
                          #   checkout, orders, account, auth, wishlist,
                          #   s/[key] short links, offline, and marketing pages
    admin/                # Admin panel route segments
    api/                  # Route handlers: account, admin, ai, auth, cart,
                          #   categories, checkout, exchange-rates, health,
                          #   inngest, metrics, orders, payments, pincode,
                          #   products, reviews, search, share, upload, wishlist
    globals.css           # The only global stylesheet
    layout.tsx            # Root layout (providers: Redux, Currency, Theme,
                          #   Session, Toast, Analytics)
    global-error.tsx, manifest.ts, sitemap.ts
  features/               # Domain modules; each owns its components, hooks,
                          #   services, Redux store slice, and validations
    account/ admin/ ai/ auth/ cart/ orders/ payments/ product/ wishlist/
  lib/                    # Cross-cutting shared utilities
    db.ts                 # Drizzle clients (primary + read replica)
    schema.ts             # Drizzle schema (all tables)
    db-queries.ts         # Shared typed query helpers
    short-id.ts           # Base62 7-char ID generator
    redis.ts              # Redis utilities (getCachedData, stampede prevention)
    cache.ts              # Cache key patterns and TTL constants
    cache-tags.ts         # Cache Components tag helpers + revalidateCacheTags
    auth.ts, auth.config.ts # NextAuth v5 config (JWT sessions, DrizzleAdapter)
    api-client.ts         # Typed HTTP client for Redux thunks (DIP abstraction)
    api-utils.ts          # apiSuccess, apiError, handleApiError
    api-middleware.ts     # withLogging / withApiLogging wrappers
    logger.ts             # Pino structured logging
    metrics.ts            # Prometheus metric collection
    env.ts                # Environment variable validation
    store.ts              # Redux store assembly
    currency.ts, money.ts # INR-based pricing and formatting
    edge-config.ts        # Vercel Edge Config (feature flags, shipping config)
    image-storage.ts      # Vercel Blob / Azure Blob provider selection
    rate-limit.ts, ownership.ts, serializers.ts, types.ts
    validations/          # Zod schemas: index, api, env, payment, primitives
    inngest/              # Durable background work
      client.ts dispatch.ts registry.ts realtime.ts sessions.ts scores.ts
      functions/          # Cron-triggered: email-retry.ts, exchange-rates.ts
    search/               # Upstash Search + SQL fallback
      client.ts index.ts product-search.ts
    email/                # index, providers, templates, retry, failed-emails
    payments/             # gateway, registry, providers, razorpay, cod, errors
    ai/                   # gateway, product-rag, ai-cache
    notifications/, shipping/, constants/
  components/             # Presentational, feature-agnostic components
    layout/ ui/ sections/ skeletons/ icons/ providers/ pwa/ SearchBar.tsx
  contexts/               # CurrencyContext.tsx, ThemeContext.tsx
  hooks/                  # useDebounce, useFetch, useFormState, useLocalStorage,
                          #   useModalState, useMutation, useCursorPagination
  server/                 # Server-only loaders (pincode-loader.ts)
  types/                  # Ambient declarations (next-auth.d.ts)
  proxy.ts                # Edge proxy: HTTPS enforcement and admin JWT gate
  instrumentation.ts, instrumentation-client.ts

__tests__/                # Vitest suites, mirroring the src/ path of the
                          #   module under test
playwright-tests/         # Playwright E2E specs and fixtures
scripts/                  # apply-idempotent-bootstrap.mjs,
                          #   create-orders-search-index.ts, sql/
drizzle/                  # Generated SQL migrations
docs/                     # api-reference, architecture, deployment, development,
                          #   features, getting-started, observability,
                          #   troubleshooting
specs/                    # Feature specifications, plans, and task lists
```

## Common Patterns

### Creating a New API Endpoint

1. Define Zod schema under `src/lib/validations/` (or the owning feature's `validations.ts`)
2. Create route in `src/app/api/[name]/route.ts`
3. Validate input with schema
4. Use Drizzle for database operations
5. Handle errors properly
6. Return type-safe response

### Adding a New Feature

1. Update Drizzle schema in `src/lib/schema.ts` if needed
2. Run `npx drizzle-kit generate` and `npx drizzle-kit migrate`
3. Create types/validations
4. Add Redux slice if state is shared across pages
5. Implement API routes or Server Actions
6. Create UI components
7. Test thoroughly

### Currency Formatting

- Use `useCurrency()` from `@/contexts/CurrencyContext` in all client components
- Call `formatPrice(amountInUSD)` — never use raw `$` or `.toFixed(2)`
- Prices stored in DB are in USD; conversion happens at display time
- CurrencySelector in Header lets users switch between INR/USD/EUR/GBP

### Theme Support

- Use `useTheme()` from `@/contexts/ThemeContext` in client components
- Two themes: `default` and `baby-pink`
- ThemeSelector in Header lets users switch themes
- Theme persisted to localStorage

### State Management (Redux)

- Slices live in their owning feature module under `src/features/<domain>/store/`
  and are assembled into the store in `src/lib/store.ts`
- Use `useSelector` + `useDispatch<AppDispatch>()` in client components
- Keep UI-only state (modals, forms) as local `useState`
- Use Redux for data shared across pages or fetched from APIs
- All thunks use `src/lib/api-client.ts` typed HTTP abstraction (never raw `fetch`)

### Component Best Practices

- **Organized folder structure**: Place components in appropriate folders
  - `src/components/layout/` - Reusable layout components (Header, Footer, CartIcon)
  - `src/components/ui/` - Generic UI components (forms, buttons, error boundaries)
  - `src/components/sections/` - Page-specific sections (Hero, ProductGrid)
  - `src/features/<domain>/components/` - Components owned by a single domain
- Use Server Components by default, add 'use client' only when needed
- Keep components focused and single-purpose
- Extract shared logic into hooks or utilities

### Performance Best Practices

- Cache frequently accessed data
- Use connection pooling (already configured)
- Minimize database queries
- Optimize images with Next.js Image
- Use proper indexes in Drizzle schema
- Implement pagination for large datasets

## Rendering Model — Cache Components

`next.config.ts` sets `cacheComponents: true`. Everything is **per-request by
default**; cacheable work is opted in explicitly. Route segment configuration
(`export const dynamic`, `export const revalidate`, `export const runtime`) is
**rejected by Next.js** under this model and must never be added.

### Opting into caching

Wrap the cacheable work in a `"use cache"` scope that declares both a named
`cacheLife` profile and a `cacheTag` set:

```typescript
import { cacheLife, cacheTag } from 'next/cache'
import { productTag } from '@/lib/cache-tags'

async function getProduct(id: string) {
  'use cache'
  cacheLife('product')
  cacheTag(productTag(id))
  return db.products.findById(id, false)
}
```

The shared `cacheLife` profiles are declared in `next.config.ts` and anchored to
the matching `CACHE_TTL` entries in `src/lib/cache.ts`:

| Profile    | Use                              | stale / revalidate / expire |
| ---------- | -------------------------------- | --------------------------- |
| `catalog`  | Catalog listings and bestsellers | 60 / 300 / 3600             |
| `product`  | Product detail                   | 60 / 900 / 3600             |
| `taxonomy` | Category taxonomy                | 300 / 3600 / 86400          |

### Rules for a cached scope

- A `"use cache"` scope MUST NOT read sessions, cookies, headers, or any
  request-scoped state.
- A Redis read MUST NOT be nested inside a `"use cache"` scope. Redis and Cache
  Components are alternatives, never layers — pass `withCache: false` to the
  `db.*` helpers inside a cached scope.
- Per-request regions of an otherwise prerenderable page MUST sit behind a
  `Suspense` boundary with a skeleton from `src/components/skeletons/`.

### Invalidation

Writes MUST invalidate every layer they affect: `invalidateCache` for Redis and
`revalidateCacheTags` from `src/lib/cache-tags.ts` for cache tags. Tag failures
are logged and never fail the originating write.

### Control-flow errors

`handleApiError` in `src/lib/api-utils.ts` calls `unstable_rethrow(error)`
first, so prerender bail-out signals, `redirect`, and `notFound` propagate
instead of being converted into JSON 500 responses. Any new `try`/`catch` around
a render or fetch path must do the same.

### Direct database access

Server Components query the database directly through `src/lib/db-queries.ts` —
never by fetching the project's own API routes over HTTP.

### Static params

`src/app/(public)/products/[id]/page.tsx` prebuilds the top products via
`generateStaticParams`; every other product page is generated on demand and
cached. A database that is unreachable at build time degrades to a stand-in
rather than failing the build.

## Commands Reference

This is the complete list of scripts defined in `package.json`. No other
`npm run` command exists; `npm run docs:check` fails on any Markdown reference
to a script outside this list.

```bash
npm run dev          # Start dev server over HTTPS (experimental self-signed cert)
npm run analyze      # Production build with the bundle analyzer enabled
npm run build        # Build for production — REQUIRED pre-PR check (see "Pre-PR Validation")
npm run start        # Start the production server
npm run lint         # ESLint check — REQUIRED pre-PR check
npm run lint:strict  # ESLint, failing on any warning
npm run format       # Rewrite files with Prettier
npm run format:check # Check Prettier formatting
npm run docs:check   # Documentation drift check — REQUIRED pre-PR check
npm run db:generate  # Generate Drizzle migrations
npm run db:migrate   # Apply migrations
npm run db:bootstrap # Apply the full current schema idempotently
npm run db:push      # Push schema directly (no migration file)
npm run db:studio    # Open Drizzle Studio GUI
npm run redis:orders:index # Create/backfill the Redis orders search index
npm run test         # Run unit tests (single run) — REQUIRED pre-PR check
npm run test:watch   # Run unit tests (watch mode)
npm run test:coverage # Run unit tests with coverage
```

There is no `db:seed` script and no plain-HTTP dev script. The project ships no
sample-data seeding; `db:bootstrap` creates schema only.

## Testing Checklist

- [ ] API validation with invalid data
- [ ] Authentication flows
- [ ] Cache invalidation
- [ ] Error boundaries
- [ ] TypeScript type checking
- [ ] Database transactions
- [ ] Edge cases (out of stock, etc.)

## Unit Testing Setup

- **Framework**: Vitest with jsdom environment
- **Libraries**: @testing-library/react, @testing-library/jest-dom
- **Config**: `vitest.config.mts` at project root
- **Test location**: `__tests__/` directory mirrors source structure
- **Setup file**: `__tests__/setup.ts` (imports jest-dom matchers)

### Test Coverage Areas

`__tests__/` is the inventory. It mirrors the `src/` path of the module under
test, so the test file for `src/lib/cache-tags.ts` is
`__tests__/lib/cache-tags.test.ts` and the test file for
`src/features/orders/services/order-cache.ts` is
`__tests__/features/orders/services/order-cache.test.ts`.

Do not maintain a table of test files here. It drifts within days — the table
this replaced claimed 87 files against an actual 300. Reproduce the current
count instead:

```bash
find __tests__ -name '*.test.ts' -o -name '*.test.tsx' | wc -l
```

As of 2026-08-07 that reports **300**. To find the tests covering a module,
mirror its path under `__tests__/` rather than searching this file.

### Writing New Tests

- Co-locate test files in `__tests__/` mirroring the source path
- Use `describe`/`it` pattern with clear test names
- Mock external dependencies (fetch, DB, Redis) with `vi.mock()` or `vi.stubGlobal()`
- Run `npm run test` before committing

## Security Considerations

- Validate all user input with Zod
- Use parameterized queries (Drizzle does this)
- Check authentication for protected routes
- Sanitize data before display
- Use HTTPS in production
- Rotate secrets regularly
- Implement rate limiting

## Deployment Notes

- Designed for serverless (Vercel, AWS Lambda, etc.)
- Requires PostgreSQL and Redis instances
- Set all environment variables
- Run migrations before first deploy
- Configure Google OAuth credentials
- Use production-grade secrets

## SSL/HTTPS Setup

- **Development**: `npm run dev` runs `next dev --experimental-https`, so the
  local server is HTTPS with a self-signed certificate. The production HTTPS
  redirect stays disabled locally.
- **Production**: Auto-redirects HTTP → HTTPS via proxy
- **NEXTAUTH_URL**: Must use `https://` in production (set in `.env.production`)
- **Strict-Transport-Security**: Enabled for 1 year (max-age=31536000)
- **Proxy**: `src/proxy.ts` enforces HTTPS in production only
- **Vercel**: Automatically provides SSL certificate

**To Deploy with HTTPS:**

1. Set `NEXTAUTH_URL=https://your-domain.com` in production env vars
2. Proxy automatically redirects http → https in production
3. No additional SSL configuration needed on Vercel

## When Adding New Dependencies

1. Check if similar functionality exists
2. Prefer well-maintained packages
3. Consider bundle size impact
4. Update documentation
5. Run security audit

## Copilot Preferences

- Suggest modern TypeScript patterns
- Prioritize type safety
- Follow existing code structure
- Include proper error handling
- Add meaningful comments for complex logic
- Suggest performance optimizations
- Consider serverless constraints

## Pre-PR Validation (MANDATORY)

Before opening or updating a pull request, the agent **MUST** run all five commands locally and confirm each one passes. Skipping `npm run build` is the single most common cause of CI/Vercel deploy failures on this repo (Next.js route-type errors and missing `.nft.json` manifests only surface in `next build`, not in `tsc --noEmit`).

```bash
npm run lint                        # ESLint — style & a11y rules
npx tsc --noEmit -p tsconfig.check.json  # TypeScript type-check (the config CI uses)
npm test                            # Vitest unit tests
npm run build                       # Next.js production build — REQUIRED, catches route & prerender errors
npm run docs:check                  # Documentation drift — npm scripts and workflow paths must resolve
```

If any command fails, fix the failures (or revert the change) before opening / updating the PR. Do not rely on `parallel_validation` to catch Next.js build-only errors — it does not run `next build`.

## Agent Tool Preferences

Prefer the built-in structured tools over shelling out through `bash`. Shell wrappers are slower, consume a bash session, and return unstructured output that's harder to reason over.

| Use this built-in tool | Instead of shelling out via `bash` to |
| ---------------------- | ------------------------------------- |
| `grep`                 | `grep`, `rg`, `ag`                    |
| `glob`                 | `find`, `ls`, `fd`                    |
| `view`                 | `cat`, `head`, `tail`, `less`, `bat`  |
| `edit` / `create`      | `sed -i`, `awk`, here-docs into files |

Reserve `bash` for things that genuinely require a shell: running tests/builds (`npm run …`), git commands, package installs, scripts, or composing pipelines whose intermediate output is not needed.

## UI/UX Testing Requirements

**MANDATORY**: Always test UI/UX changes with Playwright before completing tasks.

### Testing Process

1. **Start dev server** with mock data if database is unavailable
2. **Use Playwright** to navigate and interact with changed UI
3. **Take screenshots** of all modified pages/components
4. **Verify**:
   - Tailwind CSS classes rendering correctly
   - Responsive design working
   - Interactive elements functional
   - Error states display properly
   - Loading states work
5. **Include screenshots** in PR description
6. **Revert temporary mock code** after testing

### Mock Data Pattern

```typescript
// Temporary mock for testing - ALWAYS REVERT
const MOCK_DATA = [...];
export async function GET() {
  return NextResponse.json({ data: MOCK_DATA });
}
```

### Example Testing Flow

```bash
# 1. Create mock data temporarily
# 2. Start server: npm run dev
# 3. Test with Playwright
# 4. Take screenshots
# 5. Restore original code
# 6. Commit real changes only
```

## Error Handling & Loading States

This project uses Next.js App Router conventions for error boundaries and loading states:

### Error Boundaries

- `src/app/global-error.tsx` - Root error boundary
- `src/app/(public)/error.tsx` - Storefront route-group error boundary
- `src/app/(public)/{products,orders,cart,checkout,account,auth,shop,wishlist}/error.tsx`
- `src/app/admin/error.tsx` - Admin section error handling

### Loading States

- `src/app/(public)/loading.tsx` - Storefront loading skeleton
- `src/app/(public)/products/loading.tsx` - Products listing skeleton
- `src/app/(public)/products/[id]/loading.tsx` - Product detail skeleton
- `src/app/admin/loading.tsx` - Admin loading skeleton

### Component Props Pattern

Always use readonly interfaces for component props:

```typescript
interface MyComponentProps {
  readonly data: Data
  readonly onAction?: () => void
}

export default function MyComponent({ data, onAction }: MyComponentProps) {
  // ...
}
```

## Environment Variable Validation

Environment variables are validated at startup using `src/lib/env.ts`:

- `DATABASE_URL` - Required PostgreSQL connection string
- `REDIS_URL` - Optional Redis URL (defaults to localhost:6379)
- `NODE_ENV` - Optional (development/production/test)

Import validated env vars:

```typescript
import { env } from '@/lib/env'
console.log(env.DATABASE_URL) // Typed and validated
```

## API Route Patterns

### Auth Status Codes

- `401 Unauthorized` - User is not authenticated (no session)
- `403 Forbidden` - User is authenticated but lacks permission

### Input Validation

Always use Zod schemas for request body validation:

```typescript
import { AddToCartSchema } from '@/lib/validations'
// '@/*' resolves to './src/*', so this is src/lib/validations/index.ts
import { apiError, handleValidationError } from '@/lib/api-utils'

export async function POST(request: NextRequest) {
  const body = await request.json()
  const parseResult = AddToCartSchema.safeParse(body)
  if (!parseResult.success) {
    return handleValidationError(parseResult.error)
  }
  const validated = parseResult.data
  // ...
}
```

## Accessibility Requirements

All components must include:

- `aria-expanded` on dropdown triggers
- `aria-haspopup="menu"` on menu triggers
- `role="menu"` on dropdown containers
- `role="menuitem"` on menu items
- `aria-hidden="true"` on decorative elements
- `rel="noopener noreferrer"` on external links
- `htmlFor` and `id` on label/input pairs
