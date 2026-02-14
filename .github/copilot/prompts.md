# GitHub Copilot Prompts for E-commerce Project

This file contains reusable prompts for common tasks in this project.

## API Development

### Create a New API Endpoint
```
Create a new API endpoint at /api/[name] that:
- Validates input using Zod schema
- Uses Prisma for database operations
- Returns type-safe responses with apiSuccess/apiError
- Implements proper error handling
- Includes authentication check if needed
- Follows the pattern in lib/api-utils.ts
```

### Add Cache to Endpoint
```
Add Redis caching to the [endpoint] API route:
- Use getCachedData from lib/redis.ts
- Set TTL to [X] seconds with stale-while-revalidate
- Include stampede prevention
- Add cache invalidation on related mutations
```

## Database Operations

### Create New Model
```
Add a new Prisma model for [entity]:
- Include proper relations
- Add appropriate indexes
- Use cuid() for IDs
- Include createdAt and updatedAt timestamps
- Follow existing model patterns in schema.prisma
```

### Add Migration
```
Create a Prisma migration to:
- [describe changes]
- Ensure backward compatibility
- Include data migration if needed
- Update seed.ts if relevant
```

## Authentication & Authorization

### Protect Route with Auth
```
Add authentication to [route/component]:
- Check session with auth() from lib/auth.ts
- Redirect unauthenticated users to /auth/signin
- Check user role if admin access required
- Return proper error for unauthorized access
```

### Add Role-Based Access
```
Implement role-based access control for [feature]:
- Check user.role (ADMIN or CUSTOMER)
- Show/hide UI elements based on role
- Protect API routes with role checks
- Use ProtectedRoute component for pages
```

## UI Components

### Create Form Component
```
Create a form component for [entity]:
- Use 'use client' directive
- Implement useFormState hook for state management
- Use Zod for validation
- Show loading and error states
- Submit via Server Action or API route
- Include proper TypeScript types
```

### Add Loading State
```
Add loading and error states to [component]:
- Use Suspense for async data
- Show LoadingSpinner component
- Display ErrorDisplay for errors
- Include retry functionality
- Maintain type safety
```

## Server Actions

### Create Server Action
```
Create a Server Action for [operation]:
- Add to lib/actions.ts
- Use 'use server' directive
- Validate input with Zod
- Return AsyncResult type
- Call revalidatePath for cache invalidation
- Include error handling
```

### Convert API to Server Action
```
Convert [API route] to a Server Action:
- Move logic to lib/actions.ts
- Update client components to use the action
- Remove API route file
- Add optimistic updates if applicable
- Maintain type safety
```

## Testing & Validation

### Add Input Validation
```
Add Zod validation for [input]:
- Define schema in lib/validations.ts
- Export inferred TypeScript type
- Use in API route or Server Action
- Add custom error messages
- Handle validation errors properly
```

### Test Authentication Flow
```
Test the authentication flow for [feature]:
- Sign in with Google
- Access protected routes
- Test role-based access
- Verify session persistence
- Check token refresh
```

## Performance Optimization

### Optimize Database Query
```
Optimize the database query in [location]:
- Add proper indexes in Prisma schema
- Use select to fetch only needed fields
- Implement pagination if returning many records
- Add cursor-based pagination for infinite scroll
- Use include wisely for relations
```

### Add Pagination
```
Add pagination to [endpoint/component]:
- Accept page and pageSize parameters
- Return PaginatedResponse type
- Include total count and hasMore flag
- Implement cursor-based pagination for better performance
- Add loading states for page transitions
```

## Debugging & Troubleshooting

### Debug Cache Issues
```
Debug caching issue in [endpoint]:
- Check Redis connection
- Verify cache key format
- Test TTL and stale time
- Confirm invalidation on updates
- Log cache hits/misses
```

### Fix TypeScript Errors
```
Fix TypeScript errors in [file]:
- Check type definitions
- Verify Zod schema matches types
- Update Prisma client if schema changed
- Use type guards where needed
- Add proper null checks
```

## Deployment & DevOps

### Prepare for Deployment
```
Prepare [feature] for deployment:
- Run build locally to check for errors
- Test with production database
- Verify environment variables
- Check serverless compatibility
- Update documentation
```

### Add Environment Variable
```
Add new environment variable [NAME]:
- Update .env.example with description
- Add to Zod EnvSchema validation
- Document in README.md
- Update deployment guides
- Add to Vercel/platform dashboard
```

## Code Refactoring

### Extract Reusable Logic
```
Extract reusable logic from [component/function]:
- Create utility function in lib/
- Add proper TypeScript types
- Make it generic if applicable
- Add JSDoc comments
- Update references to use new utility
```

### Modernize Component
```
Modernize [component] with latest patterns:
- Convert to Server Component if possible
- Use Server Actions instead of API routes
- Implement Suspense boundaries
- Add error boundaries
- Improve TypeScript types
- Use modern hooks (useFormState, useOptimistic)
```

## Common Fixes

### Fix Build Error
```
I'm getting a build error: [error message]
Help me fix this by:
- Identifying the root cause
- Providing the fix
- Explaining why it happened
- Suggesting prevention for future
```

### Improve Error Handling
```
Improve error handling in [location]:
- Catch specific error types
- Provide user-friendly messages
- Log errors appropriately
- Return proper HTTP status codes
- Add error boundaries where needed
```

## Quick Reference

### Type-Safe API Call
```typescript
// From client component
const { data, error } = await safeFetch<Product>('/api/products/123');
if (error) handleError(error);
else processData(data);
```

### Server Action with Validation
```typescript
'use server'
export async function myAction(input: MyInput): Promise<AsyncResult<MyOutput>> {
  const validated = MySchema.parse(input);
  // ... logic
  return { success: true, data: result };
}
```

### Protected API Route
```typescript
export async function GET(request: NextRequest) {
  const session = await auth();
  if (!session || session.user.role !== 'ADMIN') {
    return apiError('Unauthorized', 401);
  }
  // ... logic
}
```
