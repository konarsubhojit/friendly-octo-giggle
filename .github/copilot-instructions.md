# GitHub Copilot Instructions for E-commerce Project

## Project Overview

This is a highly scalable e-commerce website built with Next.js 16, TypeScript, PostgreSQL, Redis, and NextAuth for authentication. It's designed to run as serverless on-demand functions.

## Technology Stack

- **Framework**: Next.js 16.1.6 with App Router (TypeScript 5.9)
- **React**: 19.2.4
- **Database**: PostgreSQL (Neon Serverless) with Drizzle ORM 0.45
- **State Management**: Redux Toolkit 2.11 (cart, orders, admin, wishlist slices)
- **Currency**: CurrencyContext with INR default, `useCurrency()` hook
- **Theme**: ThemeContext with default/baby-pink themes, `useTheme()` hook
- **Cache**: Redis (@upstash/redis 1.37, HTTP-based) with stampede prevention and Redis Search for orders
- **Authentication**: NextAuth.js v5 (beta.30) with Google OAuth + credentials (email/password), DrizzleAdapter
- **Password**: bcryptjs 3.0 with password history tracking (`lib/password.ts`)
- **Email**: Nodemailer 7.0 + SendGrid, modular email system (`lib/email/` — providers, templates, retry, failed-emails)
- **Styling**: Tailwind CSS v4.1
- **Validation**: Zod 4.3 for runtime type checking
- **IDs**: Base62 short IDs (7-char alphanumeric) via `lib/short-id.ts` for products, orders, carts, and related entities. Uses `varchar(7)` in DB schema.
- **Logging**: Pino (structured JSON in production, pretty-print in dev)
- **Testing**: Vitest 4.0 with jsdom + React Testing Library 16.3 + @testing-library/jest-dom
- **E2E Testing**: Playwright 1.58 with axe-core accessibility testing
- **Image Storage**: Vercel Blob
- **Analytics**: Vercel Analytics
- **API Client**: `lib/api-client.ts` — typed HTTP abstraction for Redux thunks (DIP pattern)

## Code Style Guidelines

### TypeScript

- Use strict TypeScript everywhere
- Prefer type inference over explicit types when obvious
- Use Zod schemas for runtime validation
- Define types in `lib/types.ts` or `lib/validations.ts`
- Use modern TypeScript features (satisfies, const assertions, template literals)

```typescript
// Good
const config = {
  timeout: 5000,
  retries: 3,
} as const satisfies ConfigType;

// Use Zod for validation
const schema = z.object({ name: z.string() });
type Input = z.infer<typeof schema>;
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

- Use `lib/api-utils.ts` helpers for responses
- Always validate input with Zod schemas
- Use proper HTTP status codes
- Handle errors with `handleApiError`
- Return type-safe responses with `apiSuccess`/`apiError`

```typescript
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const validated = MySchema.parse(body);
    const result = await processData(validated);
    return apiSuccess({ result });
  } catch (error) {
    return handleApiError(error);
  }
}
```

### Database (Drizzle ORM)

- Always use Drizzle client from `lib/db.ts`
- Use transactions for multi-step operations
- Include relations when needed with `with`
- Use proper indexing in schema
- Convert DateTime to ISO string for API responses

```typescript
const result = await drizzleDb.query.products.findMany({
  where: gt(schema.products.stock, 0),
  with: { variations: true },
});
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

1. Modify `lib/schema.ts` with your changes
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

- Use `getCachedData` from `lib/redis.ts` for read-heavy endpoints
- Set appropriate TTL (60s for products)
- Invalidate cache on writes with `invalidateCache`
- Use stale-while-revalidate pattern
- Always implement stampede prevention

```typescript
const data = await getCachedData(
  "cache:key",
  60, // TTL in seconds
  async () => await fetchFromDB(),
  10, // Stale time
);
```

### Authentication

- Use `auth()` from `lib/auth.ts` to get session
- Supports Google OAuth + email/password credentials
- Check user role for admin routes
- Use `ProtectedRoute` component for protected pages
- Never expose sensitive data in client components
- Registration: `POST /api/auth/register` with email, password, name
- Password change: `POST /api/auth/change-password` (requires session)
- Password history tracked via `lib/password.ts` (prevents reuse of last 2 passwords)

```typescript
import { auth } from "@/lib/auth";

export default async function AdminPage() {
  const session = await auth();
  if (session?.user?.role !== "ADMIN") {
    redirect("/");
  }
  // Admin content
}
```

## File Structure

```
app/
  ├── api/
  │   ├── admin/
  │   │   ├── orders/route.ts, [id]/route.ts
  │   │   ├── products/route.ts, [id]/route.ts, [id]/variations/route.ts, [id]/variations/[variationId]/route.ts
  │   │   ├── users/route.ts, [id]/route.ts
  │   │   ├── reviews/route.ts
  │   │   ├── email-failures/route.ts
  │   │   └── sales/route.ts
  │   ├── auth/[...nextauth]/route.ts, register/route.ts, change-password/route.ts
  │   ├── account/route.ts
  │   ├── cart/route.ts, items/[id]/route.ts
  │   ├── orders/route.ts, [id]/route.ts
  │   ├── products/route.ts, [id]/route.ts, bestsellers/route.ts
  │   ├── reviews/route.ts
  │   ├── wishlist/route.ts, [productId]/route.ts
  │   ├── share/route.ts
  │   ├── exchange-rates/route.ts
  │   ├── upload/route.ts
  │   ├── dev/copilot-auth/     # Dev-only auth helper
  │   └── health/route.ts
  ├── auth/              # Sign-in, register, and auth error pages
  ├── admin/             # Admin panel (dashboard, products, orders, users, reviews, email-failures)
  ├── account/           # User account/profile page
  ├── products/          # Product listing and detail pages (with ProductClient.tsx)
  ├── orders/            # Order listing and detail pages
  ├── cart/              # Shopping cart
  ├── shop/              # Shop page with loading state
  ├── wishlist/          # Wishlist page with loading state
  ├── s/[key]/           # Short-link redirects
  ├── contact/           # Contact page with ContactForm component
  ├── about/, blog/, careers/, help/, press/, returns/, shipping/
  ├── error.tsx          # Global error boundary
  ├── loading.tsx        # Global loading skeleton
  ├── layout.tsx         # Root layout (providers: Redux, Currency, Theme, Session, Toast, Analytics)
  └── page.tsx           # Home page
lib/
  ├── db.ts             # Drizzle client (Neon Serverless)
  ├── schema.ts         # Drizzle schema (all tables)
  ├── short-id.ts       # Base62 7-char ID generator
  ├── redis.ts          # Redis utilities (getCachedData, stampede prevention)
  ├── cache.ts          # Cache key patterns and TTL constants
  ├── auth.ts           # NextAuth v5 config (Google OAuth + credentials, DrizzleAdapter)
  ├── password.ts       # Password hashing (bcryptjs) + history tracking
  ├── api-client.ts     # Typed HTTP client for Redux thunks (DIP abstraction)
  ├── types.ts          # Type definitions
  ├── validations.ts    # Zod schemas
  ├── api-utils.ts      # API helpers (apiSuccess, apiError, handleApiError)
  ├── api-middleware.ts  # withApiLogging wrapper (requestId, timer, user context)
  ├── logger.ts         # Pino structured logging (createLogger, logApiRequest, Timer)
  ├── env.ts            # Environment variable validation
  ├── store.ts          # Redux store (cart, orders, admin, wishlist)
  ├── hooks.ts          # Custom React hooks (useLocalStorage, etc.)
  ├── serializers.ts    # Data serialization helpers
  ├── upload-constants.ts # Upload config constants
  ├── email.ts          # Re-export from lib/email/ (backward compat)
  ├── email/            # Modular email system
  │   ├── index.ts        # Public API (sendOrderConfirmationEmail, etc.)
  │   ├── providers.ts    # Provider init and transport (Nodemailer/SendGrid)
  │   ├── templates.ts    # HTML email templates
  │   ├── retry.ts        # Email retry logic
  │   └── failed-emails.ts # Failed email tracking and admin queries
  ├── constants/
  │   ├── categories.ts   # Product categories (PRODUCT_CATEGORIES, CATEGORY_FILTERS)
  │   └── error-messages.ts # Centralized form/API error message constants
  └── features/
      ├── cart/cartSlice.ts     # Cart state + async thunks
      ├── orders/ordersSlice.ts # Orders state + async thunks
      ├── admin/adminSlice.ts   # Admin state + async thunks (products, orders, users)
      └── wishlist/wishlistSlice.ts # Wishlist state + async thunks
contexts/
  ├── CurrencyContext.tsx # Currency context (INR default, supports USD/EUR/GBP)
  └── ThemeContext.tsx   # Theme context (default/baby-pink themes)
components/
  ├── layout/           # Header, HeaderWrapper, Footer, CartIcon
  ├── ui/               # AuthComponents, CurrencySelector, ThemeSelector, ReviewForm, StarRating,
  │                       # NewsletterForm, ErrorBoundary, Badge, Card, ConfirmDialog, DynamicForm,
  │                       # EmptyState, LoadingSpinner, LoadingOverlay, GradientButton, GradientHeading,
  │                       # AlertBanner, WishlistButton, UserMenu, ProtectedRoute, SelectInput, TextInput, etc.
  ├── admin/            # ProductFormModal, ProductEditForm, ProductEditPageForm, DeleteConfirmModal,
  │                       # VariationFormModal, VariationList, AdminHeaderNav, AdminNavLinks, AdminBreadcrumbs,
  │                       # AdminSearchForm, AdminOrderCard, OrdersByStatusCard, TopProductsTable,
  │                       # EmailFailuresClient, RoleBadge, RoleAction, UserRow, UsersTable, UserAvatar
  ├── auth/             # LoginModal, OAuthButtons, PasswordStrengthChecklist, PasswordToggleButton,
  │                       # CopilotDevLoginButton
  ├── cart/             # CartItemRow
  ├── orders/           # OrderListCard, OrdersSearchForm
  ├── product/          # ImageCarousel, ProductStockBadge, ShareButton, VariationButton
  ├── icons/            # CheckIcon, CircleIcon, EyeIcon, EyeOffIcon, GoogleIcon, MicrosoftIcon
  ├── providers/        # StoreProvider, SessionProvider
  ├── sections/         # Hero, ProductGrid, QuickAddButton, RecentlyViewed, ReviewsSection, StockBadge
  └── skeletons/        # HeaderSkeleton, HeroSkeleton, ProductCardSkeleton
scripts/
  ├── export-product-data.ts  # Export product data
  ├── import-product-data.ts  # Import product data
  └── reset-db.ts             # Reset database
docs/                     # Project documentation
  ├── api-reference.md, architecture.md, deployment.md,
  ├── development.md, getting-started.md, troubleshooting.md
drizzle/
  └── 0000-0003.sql     # 4 migration files
playwright-tests/         # E2E tests with Playwright
  ├── accessibility.spec.ts, admin-views.spec.ts, cart.spec.ts,
  ├── products.spec.ts, ui-changes.spec.ts, password-validation.spec.ts,
  ├── account-password-validation.spec.ts, fixed-background.spec.ts
  ├── global-setup.ts, mock-data.ts
  └── screenshots/      # Screenshot artifacts
```

## Common Patterns

### Creating a New API Endpoint

1. Define Zod schema in `lib/validations.ts`
2. Create route in `app/api/[name]/route.ts`
3. Validate input with schema
4. Use Drizzle for database operations
5. Handle errors properly
6. Return type-safe response

### Adding a New Feature

1. Update Drizzle schema in `lib/schema.ts` if needed
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

- Cart state: `lib/features/cart/cartSlice.ts`
- Orders state: `lib/features/orders/ordersSlice.ts`
- Admin state: `lib/features/admin/adminSlice.ts` (products, orders, users)
- Wishlist state: `lib/features/wishlist/wishlistSlice.ts`
- Use `useSelector` + `useDispatch<AppDispatch>()` in client components
- Keep UI-only state (modals, forms) as local `useState`
- Use Redux for data shared across pages or fetched from APIs
- All thunks use `lib/api-client.ts` typed HTTP abstraction (never raw `fetch`)

### Component Best Practices

- **Organized folder structure**: Place components in appropriate folders
  - `components/layout/` - Reusable layout components (Header, Footer, CartIcon)
  - `components/ui/` - Generic UI components (forms, buttons, error boundaries)
  - `components/sections/` - Page-specific sections (Hero, ProductGrid)
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

## Performance Optimizations

This project implements several Next.js 16 performance optimizations:

### Static Generation with ISR

- **Removed `force-dynamic`**: Pages use Incremental Static Regeneration (ISR) instead of dynamic rendering
- **Revalidation timing**: Static pages revalidate every 60 seconds
- **Benefits**: Faster page loads, reduced database load, better caching

### Direct Database Access

- **No HTTP fetches in Server Components**: Database queries happen directly in components
- **Eliminates roundtrip overhead**: No network latency between server component and API route
- **Simplified architecture**: Fewer layers, easier debugging

### API Route Optimizations

- **Cache headers**: All API routes include proper Cache-Control headers
- **Stale-while-revalidate**: Responses can be cached while background revalidation occurs
- **Redis caching**: Frequently accessed data cached with stampede prevention

### Static Params Generation

- **`generateStaticParams`**: Pre-generates pages for top 20 products at build time
- **Incremental builds**: Additional product pages generated on-demand and cached
- **SEO benefits**: Core product pages indexed immediately

### Implementation Examples

```typescript
// ISR with revalidation
export const revalidate = 60;

// Direct database queries in Server Components
const products = await drizzleDb.query.products.findMany();

// API routes with cache headers
return NextResponse.json(data, {
  headers: {
    "Cache-Control": "public, s-maxage=60, stale-while-revalidate=30",
  },
});

// Static params generation
export async function generateStaticParams() {
  const products = await drizzleDb.query.products.findMany({
    limit: 20,
    orderBy: asc(schema.products.id),
  });
  return products.map((product) => ({ id: product.id }));
}
```

## Commands Reference

```bash
npm run dev          # Start dev server
npm run dev:https    # Start dev server with experimental HTTPS
npm run build        # Build for production
npm run lint         # ESLint check
npm run db:generate  # Generate Drizzle migrations
npm run db:migrate   # Apply migrations
npm run db:push      # Push schema directly (no migration file)
npm run db:studio    # Open Drizzle Studio GUI
npm run db:seed      # Seed database
npm run test         # Run unit tests (single run)
npm run test:watch   # Run unit tests (watch mode)
npm run test:coverage # Run unit tests with coverage
```

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

| Area                | Test File                                                                     | Tests |
| ------------------- | ----------------------------------------------------------------------------- | ----- |
| Zod schemas         | `__tests__/lib/validations.test.ts`                                           | 49    |
| API utilities       | `__tests__/lib/api-utils.test.ts`                                             | 13    |
| API NextResponse    | `__tests__/lib/api-utils-nextresponse.test.ts`                                | 12    |
| API middleware      | `__tests__/lib/api-middleware.test.ts`                                        | 9     |
| Serializers         | `__tests__/lib/serializers.test.ts`                                           | 8     |
| Upload constants    | `__tests__/lib/upload-constants.test.ts`                                      | 14    |
| Short ID            | `__tests__/lib/short-id.test.ts`                                              | 3     |
| Redis cache         | `__tests__/lib/redis.test.ts`                                                 | 12    |
| Cache utilities     | `__tests__/lib/cache.test.ts`                                                 | 30    |
| Env validation      | `__tests__/lib/env.test.ts`                                                   | 4     |
| Types               | `__tests__/lib/types.test.ts`                                                 | 3     |
| Schema              | `__tests__/lib/schema.test.ts`                                                | 7     |
| Hooks               | `__tests__/lib/hooks.test.ts`                                                 | 27    |
| Auth                | `__tests__/lib/auth.test.ts`                                                  |       |
| Database            | `__tests__/lib/db.test.ts`                                                    |       |
| Logger              | `__tests__/lib/logger.test.ts`                                                |       |
| Password            | `__tests__/lib/password.test.ts`                                              |       |
| Email               | `__tests__/lib/email.test.ts`                                                 |       |
| Email failed        | `__tests__/lib/email/failed-emails.test.ts`                                   |       |
| Email retry         | `__tests__/lib/email/retry.test.ts`                                           |       |
| Error messages      | `__tests__/lib/constants/error-messages.test.ts`                              |       |
| Cart slice          | `__tests__/lib/features/cart/cartSlice.test.ts`                               | 15    |
| Cart thunks         | `__tests__/lib/features/cart/cartSlice.thunks.test.ts`                        | 11    |
| Orders slice        | `__tests__/lib/features/orders/ordersSlice.test.ts`                           | 17    |
| Orders thunks       | `__tests__/lib/features/orders/ordersSlice.thunks.test.ts`                    | 12    |
| Admin slice         | `__tests__/lib/features/admin/adminSlice.test.ts`                             | 22    |
| Admin thunks        | `__tests__/lib/features/admin/adminSlice.thunks.test.ts`                      | 14    |
| Redux store         | `__tests__/lib/store.test.ts`                                                 | 5     |
| Header              | `__tests__/components/layout/Header.test.tsx`                                 | 13    |
| CartIcon            | `__tests__/components/layout/CartIcon.test.tsx`                               | 4     |
| Footer              | `__tests__/components/layout/Footer.test.tsx`                                 | 10    |
| AuthComponents      | `__tests__/components/ui/AuthComponents.test.tsx`                             | 14    |
| CurrencySelector    | `__tests__/components/ui/CurrencySelector.test.tsx`                           | 5     |
| ErrorBoundary       | `__tests__/components/ui/ErrorBoundary.test.tsx`                              | 15    |
| NewsletterForm      | `__tests__/components/ui/NewsletterForm.test.tsx`                             | 5     |
| ConfirmDialog       | `__tests__/components/ui/ConfirmDialog.test.tsx`                              |       |
| ReviewForm          | `__tests__/components/ui/ReviewForm.test.tsx`                                 |       |
| StarRating          | `__tests__/components/ui/StarRating.test.tsx`                                 |       |
| ThemeSelector       | `__tests__/components/ui/ThemeSelector.test.tsx`                              |       |
| UI Components       | `__tests__/components/ui/UIComponents.test.tsx`                               |       |
| ProductFormModal    | `__tests__/components/admin/ProductFormModal.test.tsx`                        | 22    |
| DeleteConfirmModal  | `__tests__/components/admin/DeleteConfirmModal.test.tsx`                      | 6     |
| VariationFormModal  | `__tests__/components/admin/VariationFormModal.test.tsx`                      |       |
| VariationList       | `__tests__/components/admin/VariationList.test.tsx`                           |       |
| LoginModal          | `__tests__/components/auth/LoginModal.test.tsx`                               |       |
| SharedAuth          | `__tests__/components/auth/SharedAuthComponents.test.tsx`                     |       |
| ShareButton         | `__tests__/components/product/ShareButton.test.tsx`                           |       |
| Hero                | `__tests__/components/sections/Hero.test.tsx`                                 | 5     |
| ProductGrid         | `__tests__/components/sections/ProductGrid.test.tsx`                          | 10    |
| ReviewsSection      | `__tests__/components/sections/ReviewsSection.test.tsx`                       |       |
| Skeletons           | `__tests__/components/skeletons/Skeletons.test.tsx`                           | 7     |
| Providers           | `__tests__/components/providers/Providers.test.tsx`                           | 3     |
| CurrencyContext     | `__tests__/contexts/CurrencyContext.test.tsx`                                 | 12    |
| ThemeContext        | `__tests__/contexts/ThemeContext.test.tsx`                                    |       |
| Error pages         | `__tests__/app/error-pages.test.tsx`                                          |       |
| Loading pages       | `__tests__/app/loading-pages.test.tsx`                                        |       |
| Account page        | `__tests__/app/account/page.test.ts`                                          |       |
| SignIn client       | `__tests__/app/auth/signin/SignInClient.test.tsx`                             |       |
| ContactForm         | `__tests__/app/contact/ContactForm.test.tsx`                                  |       |
| Short-link route    | `__tests__/app/s/route.test.ts`                                               |       |
| Health API          | `__tests__/app/api/health/route.test.ts`                                      | 1     |
| Account API         | `__tests__/app/api/account/route.test.ts`                                     |       |
| Auth register API   | `__tests__/app/api/auth/register/route.test.ts`                               |       |
| Auth change-pw API  | `__tests__/app/api/auth/change-password/route.test.ts`                        |       |
| Auth route API      | `__tests__/app/api/auth/route.test.ts`                                        |       |
| Cart API            | `__tests__/app/api/cart/route.test.ts`                                        |       |
| Cart items API      | `__tests__/app/api/cart/items/[id]/route.test.ts`                             |       |
| Exchange rates API  | `__tests__/app/api/exchange-rates/route.test.ts`                              |       |
| Orders API          | `__tests__/app/api/orders/route.test.ts`                                      |       |
| Orders [id] API     | `__tests__/app/api/orders/[id]/route.test.ts`                                 |       |
| Products API        | `__tests__/app/api/products/route.test.ts`                                    |       |
| Products [id] API   | `__tests__/app/api/products/[id]/route.test.ts`                               |       |
| Bestsellers API     | `__tests__/app/api/products/bestsellers/route.test.ts`                        |       |
| Reviews API         | `__tests__/app/api/reviews/route.test.ts`                                     |       |
| Share API           | `__tests__/app/api/share/route.test.ts`                                       |       |
| Upload API          | `__tests__/app/api/upload/route.test.ts`                                      |       |
| Admin orders API    | `__tests__/app/api/admin/orders/route.test.ts`                                |       |
| Admin orders [id]   | `__tests__/app/api/admin/orders/[id]/route.test.ts`                           |       |
| Admin products API  | `__tests__/app/api/admin/products/route.test.ts`                              |       |
| Admin products [id] | `__tests__/app/api/admin/products/[id]/route.test.ts`                         |       |
| Admin variations    | `__tests__/app/api/admin/products/[id]/variations/route.test.ts`              |       |
| Admin var soft-del  | `__tests__/app/api/admin/products/[id]/variations/soft-delete-orders.test.ts` |       |
| Admin users API     | `__tests__/app/api/admin/users/route.test.ts`                                 |       |
| Admin users [id]    | `__tests__/app/api/admin/users/[id]/route.test.ts`                            |       |
| Admin reviews API   | `__tests__/app/api/admin/reviews/route.test.ts`                               |       |
| Admin sales API     | `__tests__/app/api/admin/sales/route.test.ts`                                 |       |
| Admin email-fail    | `__tests__/app/api/admin/email-failures/route.test.ts`                        |       |
| **Total**           | **87 test files**                                                             |       |

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

- **Development**: HTTPS redirect disabled (localhost doesn't have SSL)
- **Production**: Auto-redirects HTTP → HTTPS via proxy
- **NEXTAUTH_URL**: Must use `https://` in production (set in `.env.production`)
- **Strict-Transport-Security**: Enabled for 1 year (max-age=31536000)
- **Proxy**: `proxy.ts` enforces HTTPS in production only
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

- `app/error.tsx` - Global error boundary
- `app/products/error.tsx` - Products section error handling
- `app/orders/error.tsx` - Orders section error handling
- `app/cart/error.tsx` - Cart section error handling
- `app/admin/error.tsx` - Admin section error handling

### Loading States

- `app/loading.tsx` - Global loading skeleton
- `app/products/loading.tsx` - Products listing skeleton
- `app/products/[id]/loading.tsx` - Product detail skeleton

### Component Props Pattern

Always use readonly interfaces for component props:

```typescript
interface MyComponentProps {
  readonly data: Data;
  readonly onAction?: () => void;
}

export default function MyComponent({ data, onAction }: MyComponentProps) {
  // ...
}
```

## Environment Variable Validation

Environment variables are validated at startup using `lib/env.ts`:

- `DATABASE_URL` - Required PostgreSQL connection string
- `REDIS_URL` - Optional Redis URL (defaults to localhost:6379)
- `NODE_ENV` - Optional (development/production/test)

Import validated env vars:

```typescript
import { env } from "@/lib/env";
console.log(env.DATABASE_URL); // Typed and validated
```

## API Route Patterns

### Auth Status Codes

- `401 Unauthorized` - User is not authenticated (no session)
- `403 Forbidden` - User is authenticated but lacks permission

### Input Validation

Always use Zod schemas for request body validation:

```typescript
import { AddToCartSchema } from "@/lib/validations";
import { apiError, handleValidationError } from "@/lib/api-utils";

export async function POST(request: NextRequest) {
  const body = await request.json();
  const parseResult = AddToCartSchema.safeParse(body);
  if (!parseResult.success) {
    return handleValidationError(parseResult.error);
  }
  const validated = parseResult.data;
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
