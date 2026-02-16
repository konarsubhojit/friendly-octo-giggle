# Getting Started

Get the e-commerce platform running locally in minutes!

## Prerequisites

Before you begin, ensure you have:

- **Node.js 18+**: [Download here](https://nodejs.org/)
- **PostgreSQL**: Local installation or cloud service (Supabase, Neon, etc.)
- **Redis**: Local installation or Upstash account
- **Google Cloud Account**: For OAuth credentials

## Quick Start

### 1. Clone and Install

```bash
git clone https://github.com/konarsubhojit/friendly-octo-giggle.git
cd friendly-octo-giggle
npm install
```

### 2. Configure Environment

```bash
cp .env.example .env
```

Edit `.env` with your credentials:

```env
# PostgreSQL Database
DATABASE_URL=postgresql://user:password@localhost:5432/ecommerce?schema=public

# Redis Cache (get free at upstash.com)
REDIS_URL=redis://localhost:6379

# NextAuth Configuration
NEXTAUTH_SECRET=your-secret-here  # Generate: openssl rand -base64 32
NEXTAUTH_URL=http://localhost:3000

# Google OAuth Credentials
GOOGLE_CLIENT_ID=your-client-id.apps.googleusercontent.com
GOOGLE_CLIENT_SECRET=your-client-secret

# Vercel Blob (for image uploads)
BLOB_READ_WRITE_TOKEN=your-vercel-blob-token
```

### 3. Get Google OAuth Credentials

1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Create a new project or select existing one
3. Enable "Google+ API"
4. Navigate to "Credentials" → "Create Credentials" → "OAuth client ID"
5. Choose "Web application"
6. Add authorized redirect URI: `http://localhost:3000/api/auth/callback/google`
7. Copy Client ID and Client Secret to `.env`

For production, add your production domain:
```
https://your-domain.com/api/auth/callback/google
```

### 4. Set Up Database

```bash
# Generate Prisma Client
npm run db:generate

# Run migrations
npm run db:migrate

# Seed initial products
npm run db:seed
```

The seed script creates 6 sample products to get you started.

### 5. Start Development Server

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) in your browser.

## First-Time Setup

### Create Your First Admin User

After signing in with Google for the first time:

**Option 1: Using Prisma Studio (Recommended)**

```bash
npx prisma studio
```

1. Find your user in the `User` table
2. Change `role` field from `CUSTOMER` to `ADMIN`
3. Save changes
4. Sign out and sign in again

**Option 2: Using SQL**

```bash
psql $DATABASE_URL -c "UPDATE \"User\" SET role = 'ADMIN' WHERE email = 'your-email@example.com';"
```

### Verify Your Setup

1. **Homepage**: Browse products at http://localhost:3000
2. **Sign In**: Test Google OAuth authentication
3. **Product Details**: Click any product
4. **Admin Panel**: Manually navigate to http://localhost:3000/admin (no UI link - requires admin role)

## Testing the Application

### Customer Flow

1. Browse products on homepage
2. Click a product to view details
3. Sign in with Google
4. Select product variation (if available)
5. Add to cart or place order directly
6. Fill in shipping information
7. Submit order
8. Verify stock decreases

### Admin Flow

1. Sign in with Google (with admin role)
2. Manually type `/admin` in browser URL bar (no navigation link in UI)
3. **Products Tab**: Add, edit, or delete products
4. **Orders Tab**: View and update order statuses
5. **Users Tab**: Manage user roles

## Available Commands

### Development

```bash
npm run dev              # Start development server on :3000
npm run build            # Build for production
npm run start            # Start production server
npm run lint             # Run ESLint
```

### Database

```bash
npm run db:generate      # Generate Prisma Client
npm run db:migrate       # Run database migrations
npm run db:seed          # Seed test data
npx prisma studio        # Open database GUI
npx prisma format        # Format schema file
```

### Migrations

```bash
# Create a new migration
npm run db:migrate -- --name add_feature_name

# Apply pending migrations
npx prisma migrate deploy

# Reset database (WARNING: deletes all data)
npx prisma migrate reset
```

## Project Structure

```
friendly-octo-giggle/
├── app/                    # Next.js App Router
│   ├── admin/             # Admin panel pages
│   ├── api/               # API routes
│   ├── auth/              # Authentication pages
│   ├── cart/              # Shopping cart
│   ├── products/          # Product pages
│   └── page.tsx           # Homepage
├── components/            # React components
│   ├── layout/           # Header, Footer, Navigation
│   ├── sections/         # Hero, ProductGrid
│   └── ui/               # Reusable UI components
├── lib/                   # Utilities and configuration
│   ├── auth.ts           # NextAuth configuration
│   ├── db.ts             # Prisma client
│   ├── redis.ts          # Redis client
│   ├── logger.ts         # Logging utility
│   ├── types.ts          # TypeScript types
│   └── validations.ts    # Zod schemas
├── prisma/               # Database schema and migrations
│   ├── schema.prisma     # Database schema
│   ├── migrations/       # Migration files
│   └── seed.ts           # Seed data
├── docs/                 # Documentation
└── .env                  # Environment variables (not committed)
```

## Common Issues

### "DATABASE_URL not found"

**Cause**: Environment variables not loaded

**Solution**:
1. Ensure `.env` file exists in root directory
2. Verify `DATABASE_URL` is set correctly
3. Check PostgreSQL is running
4. Restart dev server

### "REDIS_URL not found"

**Cause**: Redis not configured

**Solution**:
1. Install Redis locally: `brew install redis` (Mac) or use Upstash
2. Start Redis: `redis-server`
3. Add `REDIS_URL` to `.env`
4. Test connection: `redis-cli ping` (should return "PONG")

### "Google OAuth error"

**Cause**: OAuth credentials incorrect or redirect URI mismatch

**Solution**:
1. Verify Client ID and Secret in `.env`
2. Check redirect URI is exactly: `http://localhost:3000/api/auth/callback/google`
3. Ensure Google+ API is enabled
4. Clear browser cookies and try again

### "Prisma Client not generated"

**Cause**: Prisma Client not built

**Solution**:
```bash
npm run db:generate
# Restart dev server
npm run dev
```

### "Build fails with SSL certificate error"

**Cause**: PostgreSQL SSL configuration

**Solution**:
The app automatically accepts self-signed certificates. If you need to disable SSL:
```env
DATABASE_URL=postgresql://...?sslmode=disable
```

See [Troubleshooting](./troubleshooting.md#database-ssl-issues) for more details.

### "Migration failed"

**Cause**: Database schema out of sync

**Solution**:
```bash
# Check migration status
npx prisma migrate status

# Apply pending migrations
npx prisma migrate deploy

# If stuck, reset (WARNING: deletes data)
npx prisma migrate reset
```

## Using the Admin Panel

**Note**: There are no UI navigation links to the admin panel. Access it by manually typing `/admin` in your browser's URL bar after signing in with an admin account.

### Add Products

1. Manually navigate to `/admin` in browser URL bar
2. Click "Products" tab
3. Click "Add Product" button
4. Fill in product details:
   - **Name**: e.g., "Wireless Mouse"
   - **Description**: Product description
   - **Price**: e.g., 29.99
   - **Stock**: e.g., 50
   - **Category**: e.g., "Electronics"
   - **Image**: Upload or use URL
5. Click "Save"

### Add Product Variations

Products can have multiple variations (e.g., colors, sizes):

1. Edit a product
2. Click "Add Variation"
3. Set variation details:
   - **Name**: e.g., "Blue" or "Large"
   - **Design Name**: e.g., "Classic Design"
   - **Price Modifier**: Additional cost (can be negative)
   - **Stock**: Variation-specific stock
   - **Image**: Optional variation image
4. Save product

### Manage Orders

1. Go to `/admin` (type in URL bar)
2. Click "Orders" tab
3. View order list with filters
4. Click an order to view details
5. Update order status:
   - **PENDING** → Order received
   - **PROCESSING** → Order being prepared
   - **SHIPPED** → Order dispatched
   - **DELIVERED** → Order completed
   - **CANCELLED** → Order cancelled

### Manage Users

1. Go to `/admin` (type in URL bar)
2. Click "Users" tab
3. View all registered users
4. Click a user to view details
5. Update user role (CUSTOMER ↔ ADMIN)

## Development Tips

### Hot Reload

Next.js automatically reloads on file changes:
- **Components**: Instant Fast Refresh
- **API routes**: Restart on save
- **Database schema**: Requires migration

### Caching Behavior

Products are cached in Redis:
- **First request**: Fetches from database
- **Next 60 seconds**: Serves from cache
- **After 60 seconds**: Revalidates in background (stale-while-revalidate)

Clear cache manually:
```bash
redis-cli FLUSHALL
```

Or invalidate specific keys programmatically.

### Database Changes

When modifying the schema:

1. Edit `prisma/schema.prisma`
2. Create migration: `npm run db:migrate -- --name description`
3. Review generated SQL in `prisma/migrations/`
4. Regenerate client: `npm run db:generate` (usually automatic)
5. Restart dev server

### TypeScript Tips

- **Auto-import**: VS Code automatically imports types
- **Type checking**: Run `npx tsc --noEmit` to check all types
- **Zod validation**: Use for runtime type checking of API inputs
- **Prisma types**: Auto-generated, don't edit manually

### Debugging

**Server-side logs**: Check terminal running `npm run dev`

**Client-side logs**: Check browser console

**Database queries**: Enable Prisma logging in `lib/db.ts`:
```typescript
new PrismaClient({ log: ['query', 'error'] })
```

**API requests**: Check Network tab in browser DevTools

## Next Steps

Now that you're set up:

1. 📖 **Learn the architecture**: Read [Architecture Guide](./architecture.md)
2. 🔧 **Start developing**: See [Development Guide](./development.md)
3. 🚀 **Deploy your app**: Check [Deployment Guide](./deployment.md)
4. 🔍 **Explore the API**: Review [API Reference](./api-reference.md)

## Getting Help

- **Documentation**: Browse other guides in `/docs`
- **Code Examples**: Check existing components and API routes
- **Database**: Use `npx prisma studio` to inspect data
- **Issues**: Search or create on [GitHub](https://github.com/konarsubhojit/friendly-octo-giggle/issues)

---

**Ready to build!** 🚀 Continue to [Architecture Guide](./architecture.md) →
