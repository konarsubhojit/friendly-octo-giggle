# GitHub Copilot Instructions for E-commerce Project

## Project Overview
This is a highly scalable e-commerce website built with Next.js 16, TypeScript, PostgreSQL, Redis, and NextAuth for authentication. It's designed to run as serverless on-demand functions.

## Technology Stack
- **Framework**: Next.js 16 with App Router (TypeScript)
- **Database**: PostgreSQL with Prisma ORM v7
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

### Database (Prisma)
- Always use Prisma client from `lib/db.ts`
- Use transactions for multi-step operations
- Include relations when needed with `include`
- Use proper indexing in schema
- Convert DateTime to ISO string for API responses

```typescript
const result = await prisma.product.findMany({
  include: { orderItems: true },
  where: { stock: { gt: 0 } },
});
```

#### Database Migrations
- Use Prisma Migrate for all database schema changes
- Never modify the schema without creating a migration
- Always create descriptive migration names
- Test migrations in development before deploying

**Creating a Migration:**
```bash
# After modifying prisma/schema.prisma, create a migration
npm run db:migrate -- --name descriptive_migration_name

# This will:
# 1. Generate SQL migration files in prisma/migrations/
# 2. Apply the migration to your database
# 3. Update Prisma Client
```

**Migration Workflow:**
1. Modify `prisma/schema.prisma` with your changes
2. Run `npm run db:migrate -- --name your_change_description`
3. Review the generated SQL in `prisma/migrations/`
4. Test the migration in development
5. Commit both schema.prisma and migration files
6. In production, run `npx prisma migrate deploy`

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
  'cache:key',
  60, // TTL in seconds
  async () => await fetchFromDB(),
  10  // Stale time
);
```

### Authentication
- Use `auth()` from `lib/auth.ts` to get session
- Check user role for admin routes
- Use `ProtectedRoute` component for protected pages
- Never expose sensitive data in client components

```typescript
import { auth } from '@/lib/auth';

export default async function AdminPage() {
  const session = await auth();
  if (session?.user?.role !== 'ADMIN') {
    redirect('/');
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
  ├── db.ts             # Prisma client
  ├── redis.ts          # Redis utilities
  ├── auth.ts           # NextAuth config
  ├── types.ts          # Type definitions
  ├── validations.ts    # Zod schemas
  ├── api-utils.ts      # API helpers
  └── hooks.ts          # Custom React hooks
components/
  ├── ErrorBoundary.tsx # Error handling
  └── AuthComponents.tsx # Auth UI components
prisma/
  ├── schema.prisma     # Database schema
  └── seed.ts           # Seed data
```

## Common Patterns

### Creating a New API Endpoint
1. Define Zod schema in `lib/validations.ts`
2. Create route in `app/api/[name]/route.ts`
3. Validate input with schema
4. Use Prisma for database operations
5. Handle errors properly
6. Return type-safe response

### Adding a New Feature
1. Update Prisma schema if needed
2. Run `npm run db:generate` and `npm run db:migrate`
3. Create types/validations
4. Implement API routes or Server Actions
5. Create UI components
6. Test thoroughly

### Performance Best Practices
- Cache frequently accessed data
- Use connection pooling (already configured)
- Minimize database queries
- Optimize images with Next.js Image
- Use proper indexes in Prisma schema
- Implement pagination for large datasets

## Commands Reference
```bash
npm run dev          # Start dev server
npm run build        # Build for production
npm run db:generate  # Generate Prisma client
npm run db:migrate   # Run migrations
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
- Use parameterized queries (Prisma does this)
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
