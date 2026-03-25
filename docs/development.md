# Development Guide

Complete guide for developing this Next.js e-commerce application. Built for serverless deployment with TypeScript, Drizzle ORM, Redis caching, and NextAuth.js v5.

---

## 1. Development Workflow

### Daily Development Process

```bash
# Start development server
npm run dev

# Run in separate terminal for real-time type checking
npx tsc --watch --noEmit

# Generate Drizzle migrations after schema changes
npm run db:generate

# Create and apply database migration
npm run db:migrate -- --name your_migration_name

# Seed database with test data
npm run db:seed
```

### Environment Setup

Copy `.env.example` to `.env` and configure:

```env
DATABASE_URL=postgresql://user:password@localhost:5432/ecommerce
REDIS_URL=rediss://default:password@host:6379   # Optional in local/dev - app runs without Redis
NEXTAUTH_SECRET=your-secret-here
NEXTAUTH_URL=http://localhost:3000
GOOGLE_CLIENT_ID=your-google-client-id
GOOGLE_CLIENT_SECRET=your-google-client-secret
LOG_LEVEL=debug  # development only - high log volume, impacts performance
QSTASH_TOKEN=your-qstash-token
QSTASH_CURRENT_SIGNING_KEY=your-qstash-current-signing-key
QSTASH_NEXT_SIGNING_KEY=your-qstash-next-signing-key
NEXT_PUBLIC_APP_URL=http://localhost:3000
```

> **Note**: `REDIS_URL` is optional for local development. When absent, the app skips caching and fetches data directly from the database. For production, always configure Redis for optimal performance.

> **Note**: `LOG_LEVEL=debug` logs all cache hits, database queries, and detailed operations. This is useful for development debugging but creates excessive log volume and may impact performance in production. Always use `info` or `warn` level in production.

> **Note**: Checkout orchestration and email delivery are intentionally separate. Checkout requests are persisted and sent to Vercel Queues, while emails still use the QStash worker route. If Vercel Queue publishing is unavailable in local development, the checkout service falls back to inline background processing so local checkout still works.

> **Note**: Recovery for transient checkout worker failures is automatic in the consumer. The queue retries transient failures, and after the retry threshold is exhausted the consumer marks the checkout request as failed with the last recovery message for admin visibility.

### Development Commands

```bash
npm run dev         # Start dev server over HTTP (port 3000)
npm run dev:https   # Start dev server over HTTPS (experimental, self-signed cert)
npm run build       # Build production bundle
npm run start       # Start production server
npm run lint        # Run ESLint (flat config)
npm run test        # Run unit tests (single run)
npm run test:watch  # Run unit tests (watch mode)
npm run test:coverage # Run unit tests with coverage
npm run db:generate # Generate Drizzle migrations
npm run db:migrate  # Apply migrations
npm run db:seed     # Seed database
```

### Queue and Worker Setup

For local or preview environments where you want to test the real Vercel Queue path:

```bash
npm i -g vercel
vercel link
vercel env pull
```

- The checkout worker handler lives at `/api/queue/checkout-orders` and is bound by the `checkout-orders` trigger in `vercel.json`.
- The email worker remains separate at `/api/services/email` and still requires the QStash keys above.
- Admin queue visibility is available at `/admin/checkout-requests`.

---

## 2. Code Style Guide

### TypeScript Conventions

**Use strict mode** - `tsconfig.json` has `strict: true`

```typescript
// ✅ Good - Explicit types
function calculateTotal(items: OrderItem[]): number {
  return items.reduce((sum, item) => sum + item.price * item.quantity, 0);
}

// ❌ Bad - Implicit any
function calculateTotal(items) {
  return items.reduce((sum, item) => sum + item.price * item.quantity, 0);
}
```

**Use type inference when obvious**

```typescript
// ✅ Good - Let TypeScript infer
const products = await db.products.findAll();
const total = 100;

// ❌ Bad - Redundant type annotation
const products: Product[] = await db.products.findAll();
const total: number = 100;
```

**Prefer interfaces for object shapes, types for unions**

```typescript
// ✅ Good
interface User {
  id: string;
  email: string;
  role: "CUSTOMER" | "ADMIN";
}

type ApiResponse<T> =
  | { success: true; data: T }
  | { success: false; error: string };

// ❌ Bad - Using type for simple objects
type User = {
  id: string;
  email: string;
};
```

**Use const assertions for literal types**

```typescript
// ✅ Good
const ORDER_STATUSES = ["PENDING", "PROCESSING", "SHIPPED"] as const;
type OrderStatus = (typeof ORDER_STATUSES)[number];

// ❌ Bad
const ORDER_STATUSES = ["PENDING", "PROCESSING", "SHIPPED"];
```

### React/Next.js Conventions

**Server Components by default, Client Components when needed**

```typescript
// ✅ Good - Server Component (default)
export default async function ProductsPage() {
  const products = await db.products.findAll();
  return <ProductGrid products={products} />;
}

// ✅ Good - Client Component (interactive)
'use client';
export function AddToCartButton({ productId }: { productId: string }) {
  const handleClick = () => { /* ... */ };
  return <button onClick={handleClick}>Add to Cart</button>;
}
```

**Use async Server Actions for mutations**

```typescript
// lib/actions.ts
"use server";

export async function createProduct(data: ProductInput) {
  const validated = ProductInputSchema.parse(data);
  return await db.products.create(validated);
}
```

**Props destructuring with types**

```typescript
// ✅ Good
interface ProductCardProps {
  product: Product;
  showStock?: boolean;
}

export function ProductCard({ product, showStock = true }: ProductCardProps) {
  return <div>{product.name}</div>;
}
```

### Naming Conventions

- **Files**: kebab-case (`product-card.tsx`, `api-utils.ts`)
- **Components**: PascalCase (`ProductCard`, `AuthComponents`)
- **Functions**: camelCase (`createProduct`, `handleApiError`)
- **Constants**: SCREAMING_SNAKE_CASE (`MAX_FILE_SIZE`, `API_TIMEOUT`)
- **Types/Interfaces**: PascalCase (`Product`, `ApiResponse`)

---

## 3. Component Organization

### Folder Structure

```
app/                          # Next.js App Router
├── api/                      # API routes
│   ├── products/
│   │   └── route.ts         # GET /api/products
│   ├── cart/
│   │   ├── route.ts         # GET, POST /api/cart
│   │   └── items/[id]/route.ts
│   └── orders/
│       └── route.ts
├── products/
│   ├── page.tsx             # /products
│   └── [id]/
│       └── page.tsx         # /products/[id]
├── cart/
│   └── page.tsx
├── admin/
│   └── page.tsx
└── layout.tsx

components/                   # Reusable components
├── ui/                      # Base UI components
│   ├── AuthComponents.tsx
│   ├── ErrorBoundary.tsx
│   └── NewsletterForm.tsx
├── sections/                # Page sections
│   ├── Hero.tsx
│   └── ProductGrid.tsx
└── layout/                  # Layout components
    └── Header.tsx

lib/                         # Shared utilities
├── db.ts                    # Database client
├── redis.ts                 # Redis cache
├── auth.ts                  # Authentication
├── logger.ts                # Logging utilities
├── api-middleware.ts        # API middleware
├── api-utils.ts             # API helpers
├── validations.ts           # Zod schemas
└── types.ts                 # Shared types

drizzle/                     # Database
└── *.sql                    # Migration SQL files
```

### Component Patterns

**Small, focused components**

```typescript
// ✅ Good - Single responsibility
export function ProductPrice({ price }: { price: number }) {
  return <span className="text-lg font-bold">${price.toFixed(2)}</span>;
}

// ❌ Bad - Too much responsibility
export function Product({ product }) {
  // Handles display, cart, favorites, reviews... 200+ lines
}
```

**Composition over props drilling**

```typescript
// ✅ Good - Composition
<ProductCard>
  <ProductImage src={product.image} />
  <ProductTitle>{product.name}</ProductTitle>
  <ProductPrice price={product.price} />
  <AddToCartButton productId={product.id} />
</ProductCard>

// ❌ Bad - Props drilling
<ProductCard
  image={product.image}
  title={product.name}
  price={product.price}
  productId={product.id}
  showCart={true}
  showFavorite={true}
  // ... many more props
/>
```

---

## 4. Database Migrations

### Migration Workflow

**1. Edit Drizzle schema**

```typescript
// lib/schema.ts
export const products = pgTable("products", {
  id: uuid("id").defaultRandom().primaryKey(),
  name: text("name").notNull(),
  description: text("description").notNull(),
  price: doublePrecision("price").notNull(),
  featured: boolean("featured").default(false), // New field
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});
```

**2. Generate migration**

```bash
npm run db:generate
```

This generates SQL in `drizzle/` directory.

**3. Review generated SQL**

```sql
-- AlterTable
ALTER TABLE "products" ADD COLUMN "featured" BOOLEAN NOT NULL DEFAULT false;
```

**4. Apply and commit migration**

```bash
npm run db:migrate
git add lib/schema.ts drizzle/
git commit -m "Add featured field to products"
```

### Common Scenarios

**Adding required field to existing table**

Use two-step migration:

```typescript
// Step 1: Add as optional in lib/schema.ts
export const products = pgTable("products", {
  sku: text("sku"),
});
```

```bash
npm run db:generate
npm run db:migrate
# Populate data for existing records
npx tsx scripts/populate-sku.ts
```

```typescript
// Step 2: Make required in lib/schema.ts
export const products = pgTable("products", {
  sku: text("sku").notNull(),
});
```

```bash
npm run db:generate
npm run db:migrate
```

**Adding indexes**

```typescript
// In lib/schema.ts - add indexes to pgTable
export const products = pgTable(
  "products",
  {
    category: text("category").notNull(),
    price: doublePrecision("price").notNull(),
  },
  (table) => [
    index("idx_products_category").on(table.category),
    index("idx_products_category_price").on(table.category, table.price),
  ],
);
```

**Adding relations**

```typescript
// In lib/schema.ts
export const categories = pgTable("categories", {
  id: uuid("id").defaultRandom().primaryKey(),
  name: text("name").notNull().unique(),
});

export const products = pgTable("products", {
  id: uuid("id").defaultRandom().primaryKey(),
  categoryId: uuid("category_id").references(() => categories.id),
});

export const categoriesRelations = relations(categories, ({ many }) => ({
  products: many(products),
}));
```

### Production Deployment

In CI/CD, use `drizzle-kit migrate`:

```bash
# Non-interactive, applies pending migrations
npx drizzle-kit migrate
```

**Vercel setup**:

```json
// package.json
{
  "scripts": {
    "build": "npm run db:migrate && next build"
  }
}
```

### Best Practices

- ✅ Always review generated SQL before committing
- ✅ Use descriptive migration names
- ✅ Test migrations locally first
- ✅ Keep migrations small and incremental
- ✅ Never edit existing migrations
- ❌ Don't rollback via Drizzle (restore from backup instead)

---

## 5. Testing

### Testing Strategy

**Manual Testing** (current approach)

1. Start dev server: `npm run dev`
2. Test in browser at `http://localhost:3000`
3. Check browser console for errors
4. Verify API responses in Network tab
5. Test with different user roles (customer, admin)

### Testing Checklist

**API Endpoints**

```bash
# Test with curl
curl http://localhost:3000/api/products
curl -X POST http://localhost:3000/api/cart \
  -H "Content-Type: application/json" \
  -d '{"productId":"prod_123","quantity":1}'
```

**Authentication Flow**

1. Sign in with Google OAuth
2. Verify session in cookies
3. Test protected routes
4. Test admin-only pages

**Database Operations**

1. Create product in admin panel
2. Verify in database: `psql $DATABASE_URL -c "SELECT * FROM \"Product\";"`
3. Test update/delete operations

**Cache Behavior**

```typescript
// Check Redis cache
import { redis } from "@/lib/redis";
const cached = await redis.get("products:all");
console.log("Cached data:", cached);
```

### Testing Framework

This project uses **Vitest** with **@testing-library/react** for unit testing:

```bash
npm run test           # Run tests (single run)
npm run test:watch     # Run tests in watch mode
npm run test:coverage  # Run tests with coverage report
```

For E2E tests:

```bash
npm install -D @playwright/test  # E2E tests
```

---

## 6. Logging

### Design Philosophy

Logs should be **meaningful signals, not noise**. In production, the default `info` level must only surface events that require human attention or are useful for business analytics. High-frequency lifecycle callbacks (session reads, successful API calls) belong at `debug` and are invisible in production unless explicitly enabled.

**Rule of thumb:**
| What happened | Level |
|---|---|
| Server error (5xx), exception thrown | `error` |
| Client error (4xx), failed auth, slow query | `warn` |
| User action: login, logout, order placed | `info` |
| Session read, successful API call, cache/DB op | `debug` |

### Pino Logger Usage

Import from `@/lib/logger`:

```typescript
import {
  logApiRequest,
  logDatabaseOperation,
  logAuthEvent,
  logBusinessEvent,
  logError,
  logPerformance,
  Timer,
} from "@/lib/logger";
```

### Log Types

**API Requests** (automatic with `withLogging`)

```typescript
import { withLogging } from "@/lib/api-middleware";

async function handleGet(request: NextRequest) {
  const products = await db.products.findAll();
  return NextResponse.json({ products });
}

export const GET = withLogging(handleGet);
// Logs at: debug (2xx/3xx), warn (4xx), error (5xx)
// Successful requests are debug-only — not visible in production by default
```

**Business Events**

```typescript
logBusinessEvent({
  event: "order_created",
  userId: "user_123",
  details: {
    orderId: order.id,
    totalAmount: 99.99,
    itemCount: 3,
  },
  success: true,
});
```

**Error Logging**

```typescript
try {
  await processOrder(data);
} catch (error) {
  logError({
    error,
    context: "order_processing",
    userId: session?.user?.id,
    additionalInfo: { orderId: data.orderId },
  });
  throw error;
}
```

**Performance Tracking**

```typescript
const timer = new Timer("expensive_operation");
// ... do work ...
const duration = timer.end({ recordCount: 1000 });

// Or manually
logPerformance({
  operation: "data_export",
  duration: 1500,
  metadata: { fileSize: "2MB" },
});
```

### Log Levels

Set via `LOG_LEVEL` env variable:

- **debug**: Session reads, successful API calls, cache hits, DB queries — high-frequency, dev/trace only
- **info**: Meaningful user actions: login, logout, registration, order placed (production default)
- **warn**: Client errors (4xx), failed login attempts, slow queries (>1000ms)
- **error**: Server errors (5xx), exceptions, failed operations

> **Production recommendation:** Keep `LOG_LEVEL=info` (default). Use `LOG_LEVEL=warn` if you want only failures and problems. Never use `debug` in production — it includes per-request session and API call entries that will flood your log aggregator.

### Auth Event Logging

Auth events are logged by `logAuthEvent()`. Key events and their levels:

| Event             | Level   | When                               |
| ----------------- | ------- | ---------------------------------- |
| `login`           | `info`  | User successfully authenticated    |
| `logout`          | `info`  | User signed out                    |
| `register`        | `info`  | New account created                |
| `failed_login`    | `warn`  | Authentication attempt failed      |
| `password_change` | `info`  | Password updated                   |
| `session_created` | `debug` | Session token read (every request) |
| `session_expired` | `debug` | Session token expired              |

> **Important:** Do **not** log inside the NextAuth `session()` callback. It fires on every authenticated request and would generate one log entry per page/API call. Auth events should only be logged for user-initiated actions (login, logout, register).

### Best Practices

```typescript
// ✅ Good - Structured, contextual
logBusinessEvent({
  event: "payment_processed",
  userId: "user_123",
  details: {
    orderId: "order_456",
    amount: 99.99,
    lastFour: "1234",
  },
  success: true,
});

// ❌ Bad - Unstructured string
console.log("Payment processed for order order_456");

// ❌ Bad - Logging in session() callback (fires on every request)
// session({ session, token }) {
//   logAuthEvent({ event: 'session_created', ... }); // DO NOT DO THIS
// }

// ❌ Never log sensitive data
logBusinessEvent({
  details: {
    creditCard: "1234567890123456", // NEVER!
    cvv: "123", // NEVER!
  },
});
```

---

## 7. API Development

### Creating New API Route

**1. Create route file**

```typescript
// app/api/reviews/route.ts
import { NextRequest, NextResponse } from "next/server";
import { withLogging } from "@/lib/api-middleware";
import { apiSuccess, handleApiError } from "@/lib/api-utils";
import { db } from "@/lib/db";
import { z } from "zod";

const ReviewSchema = z.object({
  productId: z.string().cuid(),
  rating: z.number().min(1).max(5),
  comment: z.string().min(10).max(1000),
});

async function handlePost(request: NextRequest) {
  try {
    const body = await request.json();
    const validated = ReviewSchema.parse(body);

    const review = await db.reviews.create(validated);

    return apiSuccess(review, 201);
  } catch (error) {
    return handleApiError(error);
  }
}

async function handleGet() {
  try {
    const reviews = await db.reviews.findAll();
    return apiSuccess({ reviews });
  } catch (error) {
    return handleApiError(error);
  }
}

export const GET = withLogging(handleGet);
export const POST = withLogging(handlePost);
```

**2. Add validation schema**

```typescript
// lib/validations.ts
export const ReviewSchema = z.object({
  productId: z.string().cuid(),
  rating: z.number().int().min(1).max(5),
  comment: z.string().min(10).max(1000),
});

export type ReviewInput = z.infer<typeof ReviewSchema>;
```

**3. Add database method**

```typescript
// lib/db.ts
export const db = {
  reviews: {
    async create(data: ReviewInput) {
      return await drizzleDb.insert(schema.reviews).values(data).returning();
    },
    async findAll() {
      return await drizzleDb.query.reviews.findMany({
        with: { product: true, user: true },
        orderBy: desc(schema.reviews.createdAt),
      });
    },
  },
};
```

### API Utilities

**Success responses**

```typescript
import { apiSuccess } from "@/lib/api-utils";

return apiSuccess({ user }, 200);
// Returns: { success: true, data: { user } }
```

**Error responses**

```typescript
import { apiError } from "@/lib/api-utils";

return apiError("Product not found", 404);
// Returns: { success: false, error: 'Product not found' }
```

**Validation error handling**

```typescript
import { handleApiError } from "@/lib/api-utils";

try {
  const validated = ProductSchema.parse(data);
} catch (error) {
  return handleApiError(error);
  // Auto-formats Zod validation errors with 400 status
}
```

### Authentication in API Routes

```typescript
import { auth } from "@/lib/auth";

async function handlePost(request: NextRequest) {
  const session = await auth();

  if (!session?.user) {
    return apiError("Unauthorized", 401);
  }

  if (session.user.role !== "ADMIN") {
    return apiError("Forbidden", 403);
  }

  // Proceed with authenticated logic
}
```

---

## 8. Error Handling

### API Error Patterns

**Try-catch with proper logging**

```typescript
async function handlePost(request: NextRequest) {
  try {
    const body = await request.json();
    const result = await processData(body);
    return apiSuccess(result);
  } catch (error) {
    logError({
      error,
      context: "data_processing",
      additionalInfo: { path: request.nextUrl.pathname },
    });
    return handleApiError(error);
  }
}
```

**Validation errors**

```typescript
import { ZodError } from "zod";

try {
  const validated = ProductInputSchema.parse(data);
} catch (error) {
  if (error instanceof ZodError) {
    // Returns 400 with field-specific errors
    return handleValidationError(error);
  }
  throw error;
}
```

**Custom error classes**

```typescript
class ProductNotFoundError extends Error {
  constructor(productId: string) {
    super(`Product ${productId} not found`);
    this.name = "ProductNotFoundError";
  }
}

try {
  const product = await db.products.findById(id);
  if (!product) throw new ProductNotFoundError(id);
} catch (error) {
  if (error instanceof ProductNotFoundError) {
    return apiError(error.message, 404);
  }
  return handleApiError(error);
}
```

### Client-side Error Handling

**Error Boundary component**

```typescript
// components/ui/ErrorBoundary.tsx
'use client';

export class ErrorBoundary extends React.Component<Props, State> {
  static getDerivedStateFromError(error: Error) {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('Error caught by boundary:', error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return <ErrorFallback error={this.state.error} />;
    }
    return this.props.children;
  }
}
```

**Fetch error handling**

```typescript
async function fetchProducts() {
  try {
    const response = await fetch("/api/products");

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || "Failed to fetch products");
    }

    const data = await response.json();
    return data.data;
  } catch (error) {
    console.error("Fetch error:", error);
    return [];
  }
}
```

---

## 9. Git Workflow

### Branch Strategy

```bash
main              # Production-ready code
└── feature/xyz   # Feature branches
```

### Commit Conventions

Use clear, descriptive commits:

```bash
# Good
git commit -m "Add featured flag to products"
git commit -m "Fix cart item quantity validation"
git commit -m "Update Drizzle ORM dependency"

# Bad
git commit -m "update"
git commit -m "fixes"
git commit -m "WIP"
```

### Pull Request Process

1. **Create feature branch**

   ```bash
   git checkout -b feature/add-reviews
   ```

2. **Make changes and commit**

   ```bash
   git add .
   git commit -m "Add review system for products"
   ```

3. **Push to remote**

   ```bash
   git push origin feature/add-reviews
   ```

4. **Create PR on GitHub**
   - Clear title and description
   - List changes made
   - Include screenshots for UI changes

5. **After merge, delete branch**
   ```bash
   git checkout main
   git pull origin main
   git branch -d feature/add-reviews
   ```

---

## 10. Performance Tips

### Database Optimization

**Use select to fetch only needed fields**

```typescript
// ✅ Good
const products = await drizzleDb.query.products.findMany({
  columns: { id: true, name: true, price: true },
});

// ❌ Bad - Fetches all fields
const products = await drizzleDb.query.products.findMany();
```

**Add indexes for frequent queries**

```typescript
// In lib/schema.ts
export const products = pgTable(
  "products",
  {
    category: text("category").notNull(),
    price: doublePrecision("price").notNull(),
  },
  (table) => [
    index("idx_products_category").on(table.category),
    index("idx_products_price").on(table.price),
  ],
);
```

**Use pagination**

```typescript
const products = await drizzleDb.query.products.findMany({
  limit: 20,
  offset: page * 20,
  orderBy: desc(schema.products.createdAt),
});
```

### Redis Caching

**Cache expensive queries**

```typescript
import { getCachedData } from "@/lib/redis";

const products = await getCachedData(
  "products:all",
  60, // TTL in seconds
  async () => await db.products.findAll(),
  10, // Stale-while-revalidate
);
```

**Cache invalidation**

```typescript
import { invalidateCache } from "@/lib/redis";

// After creating/updating product
await db.products.create(data);
await invalidateCache("products:*");
```

### Next.js Optimization

**Use Server Components for data fetching**

```typescript
// ✅ Good - Server Component
export default async function ProductsPage() {
  const products = await db.products.findAll();
  return <ProductGrid products={products} />;
}

// ❌ Bad - Client-side fetching
'use client';
export default function ProductsPage() {
  const [products, setProducts] = useState([]);
  useEffect(() => {
    fetch('/api/products').then(r => r.json()).then(setProducts);
  }, []);
}
```

**Image optimization**

```typescript
import Image from 'next/image';

<Image
  src={product.image}
  alt={product.name}
  width={400}
  height={400}
  priority // For above-fold images
/>
```

**Set cache headers**

```typescript
const response = apiSuccess({ products });
response.headers.set(
  "Cache-Control",
  "s-maxage=60, stale-while-revalidate=120",
);
return response;
```

---

## 11. Debugging

### Tools

**Chrome DevTools**

- Console: Check for errors
- Network: Inspect API calls
- React DevTools: Inspect component tree

**VS Code**

- Set breakpoints in TypeScript code
- Use debugger console for variable inspection

**Database**

```bash
# Connect to database
psql $DATABASE_URL

# View tables
\dt

# Query data
SELECT * FROM "Product" LIMIT 10;
```

**Redis**

```bash
# Connect to Redis
redis-cli -u $REDIS_URL

# List keys
KEYS *

# Get cached value
GET products:all
```

### Debugging Techniques

**API debugging**

```typescript
// Add detailed logging
console.log("Request body:", body);
console.log("Validated data:", validated);
console.log("Database result:", result);
```

**Check request ID for tracing**

```typescript
// Returned in X-Request-ID header
const response = await fetch("/api/products");
const requestId = response.headers.get("X-Request-ID");
console.log("Request ID:", requestId);

// Search logs for this request ID
```

**Database query debugging**

```typescript
// Enable Drizzle query logging via Pino logger
// Set LOG_LEVEL=debug in .env to see all database queries
// Queries are logged via the structured logger in lib/logger.ts
```

---

## 12. Common Patterns

### Type-safe API client

```typescript
async function createProduct(data: ProductInput) {
  const response = await fetch("/api/products", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error);
  }

  const result = await response.json();
  return result.data;
}
```

### Server Action pattern

```typescript
// lib/actions.ts
"use server";

export async function addToCart(productId: string, quantity: number) {
  const session = await auth();
  if (!session?.user) {
    return { error: "Unauthorized" };
  }

  try {
    const cart = await db.cart.addItem({
      userId: session.user.id,
      productId,
      quantity,
    });
    return { data: cart };
  } catch (error) {
    return { error: "Failed to add to cart" };
  }
}
```

### Protected route pattern

```typescript
// app/admin/page.tsx
import { auth } from '@/lib/auth';
import { redirect } from 'next/navigation';

export default async function AdminPage() {
  const session = await auth();

  if (!session?.user || session.user.role !== 'ADMIN') {
    redirect('/');
  }

  return <AdminDashboard />;
}
```

### Data fetching with cache

```typescript
import { unstable_cache } from 'next/cache';

const getCachedProducts = unstable_cache(
  async () => await db.products.findAll(),
  ['products'],
  { revalidate: 60 }
);

export default async function ProductsPage() {
  const products = await getCachedProducts();
  return <ProductGrid products={products} />;
}
```

### Form handling with validation

```typescript
'use client';

export function ProductForm() {
  const [errors, setErrors] = useState<Record<string, string>>({});

  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    const data = Object.fromEntries(formData);

    try {
      const validated = ProductInputSchema.parse(data);
      await createProduct(validated);
    } catch (error) {
      if (error instanceof ZodError) {
        const fieldErrors = error.issues.reduce((acc, err) => {
          acc[err.path[0]] = err.message;
          return acc;
        }, {} as Record<string, string>);
        setErrors(fieldErrors);
      }
    }
  }

  return <form onSubmit={handleSubmit}>{/* form fields */}</form>;
}
```

---

## Quick Reference

### Essential Files

- `lib/db.ts` - Database client and methods
- `lib/redis.ts` - Cache client and utilities
- `lib/auth.ts` - Authentication configuration
- `lib/logger.ts` - Logging utilities
- `lib/validations.ts` - Zod schemas
- `lib/api-middleware.ts` - API middleware
- `lib/schema.ts` - Database schema (Drizzle)

### Key Imports

```typescript
// Database
import { db } from "@/lib/db";

// Cache
import { getCachedData, invalidateCache } from "@/lib/redis";

// Auth
import { auth } from "@/lib/auth";

// Logging
import { logError, logBusinessEvent, Timer } from "@/lib/logger";

// API
import { apiSuccess, apiError, handleApiError } from "@/lib/api-utils";
import { withLogging } from "@/lib/api-middleware";

// Validation
import { ProductInputSchema } from "@/lib/validations";
```

### Environment Variables

Required for development:

- `DATABASE_URL` - PostgreSQL connection string
- `REDIS_URL` - Redis connection string
- `NEXTAUTH_SECRET` - NextAuth secret key
- `GOOGLE_CLIENT_ID` - Google OAuth client ID
- `GOOGLE_CLIENT_SECRET` - Google OAuth secret

Optional:

- `LOG_LEVEL` - debug, info, warn, error (default: info)
- `NODE_ENV` - development, production, test

---

For more details, see:

- [Migrations Guide](../MIGRATIONS.md)
- [Logging Guide](../LOGGING_GUIDE.md)
- [Project README](../README.md)
