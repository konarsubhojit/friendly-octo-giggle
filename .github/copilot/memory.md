# Project Memory for GitHub Copilot

This file contains important facts about the project that Copilot should remember.

## Architecture Decisions

### Why Prisma 7 with Adapter?
- Prisma 7 requires either `adapter` or `accelerateUrl` in the client constructor
- Using `@prisma/adapter-pg` with `pg` for PostgreSQL connection
- This enables connection pooling for serverless environments
- Singleton pattern prevents connection exhaustion

### Why NextAuth v5 (Auth.js)?
- Modern authentication library with App Router support
- Better TypeScript support than v4
- Database session strategy for better security
- Integrated with Prisma adapter
- Supports multiple providers (we use Google)

### Why Zod for Validation?
- Runtime type checking complements TypeScript
- Type inference from schemas
- Better error messages than manual validation
- Single source of truth for types
- Works seamlessly with API routes and Server Actions

### Redis Caching Strategy
- **Stale-While-Revalidate (SWR)**: Serves cached data immediately while fetching fresh data in background
- **Stampede Prevention**: Distributed locks prevent multiple simultaneous cache misses
- **TTL**: Products cached for 60s with 10s stale window
- **Invalidation**: Automatic cache clearing on product/order updates
- **Singleton Client**: Prevents connection issues in serverless

## Code Conventions

### File Naming
- **Components**: PascalCase (e.g., `ErrorBoundary.tsx`)
- **Utilities**: kebab-case (e.g., `api-utils.ts`)
- **Pages**: lowercase (e.g., `page.tsx`, `[id]/page.tsx`)
- **Server Actions**: camelCase with `Action` suffix (e.g., `createOrderAction`)

### Import Aliases
- `@/` maps to root directory
- Use absolute imports: `import { prisma } from '@/lib/db'`
- Never use relative imports crossing directories

### TypeScript Patterns
- **Types**: Define in `lib/types.ts` or infer from Zod schemas
- **Enums**: Use string unions or Zod enums
- **Async Results**: Return `AsyncResult<T>` type for better error handling
- **Generics**: Use for reusable utilities (hooks, API wrappers)

## Database Schema Patterns

### ID Strategy
- All IDs use `cuid()` for better distributed system compatibility
- More collision-resistant than UUIDs
- Shorter and more readable

### Timestamps
- Every model has `createdAt` and `updatedAt`
- Use `@default(now())` and `@updatedAt`
- Convert to ISO strings for API responses

### Relations
- Always add `@@index` for foreign keys
- Use `onDelete: Cascade` for dependent records
- Name relations clearly (user, product, order)

### Enums
- Use Prisma enums for fixed sets of values
- Keep enum names descriptive (OrderStatus, UserRole)

## API Response Format

### Success Response
```typescript
{
  success: true,
  data: { ...actual data }
}
```

### Error Response
```typescript
{
  success: false,
  error: "Error message",
  details: { field: "validation error" } // optional
}
```

### Why This Format?
- Consistent across all endpoints
- Easy to check success client-side
- TypeScript type guards work well
- Detailed validation errors

## Authentication Flow

1. User clicks "Sign in with Google"
2. NextAuth redirects to Google OAuth
3. User authorizes, Google redirects back
4. NextAuth creates/updates user in database
5. Session stored in database (not JWT)
6. Session cookie sent to client
7. Server checks session on protected routes

### Session Structure
```typescript
{
  user: {
    id: string,
    name: string,
    email: string,
    image: string,
    role: 'ADMIN' | 'CUSTOMER'
  }
}
```

## Caching Strategy Details

### What to Cache
- Product listings (high read, low write)
- Individual product details
- Public data only (never user-specific)

### What NOT to Cache
- Order data (privacy concern)
- User sessions (already in database)
- Admin data (always fresh)
- Authentication responses

### Cache Keys Pattern
- `products:all` - All products list
- `product:{id}` - Single product
- Use wildcards for bulk invalidation: `products:*`

## Common Gotchas

### Prisma Client Generation
- Must run `npm run db:generate` after schema changes
- In production, runs automatically during build
- Don't commit generated client to git

### Server Components vs Client
- Default to Server Components
- Only use 'use client' for:
  - React hooks (useState, useEffect, etc.)
  - Browser APIs (localStorage, etc.)
  - Event handlers
  - Context consumers

### NextAuth Session
- Use `auth()` in Server Components
- Use `useSession()` in Client Components  
- Session is database-backed, not JWT
- Always check for null session

### Environment Variables
- Client-side vars must start with `NEXT_PUBLIC_`
- Server-only vars don't need prefix
- Validate with Zod on startup
- Never commit .env to git

## Performance Considerations

### Serverless Constraints
- Connection pooling is critical
- Cold starts affect first request
- Stateless by design
- Use singletons for DB/Redis clients

### Database Best Practices
- Use indexes on frequently queried fields
- Limit SELECT fields when possible
- Use transactions for multi-step operations
- Avoid N+1 queries with `include`

### Caching Best Practices
- Cache at API level, not component level
- Use appropriate TTL (60s is good default)
- Always implement stampede prevention
- Invalidate aggressively on writes

## Security Principles

### Input Validation
1. Validate on server (Zod schemas)
2. Never trust client input
3. Validate before database operations
4. Return helpful but not revealing errors

### Authentication
- Check session on every protected route
- Check role for admin operations
- Use secure session storage (database)
- Implement CSRF protection (NextAuth does this)

### Data Access
- Users can only see their own orders
- Admins can see all data
- Never expose sensitive data in client
- Filter data based on user role

## Troubleshooting Guide

### Build Fails
1. Check TypeScript errors first
2. Verify Prisma client is generated
3. Check environment variables exist
4. Run `npm run db:generate`

### Database Connection Issues
1. Verify DATABASE_URL format
2. Check database is running
3. Verify network access
4. Check connection pooling config

### Authentication Not Working
1. Verify Google OAuth credentials
2. Check NEXTAUTH_SECRET is set
3. Verify callback URLs match
4. Check database has auth tables

### Cache Not Working
1. Verify Redis connection
2. Check REDIS_URL format
3. Test Redis independently
4. Check cache key patterns

## Future Enhancements Ideas

- [ ] Add email notifications for orders
- [ ] Implement payment processing (Stripe)
- [ ] Add product reviews and ratings
- [ ] Implement inventory alerts
- [ ] Add analytics dashboard
- [ ] Support multiple currencies
- [ ] Add wish list functionality
- [ ] Implement product search
- [ ] Add order tracking
- [ ] Support bulk product imports

## Key Metrics to Monitor

- Cache hit rate (aim for >80%)
- API response times (<200ms)
- Database query times (<50ms)
- Cold start duration (<1s)
- Error rates (<1%)
- Authentication success rate (>95%)

## Useful Commands

```bash
# Development
npm run dev                    # Start dev server
npm run build                  # Test production build
npm run db:generate            # Generate Prisma client

# Database
npm run db:migrate             # Create and run migration
npm run db:seed                # Seed database
npx prisma studio              # Open Prisma GUI

# Testing
npm run lint                   # Run linter
npm run type-check             # Check TypeScript (if added)

# Production
npm run build                  # Build for production
npm run start                  # Start production server
```

## Dependencies to Keep Updated

- next (framework updates)
- @prisma/client (bug fixes)
- next-auth (security patches)
- tailwindcss (new features)
- zod (validation improvements)

## Version Compatibility

- Node.js: 18+
- Next.js: 16.x
- Prisma: 7.x
- NextAuth: 5.x (beta)
- React: 19.x

## References

- [Next.js Docs](https://nextjs.org/docs)
- [Prisma Docs](https://www.prisma.io/docs)
- [NextAuth Docs](https://authjs.dev/)
- [Zod Docs](https://zod.dev/)
- [Tailwind Docs](https://tailwindcss.com/docs)
