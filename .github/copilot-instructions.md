# GitHub Copilot Instructions for E-commerce Project

## Project Overview

This is a highly scalable e-commerce website built with Next.js 16, TypeScript, PostgreSQL, Redis, and NextAuth for authentication. It's designed to run as serverless on-demand functions.

## Technology Stack

- **Framework**: Next.js 16 with App Router (TypeScript)
- **Database**: PostgreSQL with Drizzle ORM
- **State Management**: Redux Toolkit (cart, orders, admin slices)
- **Currency**: CurrencyContext with INR default, `useCurrency()` hook
- **Cache**: Redis (ioredis) with stampede prevention
- **Authentication**: NextAuth.js v5 with Google OAuth
- **Styling**: Tailwind CSS v4
- **Validation**: Zod for runtime type checking

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
- Check user role for admin routes
- Use `ProtectedRoute` component for protected pages
- Never expose sensitive data in client components

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
  ├── api/              # API routes
  ├── auth/             # Authentication pages
  ├── admin/            # Admin panel
  ├── products/         # Product pages
  └── page.tsx          # Home page
lib/
  ├── db.ts             # Drizzle client
  ├── schema.ts         # Drizzle schema
  ├── redis.ts          # Redis utilities
  ├── auth.ts           # NextAuth config
  ├── types.ts          # Type definitions
  ├── validations.ts    # Zod schemas
  ├── api-utils.ts      # API helpers
  ├── store.ts          # Redux store (cart, orders, admin)
  ├── hooks.ts          # Custom React hooks
  └── features/
      ├── cart/cartSlice.ts     # Cart state
      ├── orders/ordersSlice.ts # Orders state
      └── admin/adminSlice.ts   # Admin state (products, orders, users)
contexts/
  └── CurrencyContext.tsx # Currency context (INR default)
components/
  ├── layout/           # Layout components (Header, Footer, CartIcon)
  ├── ui/               # UI components (CurrencySelector, NewsletterForm, ErrorBoundary)
  ├── providers/        # StoreProvider, SessionProvider
  └── sections/         # Page sections (Hero, ProductGrid)
drizzle/
  └── *.sql             # Migration files
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

### State Management (Redux)

- Cart state: `lib/features/cart/cartSlice.ts`
- Orders state: `lib/features/orders/ordersSlice.ts`
- Admin state: `lib/features/admin/adminSlice.ts` (products, orders, users)
- Use `useSelector` + `useDispatch<AppDispatch>()` in client components
- Keep UI-only state (modals, forms) as local `useState`
- Use Redux for data shared across pages or fetched from APIs

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

This project implements several Next.js 15+ performance optimizations:

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
npm run build        # Build for production
npm run db:generate  # Generate Drizzle migrations
npm run db:migrate   # Apply migrations
npm run db:seed      # Seed database
```

## Testing Checklist

- [ ] API validation with invalid data
- [ ] Authentication flows
- [ ] Cache invalidation
- [ ] Error boundaries
- [ ] TypeScript type checking
- [ ] Database transactions
- [ ] Edge cases (out of stock, etc.)

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

- **Development**: HTTPS redirect enabled (HTTP → HTTPS) on localhost:3000
- **Production**: Auto-redirects HTTP → HTTPS via proxy
- **NEXTAUTH_URL**: Must use `https://` in production (set in `.env.production`)
- **Strict-Transport-Security**: Enabled for 1 year (max-age=31536000)
- **Proxy**: `proxy.ts` enforces HTTPS in both development and production
- **Vercel**: Automatically provides SSL certificate

**To Deploy with HTTPS:**

1. Set `NEXTAUTH_URL=https://your-domain.com` in production env vars
2. Proxy automatically redirects http → https
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
