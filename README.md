# E-Commerce Website

A highly scalable e-commerce website built with Next.js, PostgreSQL, and Redis cache. Designed to run as serverless on-demand functions.

## Features

- 🚀 **Serverless Architecture**: Built for Next.js serverless functions (Vercel, AWS Lambda, etc.)
- 🛒 **Product Management**: Full CRUD operations for products with images, prices, and stock
- 📦 **Order Management**: Complete order processing system with customer information
- 🔐 **Google Authentication**: Secure server-side authentication with NextAuth.js v5
- 👥 **Role-Based Access**: Customer and Admin roles with protected routes
- ⚡ **Redis Caching**: Smart caching with stale-while-revalidate pattern
- 🔒 **Cache Stampede Prevention**: Distributed locking to prevent cache stampede
- ✅ **Type Safety**: Full TypeScript with Zod runtime validation
- 🎨 **Modern UI**: Clean, responsive design with Tailwind CSS
- 👨‍💼 **Admin Panel**: Secure admin interface for managing products and orders
- 💾 **PostgreSQL Database**: Reliable data persistence with Prisma ORM
- 🤖 **AI-Ready**: Includes GitHub Copilot configuration files

## Tech Stack

- **Framework**: Next.js 16 with App Router
- **Language**: TypeScript with strict mode
- **Database**: PostgreSQL with Prisma ORM v7
- **Authentication**: NextAuth.js v5 (Auth.js) with Google OAuth
- **Cache**: Redis (ioredis) with stampede prevention
- **Validation**: Zod for runtime type checking
- **Styling**: Tailwind CSS v4
- **Deployment**: Optimized for serverless platforms (Vercel, AWS Lambda, etc.)

## Prerequisites

- Node.js 18+ 
- PostgreSQL database
- Redis instance (Upstash Redis recommended for serverless)

## Setup Instructions

### 1. Clone the repository

```bash
git clone https://github.com/konarsubhojit/friendly-octo-giggle.git
cd friendly-octo-giggle
```

### 2. Install dependencies

```bash
npm install
```

### 3. Configure environment variables

Copy `.env.example` to `.env`:

```bash
cp .env.example .env
```

Update `.env` with your credentials:

```env
# PostgreSQL Database URL
DATABASE_URL=postgresql://user:password@localhost:5432/ecommerce?schema=public

# Redis URL (use Upstash Redis for serverless: https://upstash.com)
REDIS_URL=rediss://default:your-password@your-redis-host:6379

# NextAuth Secret (generate with: openssl rand -base64 32)
NEXTAUTH_SECRET=your-nextauth-secret-here
NEXTAUTH_URL=http://localhost:3000

# Google OAuth Credentials (get from Google Cloud Console)
GOOGLE_CLIENT_ID=your-google-client-id.apps.googleusercontent.com
GOOGLE_CLIENT_SECRET=your-google-client-secret

# Admin authentication token (choose a secure random string)
ADMIN_TOKEN=your-secure-admin-token-here
```

### Getting Google OAuth Credentials

1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Create a new project or select existing
3. Enable Google+ API
4. Go to "Credentials" → "Create Credentials" → "OAuth client ID"
5. Choose "Web application"
6. Add authorized redirect URI: `http://localhost:3000/api/auth/callback/google`
7. For production, add: `https://your-domain.com/api/auth/callback/google`
8. Copy Client ID and Client Secret to `.env`

### 4. Set up the database

Generate Prisma client:
```bash
npm run db:generate
```

Run database migrations:
```bash
npm run db:migrate
```

Seed initial products:
```bash
npm run db:seed
```

### 5. Run the development server

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) in your browser.

## Usage

### Customer Experience

1. **Browse Products**: Visit the homepage to see all available products
2. **Sign In**: Click "Sign In" and authenticate with Google
3. **View Product Details**: Click on any product to see full details
4. **Place Orders**: Fill out the order form with shipping information
5. **Automatic Stock Updates**: Product stock is automatically updated after orders

### Admin Panel

The admin panel uses NextAuth session-based authentication with role-based access control.

1. Navigate to `/admin`
2. Sign in with Google (if not already signed in)
3. If your user has ADMIN role, you'll access the admin dashboard
4. **Dashboard Options**:
   - **Products**: Add, edit, and delete products
   - **Orders**: View and update order status
   - **Users**: Manage user roles (promote/demote admins)

#### Setting Up Your First Admin

After signing in with Google for the first time, you need to promote yourself to admin:

```bash
# Use Prisma Studio
npx prisma studio
# Navigate to User model, find your email, and change role to ADMIN

# Or use SQL
psql $DATABASE_URL -c "UPDATE \"User\" SET role = 'ADMIN' WHERE email = 'your-email@example.com';"
```

After setting your role to ADMIN, sign out and sign in again to refresh your session.

## API Endpoints

### Public APIs

- `GET /api/products` - List all products (cached)
- `GET /api/products/[id]` - Get single product (cached)
- `POST /api/orders` - Create new order

### Admin APIs (require ADMIN role via NextAuth session)

- `GET /api/admin/products` - List all products
- `POST /api/admin/products` - Create product
- `PUT /api/admin/products/[id]` - Update product
- `DELETE /api/admin/products/[id]` - Delete product
- `GET /api/admin/orders` - List all orders (cached 1min)
- `GET /api/admin/orders/[id]` - Get single order (cached 1min)
- `PATCH /api/admin/orders/[id]` - Update order status
- `GET /api/admin/users` - List all users (cached 5min)
- `GET /api/admin/users/[id]` - Get user details (cached 5min)
- `PATCH /api/admin/users/[id]` - Update user role

## Redis Caching Strategy

The application implements a sophisticated caching strategy with proper invalidation:

### Caching by Endpoint
1. **Products**:
   - List: 60s TTL, 10s stale window
   - Individual: 60s TTL, 10s stale window
   - Invalidated on: create, update, delete

2. **Orders**:
   - Admin list: 60s TTL, 10s stale window
   - Individual: 60s TTL, 10s stale window
   - Invalidated on: create, status update

3. **Users**:
   - Admin list: 300s (5min) TTL, 30s stale window
   - Individual: 300s TTL, 30s stale window
   - Invalidated on: role update

### Cache Features
1. **Stale-While-Revalidate**: Serves stale data while fetching fresh data in background
2. **Cache Stampede Prevention**: Uses distributed locks to prevent multiple simultaneous fetches
3. **SCAN-based Invalidation**: Production-safe pattern deletion using SCAN instead of KEYS
4. **Automatic Invalidation**: Cache is cleared on all mutations

## Deployment

### Vercel (Recommended)

1. Push your code to GitHub
2. Import project in Vercel
3. Add environment variables:
   - `DATABASE_URL`
   - `REDIS_URL`
   - `ADMIN_TOKEN`
4. Deploy!

Vercel will automatically:
- Run Prisma generate during build
- Deploy as serverless functions
- Enable edge caching

### Other Platforms

The app works on any platform supporting Next.js serverless:
- AWS Lambda (via AWS Amplify or Serverless Framework)
- Google Cloud Run
- Azure Functions
- Cloudflare Pages

## Database Schema

### Product
- id, name, description, price, image, stock, category
- timestamps (createdAt, updatedAt)

### Order
- id, customerName, customerEmail, customerAddress
- totalAmount, status (PENDING/PROCESSING/SHIPPED/DELIVERED/CANCELLED)
- timestamps

### OrderItem
- id, orderId, productId, quantity, price
- Relations to Order and Product

## Performance Considerations

- **Serverless-optimized**: Singleton Prisma client prevents connection exhaustion
- **Redis connection pooling**: Lazy connection with automatic reconnection
- **Image optimization**: Next.js Image component with proper sizing
- **Cache-first**: Heavy use of Redis to minimize database queries
- **Edge-ready**: Can be deployed to edge runtime with minor adjustments

## Security

- Admin routes protected with bearer token authentication
- Input validation on all API endpoints
- SQL injection prevention via Prisma ORM
- XSS protection via React's built-in escaping

## Development Scripts

```bash
npm run dev          # Start development server
npm run build        # Build for production
npm run start        # Start production server
npm run lint         # Run ESLint
npm run db:generate  # Generate Prisma client
npm run db:migrate   # Run database migrations
npm run db:seed      # Seed database with sample data
```

## License

ISC

## Contributing

Pull requests are welcome! Please ensure:
- Code follows existing patterns
- TypeScript types are properly defined
- Changes don't break serverless compatibility
