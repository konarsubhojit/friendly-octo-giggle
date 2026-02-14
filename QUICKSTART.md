# Quick Start Guide

Get the e-commerce platform running locally in minutes!

## Prerequisites

- Node.js 18 or higher
- PostgreSQL database (local or cloud)
- Redis instance (local or Upstash)
- Google OAuth credentials

## Step-by-Step Setup

### 1. Install Dependencies

```bash
npm install
```

### 2. Set Up Environment Variables

```bash
cp .env.example .env
```

Edit `.env` with your credentials:

```env
# Required: PostgreSQL
DATABASE_URL=postgresql://user:password@localhost:5432/ecommerce

# Required: Redis (get free at upstash.com)
REDIS_URL=redis://localhost:6379

# Required: NextAuth Secret (generate with: openssl rand -base64 32)
NEXTAUTH_SECRET=your-secret-here
NEXTAUTH_URL=http://localhost:3000

# Required: Google OAuth (see below)
GOOGLE_CLIENT_ID=your-client-id
GOOGLE_CLIENT_SECRET=your-client-secret

# Optional: Admin token for legacy API endpoints
ADMIN_TOKEN=some-secure-token
```

### 3. Get Google OAuth Credentials

1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Create a new project or select existing
3. Enable "Google+ API"
4. Create OAuth 2.0 credentials:
   - Type: Web application
   - Authorized redirect URIs: `http://localhost:3000/api/auth/callback/google`
5. Copy Client ID and Client Secret to `.env`

### 4. Set Up Database

```bash
# Generate Prisma Client
npm run db:generate

# Run migrations
npm run db:migrate

# Seed initial data
npm run db:seed
```

### 5. Start Development Server

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000)

## First-Time User Setup

### Create Admin User

1. Sign in with Google at http://localhost:3000
2. Connect to your database:

```bash
npx prisma studio
```

3. Find your user in the `User` table
4. Change `role` from `CUSTOMER` to `ADMIN`
5. Refresh the page - you now have admin access!

## Testing the Application

### Test Customer Flow

1. Browse products on homepage
2. Click a product to view details
3. Sign in with Google
4. Place an order
5. Verify stock decreased

### Test Admin Flow

1. Sign in as admin user
2. Visit `/admin`
3. Add a new product
4. Edit an existing product
5. View and manage orders
6. Update order status

## Quick Commands

```bash
# Development
npm run dev              # Start dev server on :3000

# Database
npm run db:generate      # Generate Prisma client
npm run db:migrate       # Run migrations
npm run db:seed          # Seed test data
npx prisma studio        # Open database GUI

# Production
npm run build            # Build for production
npm run start            # Start production server
```

## Common Issues

### "DATABASE_URL not found"
- Make sure `.env` file exists
- Verify DATABASE_URL is set correctly
- Check PostgreSQL is running

### "REDIS_URL not found"
- Set up Redis locally or use Upstash
- Verify REDIS_URL in `.env`
- Test connection: `redis-cli ping`

### "Google OAuth error"
- Verify Client ID and Secret are correct
- Check redirect URI is exactly `http://localhost:3000/api/auth/callback/google`
- Make sure Google+ API is enabled

### "Prisma Client not generated"
- Run `npm run db:generate`
- Restart your dev server

### Build fails
- Run `npm run db:generate` first
- Check TypeScript errors: `npx tsc --noEmit`
- Clear `.next` folder: `rm -rf .next`

## Using the Admin Panel

### Add Products

1. Go to `/admin`
2. Click "Add Product"
3. Fill in:
   - Name (e.g., "Wireless Mouse")
   - Description
   - Price (e.g., 29.99)
   - Stock (e.g., 50)
   - Category (e.g., "Electronics")
   - Image URL (use Unsplash for testing)
4. Click "Save"

### Manage Orders

1. Go to `/admin`
2. Click "Orders" tab
3. View order details
4. Update order status:
   - PENDING → PROCESSING (order confirmed)
   - PROCESSING → SHIPPED (order shipped)
   - SHIPPED → DELIVERED (order received)

## Local Testing with Seed Data

The seed script creates 6 sample products:

1. Wireless Bluetooth Headphones - $199.99
2. Ergonomic Office Chair - $299.99
3. Smart Watch Series X - $399.99
4. Leather Laptop Bag - $149.99
5. Portable Power Bank - $49.99
6. Standing Desk Converter - $249.99

## Next Steps

- ✅ Application running locally
- ✅ Admin user created
- ✅ Sample data loaded
- 📖 Read [README.md](README.md) for full documentation
- 🚀 Check [DEPLOYMENT.md](DEPLOYMENT.md) for deployment options
- 💡 Review [MODERN_FEATURES.md](MODERN_FEATURES.md) for architecture details
- 🤖 See [.github/copilot/](..github/copilot/) for Copilot instructions

## Getting Help

- Check [PROJECT_SUMMARY.md](PROJECT_SUMMARY.md) for overview
- Review API endpoints in README.md
- Check [Copilot prompts](.github/copilot/prompts.md) for common tasks
- Look at existing code examples
- Run `npx prisma studio` to inspect database

## Development Tips

### Hot Reload

Next.js automatically reloads when you save files:
- Components: Instant refresh
- API routes: Restart on save
- Database schema: Run migrations

### Caching

Products are cached for 60 seconds:
- First request: Fetches from database
- Next 60s: Serves from Redis
- After 60s: Revalidates in background

Clear cache manually:
```bash
# Connect to Redis and clear
redis-cli FLUSHALL
```

### Database Changes

1. Edit `prisma/schema.prisma`
2. Run `npm run db:migrate`
3. Prisma generates SQL migration
4. Run `npm run db:generate` to update client

### TypeScript Errors

- Most errors auto-fix with proper imports
- Check Zod schema if validation fails
- Run `npx tsc --noEmit` to see all errors
- VS Code shows errors in real-time

## Ready to Deploy?

See [DEPLOYMENT.md](DEPLOYMENT.md) for:
- Vercel (recommended, easiest)
- AWS Lambda
- Google Cloud Run
- Railway
- Other platforms

---

**Happy coding!** 🚀
