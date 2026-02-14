# E-Commerce Website

A highly scalable e-commerce website built with Next.js, PostgreSQL, and Redis cache. Designed to run as serverless on-demand functions.

## Features

- 🚀 **Serverless Architecture**: Built for Next.js serverless functions (Vercel, AWS Lambda, etc.)
- 🛒 **Product Management**: Full CRUD operations for products with images, prices, and stock
- 📦 **Order Management**: Complete order processing system with customer information
- ⚡ **Redis Caching**: Smart caching with stale-while-revalidate pattern
- 🔒 **Cache Stampede Prevention**: Distributed locking to prevent cache stampede
- 🎨 **Modern UI**: Clean, responsive design with Tailwind CSS
- 👨‍💼 **Admin Panel**: Secure admin interface for managing products and orders
- 💾 **PostgreSQL Database**: Reliable data persistence with Prisma ORM

## Tech Stack

- **Framework**: Next.js 16 with App Router
- **Language**: TypeScript
- **Database**: PostgreSQL with Prisma ORM
- **Cache**: Redis (ioredis)
- **Styling**: Tailwind CSS
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

# Admin authentication token (choose a secure random string)
ADMIN_TOKEN=your-secure-admin-token-here
```

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

### Customer Store

- Browse products at the homepage
- Click on any product to view details
- Place orders directly from product pages
- Orders automatically update product stock

### Admin Panel

1. Navigate to [http://localhost:3000/admin](http://localhost:3000/admin)
2. Enter your `ADMIN_TOKEN` from `.env`
3. Manage products:
   - Add new products
   - Edit existing products
   - Delete products (cache automatically invalidated)
4. Manage orders:
   - View all orders
   - Update order status (PENDING → PROCESSING → SHIPPED → DELIVERED)
   - View order details and customer information

## API Endpoints

### Public APIs

- `GET /api/products` - List all products (cached)
- `GET /api/products/[id]` - Get single product (cached)
- `POST /api/orders` - Create new order

### Admin APIs (requires Bearer token)

- `GET /api/admin/products` - List all products
- `POST /api/admin/products` - Create product
- `PUT /api/admin/products/[id]` - Update product
- `DELETE /api/admin/products/[id]` - Delete product
- `GET /api/admin/orders` - List all orders
- `GET /api/admin/orders/[id]` - Get single order
- `PATCH /api/admin/orders/[id]` - Update order status

## Redis Caching Strategy

The application implements a sophisticated caching strategy:

1. **Stale-While-Revalidate**: Serves stale data while fetching fresh data in background
2. **Cache Stampede Prevention**: Uses distributed locks to prevent multiple simultaneous fetches
3. **Automatic Invalidation**: Cache is invalidated when products/orders are modified
4. **TTL Management**: Products cached for 60s with 10s stale window

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
