# PostgreSQL SSL Certificate Fix

## Problem

The build process was failing with the following error:

```
Invalid `prisma.product.findMany()` invocation:
Error opening a TLS connection: self-signed certificate in certificate chain
```

This error occurred during the `generateStaticParams()` function call in `/products/[id]` page, which tries to pre-generate static pages for the top 10 products at build time.

## Root Cause

PostgreSQL databases often use self-signed SSL certificates, especially in:
- Development environments
- Cloud database providers (Neon, Supabase, etc.)
- Self-hosted databases without proper CA-signed certificates

By default, the `pg` (node-postgres) library validates SSL certificates and rejects self-signed ones, causing the connection to fail.

## Solution

### 1. SSL Configuration in `lib/db.ts`

Added SSL configuration to the PostgreSQL connection pool:

```typescript
function createPrismaClient() {
  const pool = new pg.Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: process.env.DATABASE_URL?.includes('sslmode=disable') 
      ? false 
      : { rejectUnauthorized: false },
  });
  const adapter = new PrismaPg(pool);
  return new PrismaClient({ adapter, log: ['error'] });
}
```

**How it works:**
- If the connection string includes `sslmode=disable`, SSL is completely disabled
- Otherwise, SSL is enabled but configured to accept self-signed certificates via `rejectUnauthorized: false`

### 2. Error Handling in `generateStaticParams()`

Added try-catch block to gracefully handle database connection errors during build:

```typescript
export async function generateStaticParams() {
  try {
    const products = await db.products.findAll({ limit: PRERENDERED_PRODUCTS_COUNT });
    return products.map((product) => ({ id: product.id }));
  } catch (error) {
    console.error('Error generating static params:', error);
    return [];
  }
}
```

**Benefits:**
- Build continues even if database is unavailable
- Pages are generated on-demand instead of at build time
- Useful for CI/CD environments where database might not be accessible

### 3. Documentation in `.env.example`

Added examples and notes for different SSL configurations:

```bash
# For local development without SSL
DATABASE_URL=postgresql://user:password@localhost:5432/ecommerce?schema=public&sslmode=disable

# For cloud databases with SSL
DATABASE_URL=postgresql://user:password@host:5432/ecommerce?schema=public
```

## Configuration Options

### Option 1: Accept Self-Signed Certificates (Default)

No changes needed. The default configuration now accepts self-signed certificates.

```bash
DATABASE_URL=postgresql://user:password@host:5432/ecommerce?schema=public
```

### Option 2: Disable SSL Completely

Add `sslmode=disable` to your connection string:

```bash
DATABASE_URL=postgresql://user:password@localhost:5432/ecommerce?schema=public&sslmode=disable
```

### Option 3: Use CA-Signed Certificate

If your database has a proper CA-signed certificate, you can modify `lib/db.ts` to remove `rejectUnauthorized: false`:

```typescript
ssl: process.env.DATABASE_URL?.includes('sslmode=disable') 
  ? false 
  : true,
```

## Security Considerations

### Development vs. Production

**Development:**
- Using `rejectUnauthorized: false` is acceptable
- Allows quick setup without certificate management
- Database is typically on localhost or trusted network

**Production:**
- Consider using proper CA-signed certificates
- Many cloud providers (AWS RDS, Google Cloud SQL) provide CA-signed certificates
- If using self-signed certificates, ensure database is on a private network

### Best Practices

1. **Never expose database publicly** - Use VPC, private networks, or firewall rules
2. **Use environment-specific configuration** - Different settings for dev/staging/prod
3. **Rotate credentials regularly** - Even with SSL, credentials should be rotated
4. **Monitor connections** - Log and alert on unusual connection patterns

## Testing

To verify the fix:

1. **With database available:**
   ```bash
   npm run build
   ```
   Should successfully pre-render product pages.

2. **Without database:**
   ```bash
   npm run build
   ```
   Should complete build with warning, pages generated on-demand.

3. **Local development:**
   ```bash
   npm run dev
   ```
   Should connect successfully and serve pages.

## Troubleshooting

### Still getting SSL errors?

1. **Check connection string format:**
   ```bash
   echo $DATABASE_URL
   ```

2. **Test connection with psql:**
   ```bash
   psql "$DATABASE_URL"
   ```

3. **Check SSL mode:**
   ```bash
   # Add sslmode to your connection string
   DATABASE_URL="...?sslmode=require"
   DATABASE_URL="...?sslmode=disable"
   ```

### Build still failing?

1. **Check DATABASE_URL is set:**
   ```bash
   npm run build
   ```
   Look for "DATABASE_URL=not set" in logs

2. **Check Prisma is generated:**
   ```bash
   npm run postinstall
   ```

3. **Clear Next.js cache:**
   ```bash
   rm -rf .next
   npm run build
   ```

## References

- [PostgreSQL SSL Modes](https://www.postgresql.org/docs/current/libpq-ssl.html)
- [node-postgres SSL](https://node-postgres.com/features/ssl)
- [Prisma Connection URLs](https://www.prisma.io/docs/reference/database-reference/connection-urls)
- [Next.js Static Generation](https://nextjs.org/docs/app/building-your-application/data-fetching/generating-static-params)

## Related Files

- `lib/db.ts` - Database connection configuration
- `app/products/[id]/page.tsx` - Product page with generateStaticParams
- `.env.example` - Environment variable documentation
- `prisma/schema.prisma` - Database schema
