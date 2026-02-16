# Troubleshooting Guide

Comprehensive troubleshooting guide for common issues, errors, and solutions.

## Table of Contents

1. [Common Setup Issues](#common-setup-issues)
2. [Database Issues](#database-issues)
3. [Redis Issues](#redis-issues)
4. [Authentication Issues](#authentication-issues)
5. [Build Errors](#build-errors)
6. [Runtime Errors](#runtime-errors)
7. [Performance Issues](#performance-issues)
8. [Deployment Issues](#deployment-issues)
9. [Monitoring & Debugging](#monitoring--debugging)
10. [Security Issues](#security-issues)

---

## Common Setup Issues

### Environment Variables Not Loaded

**Symptoms:**
```
Error: Environment variable DATABASE_URL is not set
```

**Solutions:**
1. Create `.env.local` from `.env.example`:
   ```bash
   cp .env.example .env.local
   ```

2. Verify file exists and has correct values:
   ```bash
   cat .env.local
   ```

3. Restart dev server:
   ```bash
   npm run dev
   ```

### Dependencies Installation Failed

**Symptoms:**
```
npm ERR! code ERESOLVE
npm ERR! ERESOLVE unable to resolve dependency tree
```

**Solutions:**
1. Clear npm cache:
   ```bash
   rm -rf node_modules package-lock.json
   npm cache clean --force
   npm install
   ```

2. Use correct Node.js version (18.x or higher):
   ```bash
   node --version  # Should be >= 18.0.0
   ```

3. Try legacy peer deps:
   ```bash
   npm install --legacy-peer-deps
   ```

### Port Already in Use

**Symptoms:**
```
Error: listen EADDRINUSE: address already in use :::3000
```

**Solutions:**
1. Kill process on port 3000:
   ```bash
   # Linux/Mac
   lsof -ti:3000 | xargs kill -9
   
   # Windows
   netstat -ano | findstr :3000
   taskkill /PID <PID> /F
   ```

2. Use different port:
   ```bash
   PORT=3001 npm run dev
   ```

---

## Database Issues

### SSL Certificate Error

**Symptoms:**
```
Error opening a TLS connection: self-signed certificate in certificate chain
Error: self-signed certificate in certificate chain
SELF_SIGNED_CERT_IN_CHAIN
Error fetching products from database
Unable to signin
```

**Root Cause:**
PostgreSQL databases (especially Neon, Supabase, Railway) use self-signed SSL certificates that Node.js rejects by default. The pg.Pool client needs explicit SSL configuration to accept self-signed certificates.

**Solutions:**

**Option 1: Accept Self-Signed Certificates (Recommended)**
The app now automatically accepts self-signed certificates. The `lib/db.ts` file has enhanced SSL configuration:
```typescript
function createPool() {
  const connectionString = process.env.DATABASE_URL || '';
  const isSSL = !connectionString.includes('sslmode=disable') && !connectionString.includes('localhost');
  
  const sslConfig = isSSL
    ? {
        rejectUnauthorized: false,
        checkServerIdentity: () => undefined,
      }
    : false;
  
  return new pg.Pool({
    connectionString,
    ssl: sslConfig,
    connectionTimeoutMillis: 10000,
    idleTimeoutMillis: 30000,
  });
}
```

Just use a standard connection string:
```bash
DATABASE_URL=postgresql://user:pass@host:5432/db?schema=public
```

**Option 2: Disable SSL Completely (Local Development Only)**
```bash
DATABASE_URL=postgresql://user:pass@localhost:5432/db?schema=public&sslmode=disable
```

**Option 3: Verify Configuration**
Check that `lib/db.ts` has the enhanced SSL configuration shown above with:
- `rejectUnauthorized: false` - Accepts self-signed certificates
- `checkServerIdentity: () => undefined` - Explicitly bypasses certificate validation
- Connection timeouts - Improves reliability in serverless environments

**Key Points:**
- `checkServerIdentity: () => undefined` is **required** for managed PostgreSQL services (Neon, Supabase, Railway) in serverless environments
- For production with proper CA certificates, you can remove `checkServerIdentity` and set `rejectUnauthorized: true`
- This configuration fixes database connection errors for both data fetching and authentication

**Testing:**
```bash
# Test connection
npm run build

# Should see: Build succeeded (no SSL errors)
```

### Connection Timeout

**Symptoms:**
```
Error: Connection timeout
P1001: Can't reach database server at `host:5432`
```

**Solutions:**

1. **Verify database is running:**
   ```bash
   psql "$DATABASE_URL"
   ```

2. **Check network connectivity:**
   ```bash
   # Test connection
   telnet host 5432
   ```

3. **Verify credentials:**
   ```bash
   echo $DATABASE_URL
   # Should show: postgresql://user:pass@host:5432/db
   ```

4. **Check firewall/VPC settings:**
   - Allow incoming connections on port 5432
   - Add your IP to allowlist (cloud providers)
   - Verify database is not paused (Neon, etc.)

### Migration Failures

**Symptoms:**
```
Error: P3006: Migration failed to apply
Error: relation "Product" already exists
```

**Solutions:**

1. **Reset database (development only):**
   ```bash
   npx prisma migrate reset
   npx prisma db push
   npm run db:seed
   ```

2. **Check migration status:**
   ```bash
   npx prisma migrate status
   ```

3. **Resolve migration conflicts:**
   ```bash
   # Mark migrations as applied
   npx prisma migrate resolve --applied "migration_name"
   
   # Or rollback
   npx prisma migrate resolve --rolled-back "migration_name"
   ```

4. **Production migration:**
   ```bash
   npx prisma migrate deploy
   ```

### "Too Many Connections" Error

**Symptoms:**
```
Error: P1001: Too many connections
remaining connection slots are reserved
```

**Solutions:**

1. **Connection pooling is already configured** in `lib/db.ts`:
   ```typescript
   const pool = new pg.Pool({
     connectionString: process.env.DATABASE_URL,
     max: 10, // Maximum connections
   });
   ```

2. **Close unused connections:**
   ```bash
   # PostgreSQL
   SELECT pg_terminate_backend(pid) 
   FROM pg_stat_activity 
   WHERE datname = 'your_db' AND pid <> pg_backend_pid();
   ```

3. **Use external connection pooler:**
   - Neon: Built-in pooling
   - Supabase: Use pooled connection string
   - PgBouncer: Self-hosted pooling

---

## Redis Issues

### Connection Failed

**Symptoms:**
```
Error: REDIS_URL environment variable is not set
Error: connect ECONNREFUSED 127.0.0.1:6379
```

**Solutions:**

1. **Set REDIS_URL:**
   ```bash
   # .env.local
   REDIS_URL=redis://localhost:6379
   
   # Or Upstash (recommended for serverless)
   REDIS_URL=rediss://default:token@host:port
   ```

2. **Start local Redis:**
   ```bash
   # macOS
   brew services start redis
   
   # Linux
   sudo systemctl start redis
   
   # Docker
   docker run -d -p 6379:6379 redis:alpine
   ```

3. **Verify Redis is running:**
   ```bash
   redis-cli ping
   # Should return: PONG
   ```

### Cache Not Working

**Symptoms:**
- Slow response times
- No cache hits in logs
- Data always fetched from database

**Solutions:**

1. **Check Redis logs:**
   ```bash
   # Enable debug logging
   LOG_LEVEL=debug npm run dev
   
   # Look for cache operations
   # Should see: "Cache hit", "Cache miss", etc.
   ```

2. **Verify cache function usage:**
   ```typescript
   // Correct usage
   const data = await getCachedData('key', 60, async () => {
     return await fetchData();
   });
   ```

3. **Clear cache manually:**
   ```bash
   redis-cli FLUSHDB
   ```

4. **Check TTL settings:**
   ```typescript
   // TTL in seconds (not milliseconds)
   await getCachedData('key', 60, fetcher); // 60 seconds
   ```

### Redis Memory Issues

**Symptoms:**
```
Error: OOM command not allowed when used memory > 'maxmemory'
```

**Solutions:**

1. **Check memory usage:**
   ```bash
   redis-cli INFO memory
   ```

2. **Set eviction policy:**
   ```bash
   redis-cli CONFIG SET maxmemory-policy allkeys-lru
   ```

3. **Increase memory limit** (if self-hosted):
   ```bash
   redis-cli CONFIG SET maxmemory 256mb
   ```

4. **Use Upstash** (auto-scaling for serverless):
   - Automatic memory management
   - Per-request pricing
   - No connection limits

---

## Authentication Issues

### Google OAuth Error: Redirect URI Mismatch

**Symptoms:**
```
Error 400: redirect_uri_mismatch
The redirect URI in the request does not match
```

**Solutions:**

1. **Add authorized redirect URIs in Google Cloud Console:**
   ```
   Development:
   http://localhost:3000/api/auth/callback/google
   
   Production:
   https://yourdomain.com/api/auth/callback/google
   ```

2. **Verify NEXTAUTH_URL:**
   ```bash
   # .env.local
   NEXTAUTH_URL=http://localhost:3000
   
   # Production
   NEXTAUTH_URL=https://yourdomain.com
   ```

3. **Clear browser cookies** and try again.

### "NEXTAUTH_SECRET is not set"

**Symptoms:**
```
Error: Please define NEXTAUTH_SECRET environment variable
```

**Solutions:**

1. **Generate secret:**
   ```bash
   openssl rand -base64 32
   ```

2. **Add to .env.local:**
   ```bash
   NEXTAUTH_SECRET=your-generated-secret-here
   ```

3. **Restart server:**
   ```bash
   npm run dev
   ```

### Session Expired Prematurely

**Symptoms:**
- User logged out unexpectedly
- "Session expired" errors in logs

**Solutions:**

1. **Check session logs:**
   ```bash
   # Look for session_expired events
   grep "session_expired" logs/*.log
   ```

2. **Verify database sessions table:**
   ```sql
   SELECT * FROM "Session" WHERE expires < NOW();
   ```

3. **Increase session duration** in `lib/auth.ts`:
   ```typescript
   session: {
     maxAge: 30 * 24 * 60 * 60, // 30 days
   }
   ```

### "Invalid Credentials" Error

**Symptoms:**
```
Error: Sign in failed
Credentials do not match our records
```

**Solutions:**

1. **Verify Google OAuth credentials:**
   ```bash
   echo $GOOGLE_CLIENT_ID
   echo $GOOGLE_CLIENT_SECRET
   ```

2. **Check Google Cloud Console:**
   - OAuth 2.0 Client ID is active
   - Authorized domains include your domain
   - OAuth consent screen is configured

3. **Clear auth tables and retry:**
   ```sql
   TRUNCATE TABLE "Account", "Session" CASCADE;
   ```

### "Authentication required to place orders"

**Symptoms:**
```
POST /api/orders 401 Unauthorized
Error: Authentication required. Please sign in to place orders.
```

**Root Cause:**
As of the latest update, customers must be authenticated to place orders. This ensures:
- Orders are linked to user accounts
- Better order tracking and history
- Improved security and fraud prevention

**Solutions:**

1. **Sign in before checkout:**
   - Users are automatically redirected to sign-in page when accessing cart
   - After sign-in, they're redirected back to cart
   - User info (name, email) is auto-filled from session

2. **Verify session is active:**
   ```typescript
   // Check if user is authenticated
   const { data: session } = useSession();
   if (!session?.user) {
     // Redirect to sign-in
     router.push('/auth/signin?callbackUrl=/cart');
   }
   ```

3. **SessionProvider is configured:**
   - Root layout must wrap children with `<SessionProvider>`
   - This enables `useSession()` hook throughout the app
   ```typescript
   // app/layout.tsx
   <SessionProvider>{children}</SessionProvider>
   ```

4. **Order API authentication check:**
   The `/api/orders` endpoint now requires authentication:
   ```typescript
   const session = await auth();
   if (!session?.user) {
     return NextResponse.json(
       { error: 'Authentication required' },
       { status: 401 }
     );
   }
   ```

**Testing:**
```bash
# 1. Try to access cart without auth (should redirect to sign-in)
curl http://localhost:3000/cart

# 2. Sign in via Google OAuth
# 3. Access cart (should show user info and order form)
# 4. Place order (should succeed with userId linked)
```

---

## Build Errors

### TypeScript Errors

**Symptoms:**
```
Type error: Property 'X' does not exist on type 'Y'
TS2339: Property does not exist
```

**Solutions:**

1. **Check type definitions:**
   ```bash
   # Regenerate Prisma types
   npx prisma generate
   ```

2. **Clear TypeScript cache:**
   ```bash
   rm -rf .next
   rm -rf node_modules/.cache
   npm run build
   ```

3. **Verify tsconfig.json paths:**
   ```json
   {
     "compilerOptions": {
       "paths": {
         "@/*": ["./*"]
       }
     }
   }
   ```

### Next.js Build Failed

**Symptoms:**
```
Error: Build failed with exit code 1
Failed to compile
```

**Solutions:**

1. **Check build logs:**
   ```bash
   npm run build 2>&1 | tee build.log
   ```

2. **Common fixes:**
   ```bash
   # Clear cache
   rm -rf .next
   
   # Reinstall dependencies
   rm -rf node_modules
   npm install
   
   # Rebuild
   npm run build
   ```

3. **Static generation errors:**
   - Check `generateStaticParams()` functions
   - Add try-catch for database calls
   - See: DATABASE_SSL_FIX.md

### Dependency Version Conflicts

**Symptoms:**
```
npm ERR! peer dependency conflict
Could not resolve dependency
```

**Solutions:**

1. **Check package.json versions:**
   ```json
   {
     "dependencies": {
       "next": "^16.1.6",
       "react": "^19.2.4"
     }
   }
   ```

2. **Update dependencies:**
   ```bash
   npm update
   npm audit fix
   ```

3. **Use npm overrides** if needed:
   ```json
   {
     "overrides": {
       "package-name": "version"
     }
   }
   ```

---

## Runtime Errors

### API Route 500 Errors

**Symptoms:**
```
POST /api/products 500 Internal Server Error
Error: Unexpected error in API handler
```

**Solutions:**

1. **Check server logs:**
   ```bash
   # Development
   npm run dev
   # Look for error stack traces
   
   # Production
   # Check Vercel logs or server logs
   ```

2. **Enable debug logging:**
   ```bash
   LOG_LEVEL=debug npm run dev
   ```

3. **Common causes:**
   - Missing environment variables
   - Database connection failed
   - Invalid request body
   - Unhandled exceptions

4. **Add error handling:**
   ```typescript
   try {
     // Your code
   } catch (error) {
     logError({ error, context: 'api_route' });
     return NextResponse.json(
       { error: 'Internal server error' },
       { status: 500 }
     );
   }
   ```

### Component Hydration Errors

**Symptoms:**
```
Error: Hydration failed
Text content does not match server-rendered HTML
```

**Solutions:**

1. **Check for dynamic content:**
   ```typescript
   // ❌ Bad: Uses Date.now() on server and client
   <div>{Date.now()}</div>
   
   // ✅ Good: Client-side only
   <div suppressHydrationWarning>{Date.now()}</div>
   ```

2. **Use useEffect for client-only code:**
   ```typescript
   const [mounted, setMounted] = useState(false);
   useEffect(() => setMounted(true), []);
   if (!mounted) return null;
   ```

3. **Check localStorage/sessionStorage:**
   ```typescript
   // Only access on client
   const data = typeof window !== 'undefined' 
     ? localStorage.getItem('key')
     : null;
   ```

### Image Upload Failures

**Symptoms:**
```
Error: Blob upload failed
Failed to upload image
```

**Solutions:**

1. **Verify Vercel Blob token:**
   ```bash
   echo $BLOB_READ_WRITE_TOKEN
   ```

2. **Check file size limits** (Vercel Blob: 4.5MB):
   ```typescript
   if (file.size > 4.5 * 1024 * 1024) {
     return { error: 'File too large' };
   }
   ```

3. **Verify content type:**
   ```typescript
   const validTypes = ['image/jpeg', 'image/png', 'image/webp'];
   if (!validTypes.includes(file.type)) {
     return { error: 'Invalid file type' };
   }
   ```

---

## Performance Issues

### Slow Database Queries

**Symptoms:**
```
WARN: Slow query detected: 2500ms
Database operation took too long
```

**Solutions:**

1. **Check query logs:**
   ```bash
   # Look for slow query warnings
   grep "Slow query" logs/*.log
   ```

2. **Add database indexes:**
   ```prisma
   model Product {
     id    String @id
     name  String
     price Float
     
     @@index([name])
     @@index([price])
   }
   ```

3. **Use query optimization:**
   ```typescript
   // ❌ Bad: N+1 queries
   const products = await db.products.findMany();
   for (const p of products) {
     const reviews = await db.reviews.findMany({ where: { productId: p.id } });
   }
   
   // ✅ Good: Single query with include
   const products = await db.products.findMany({
     include: { reviews: true }
   });
   ```

4. **Implement caching:**
   ```typescript
   const products = await getCachedData('products:all', 60, async () => {
     return await db.products.findMany();
   });
   ```

### High Memory Usage

**Symptoms:**
```
FATAL ERROR: Reached heap limit
JavaScript heap out of memory
```

**Solutions:**

1. **Increase Node.js memory:**
   ```bash
   NODE_OPTIONS="--max-old-space-size=4096" npm run dev
   ```

2. **Check for memory leaks:**
   ```typescript
   // Close database connections
   await prisma.$disconnect();
   
   // Clear large arrays
   largeArray.length = 0;
   ```

3. **Stream large responses:**
   ```typescript
   // Instead of loading all at once
   const stream = db.products.findMany().stream();
   ```

4. **Use pagination:**
   ```typescript
   const products = await db.products.findMany({
     take: 20,
     skip: page * 20,
   });
   ```

### Slow Page Loads

**Symptoms:**
- First page load > 3 seconds
- TTI (Time to Interactive) high

**Solutions:**

1. **Enable caching:**
   - Redis for data caching
   - Next.js static generation
   - CDN for assets

2. **Optimize images:**
   ```typescript
   <Image 
     src="/product.jpg"
     alt="Product"
     width={500}
     height={500}
     priority // Above the fold
   />
   ```

3. **Use loading states:**
   ```typescript
   <Suspense fallback={<LoadingSpinner />}>
     <ProductList />
   </Suspense>
   ```

4. **Reduce JavaScript bundle:**
   ```bash
   npm run build
   # Check bundle sizes
   ```

---

## Deployment Issues

### Vercel Build Failures

**Symptoms:**
```
Error: Build failed on Vercel
Command "npm run build" exited with 1
```

**Solutions:**

1. **Check environment variables:**
   - Vercel Dashboard → Settings → Environment Variables
   - Add all variables from .env.example
   - Include DATABASE_URL, REDIS_URL, etc.

2. **Enable build logs:**
   - Vercel Dashboard → Deployments → View Logs
   - Look for specific error messages

3. **Test build locally:**
   ```bash
   npm run build
   # Should succeed locally first
   ```

4. **Common issues:**
   - Missing DATABASE_URL (build can succeed without it)
   - TypeScript errors (fix in development)
   - Missing dependencies (add to package.json)

### Database Connection in Serverless

**Symptoms:**
```
Error: Too many database connections
Connection pool exhausted
```

**Solutions:**

1. **Connection pooling configured** in `lib/db.ts`:
   ```typescript
   const pool = new pg.Pool({
     connectionString: process.env.DATABASE_URL,
     max: 10,
   });
   ```

2. **Use external pooler:**
   - Neon: Pooled connection string
   - Supabase: Transaction mode
   - PgBouncer: Self-hosted

3. **Prisma acceleration:**
   ```bash
   # Add to schema.prisma
   generator client {
     provider = "prisma-client-js"
     previewFeatures = ["driverAdapters"]
   }
   ```

### Cold Start Issues

**Symptoms:**
- First request slow (>5 seconds)
- Timeout on initial load

**Solutions:**

1. **Already optimized:**
   - Lazy Redis connection
   - Connection pooling
   - Minimal bundle size

2. **Warm-up endpoints:**
   ```bash
   # Cron job to ping API
   curl https://yourdomain.com/api/health
   ```

3. **Use edge runtime** where possible:
   ```typescript
   export const runtime = 'edge';
   ```

---

## Monitoring & Debugging

### Enable Debug Logging

```bash
# Development
LOG_LEVEL=debug npm run dev

# Production (Vercel)
LOG_LEVEL=debug in environment variables
```

### View Logs

**Development:**
```bash
# Console output with colors
npm run dev
```

**Production (Vercel):**
1. Dashboard → Your Project → Logs
2. Filter by level: error, warn, info
3. Search by request ID or user ID

### Request Tracing

Each request has unique ID in header:
```bash
curl -I https://yourdomain.com/api/products
# X-Request-ID: req_1234567890_abc123
```

Search logs:
```bash
grep "req_1234567890_abc123" logs/*.log
```

### Performance Monitoring

**Check slow operations:**
```bash
grep "Slow" logs/*.log
# Shows: Slow query detected, Slow operation, etc.
```

**Database metrics:**
```bash
grep "database_operation" logs/*.log | grep "duration"
```

**Cache hit rate:**
```bash
grep "cache_operation" logs/*.log | grep -c "hit"
grep "cache_operation" logs/*.log | grep -c "miss"
```

### Health Checks

```bash
# API health
curl https://yourdomain.com/api/health

# Database connection
curl https://yourdomain.com/api/health/db

# Redis connection  
curl https://yourdomain.com/api/health/redis
```

---

## Security Issues

### Exposed Secrets

**Problem:**
Committed secrets to Git repository.

**Solutions:**

1. **Remove from Git history:**
   ```bash
   git filter-branch --force --index-filter \
     "git rm --cached --ignore-unmatch .env.local" \
     --prune-empty --tag-name-filter cat -- --all
   ```

2. **Rotate all secrets immediately:**
   - Database credentials
   - API keys
   - OAuth credentials
   - NEXTAUTH_SECRET

3. **Use .gitignore:**
   ```
   .env.local
   .env*.local
   ```

### SQL Injection Prevention

**Already protected** by Prisma ORM:
```typescript
// ✅ Safe: Parameterized queries
await db.products.findMany({
  where: { name: userInput }
});

// ❌ Never use raw SQL with user input
await db.$queryRaw`SELECT * FROM products WHERE name = ${userInput}`;
```

### XSS Protection

**React automatically escapes** HTML:
```typescript
// ✅ Safe
<div>{userInput}</div>

// ❌ Dangerous
<div dangerouslySetInnerHTML={{ __html: userInput }} />
```

### CSRF Protection

**NextAuth provides CSRF tokens** automatically. No action needed.

### Rate Limiting

**Not implemented by default.** Consider adding:

```typescript
// Example: Simple rate limiting
const requests = new Map<string, number>();

export function rateLimit(ip: string, limit = 100) {
  const count = requests.get(ip) || 0;
  if (count >= limit) {
    throw new Error('Rate limit exceeded');
  }
  requests.set(ip, count + 1);
  setTimeout(() => requests.delete(ip), 60000); // Reset after 1 min
}
```

---

## Quick Reference

### Essential Commands

```bash
# Development
npm run dev                  # Start dev server
npm run build               # Build for production
npm run start               # Start production server

# Database
npx prisma generate         # Generate Prisma client
npx prisma migrate dev      # Run migrations
npx prisma db push          # Push schema changes
npm run db:seed             # Seed database

# Troubleshooting
rm -rf .next                # Clear Next.js cache
rm -rf node_modules         # Clear dependencies
npm install                 # Reinstall
LOG_LEVEL=debug npm run dev # Debug logging
```

### Common Error Codes

- **P1001**: Can't reach database server
- **P1002**: Database timeout
- **P3006**: Migration failed
- **EADDRINUSE**: Port already in use
- **ECONNREFUSED**: Connection refused (database/Redis)
- **401**: Unauthorized (auth issue)
- **500**: Internal server error (check logs)

### Support Resources

- 📖 [Getting Started Guide](./getting-started.md)
- 📖 [Development Guide](./development.md)
- 📖 [Deployment Guide](./deployment.md)
- 📖 [API Reference](./api-reference.md)
- 📖 [Architecture Overview](./architecture.md)

### Still Need Help?

1. Check application logs (Vercel Dashboard or console)
2. Search logs by request ID or error message
3. Review related documentation files
4. Check GitHub issues for similar problems
5. Enable debug logging for detailed information

---

**Last Updated:** February 2025
