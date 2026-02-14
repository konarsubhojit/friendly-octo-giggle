# Modern TypeScript & React Features

This document highlights the modern TypeScript and React features used throughout this project.

## TypeScript Features

### 1. Strict Mode
```typescript
// tsconfig.json
{
  "compilerOptions": {
    "strict": true,
    "noEmit": true,
    "esModuleInterop": true
  }
}
```

### 2. Type Inference with Zod
```typescript
// Define schema
const ProductSchema = z.object({
  name: z.string(),
  price: z.number().positive(),
});

// Infer TypeScript type automatically
type Product = z.infer<typeof ProductSchema>;
// No need to define the type separately!
```

### 3. Generic Utility Types
```typescript
// lib/validations.ts
export type AsyncResult<T, E = Error> =
  | { success: true; data: T }
  | { success: false; error: E };

// Usage
async function fetchData(): Promise<AsyncResult<Product>> {
  try {
    const data = await api.get();
    return { success: true, data };
  } catch (error) {
    return { success: false, error: error.message };
  }
}
```

### 4. Type Guards
```typescript
// lib/api-utils.ts
export function isApiSuccess<T>(
  response: unknown
): response is { success: true; data: T } {
  return (
    typeof response === 'object' &&
    response !== null &&
    'success' in response &&
    response.success === true
  );
}

// Usage
const response = await fetch('/api/data');
if (isApiSuccess<Product>(response)) {
  // TypeScript knows response.data is Product
  console.log(response.data.name);
}
```

### 5. Const Assertions
```typescript
const OrderStatus = {
  PENDING: 'PENDING',
  PROCESSING: 'PROCESSING',
  SHIPPED: 'SHIPPED',
  DELIVERED: 'DELIVERED',
} as const;

type OrderStatusType = typeof OrderStatus[keyof typeof OrderStatus];
// Type is 'PENDING' | 'PROCESSING' | 'SHIPPED' | 'DELIVERED'
```

### 6. Template Literal Types
```typescript
type HttpMethod = 'GET' | 'POST' | 'PUT' | 'DELETE';
type Endpoint = `/api/${string}`;
type ApiRoute = `${HttpMethod} ${Endpoint}`;

// Valid: "GET /api/products", "POST /api/orders"
// Invalid: "PATCH /products", "GET api/users"
```

### 7. Satisfies Operator
```typescript
const config = {
  timeout: 5000,
  retries: 3,
  endpoints: {
    products: '/api/products',
    orders: '/api/orders',
  }
} satisfies ConfigType;

// Type is inferred but also checked against ConfigType
// You can still access specific properties with exact types
config.endpoints.products // string, not ConfigType['endpoints']
```

## React Modern Features

### 1. React Server Components (RSC)
```typescript
// Default: Server Component (no 'use client')
export default async function ProductPage({ params }: Props) {
  // Can directly fetch data, access database
  const product = await prisma.product.findUnique({
    where: { id: params.id }
  });
  
  return <ProductDisplay product={product} />;
}
```

### 2. Server Actions
```typescript
// lib/actions.ts
'use server';

export async function createProduct(data: ProductInput): Promise<AsyncResult<Product>> {
  const validated = ProductInputSchema.parse(data);
  const product = await prisma.product.create({ data: validated });
  revalidatePath('/products');
  return { success: true, data: product };
}

// In component
'use client';
import { createProduct } from '@/lib/actions';

function ProductForm() {
  async function handleSubmit(formData: FormData) {
    const result = await createProduct({
      name: formData.get('name'),
      price: parseFloat(formData.get('price')),
    });
    
    if (result.success) {
      toast.success('Product created!');
    }
  }
  
  return <form action={handleSubmit}>...</form>;
}
```

### 3. Suspense Boundaries
```typescript
import { Suspense } from 'react';

export default function Page() {
  return (
    <Suspense fallback={<LoadingSpinner />}>
      <AsyncProductList />
    </Suspense>
  );
}
```

### 4. Error Boundaries
```typescript
// components/ErrorBoundary.tsx
export class ErrorBoundary extends Component<Props, State> {
  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }
  
  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error('Error:', error, errorInfo);
  }
  
  render() {
    if (this.state.hasError) {
      return <ErrorDisplay error={this.state.error} />;
    }
    return this.props.children;
  }
}
```

### 5. Custom Hooks with Generics
```typescript
// lib/hooks.ts
export function useFetch<T>(url: string) {
  const [data, setData] = useState<T | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  useEffect(() => {
    fetch(url)
      .then(res => res.json())
      .then(setData)
      .catch(err => setError(err.message))
      .finally(() => setLoading(false));
  }, [url]);
  
  return { data, loading, error };
}

// Usage with type inference
const { data } = useFetch<Product>('/api/products/1');
// data is typed as Product | null
```

### 6. useCallback and useMemo with Types
```typescript
const fetchData = useCallback(async (id: string): Promise<Product> => {
  const response = await fetch(`/api/products/${id}`);
  return response.json();
}, []);

const expensiveComputation = useMemo(
  (): ComputedValue => {
    return products.reduce((acc, p) => acc + p.price, 0);
  },
  [products]
);
```

## API Development

### 1. Type-Safe API Responses
```typescript
// lib/api-utils.ts
export function apiSuccess<T>(data: T, status = 200) {
  return NextResponse.json({ success: true, data }, { status });
}

// Usage in API route
export async function GET() {
  const products = await db.products.findAll();
  return apiSuccess({ products }); // Type-safe!
}
```

### 2. Zod Schema Validation
```typescript
// lib/validations.ts
export const CreateProductSchema = z.object({
  name: z.string().min(1).max(200),
  price: z.number().positive(),
  stock: z.number().int().nonnegative(),
});

// In API route
export async function POST(request: NextRequest) {
  const body = await request.json();
  
  // Validates and throws if invalid
  const validated = CreateProductSchema.parse(body);
  
  // validated is now typed correctly
  const product = await createProduct(validated);
  return apiSuccess({ product });
}
```

### 3. Error Handling with Types
```typescript
// lib/api-utils.ts
export function handleApiError(error: unknown) {
  if (error instanceof ZodError) {
    return handleValidationError(error);
  }
  
  if (error instanceof Error) {
    return apiError(error.message);
  }
  
  return apiError('An unexpected error occurred');
}
```

## Database with Prisma

### 1. Type-Safe Queries
```typescript
// Prisma provides full TypeScript support
const products = await prisma.product.findMany({
  where: {
    stock: { gt: 0 },
    price: { lte: 100 },
  },
  include: {
    orderItems: {
      include: {
        order: true,
      },
    },
  },
  orderBy: {
    createdAt: 'desc',
  },
});

// products is fully typed including all relations!
```

### 2. Transactions with Types
```typescript
const result = await prisma.$transaction(async (tx) => {
  const order = await tx.order.create({ data: orderData });
  
  await tx.product.updateMany({
    where: { id: { in: productIds } },
    data: { stock: { decrement: 1 } },
  });
  
  return order;
});

// result is typed as Order
```

## Authentication

### 1. Type-Safe Sessions
```typescript
// types/next-auth.d.ts extends NextAuth types
declare module 'next-auth' {
  interface Session {
    user: {
      id: string;
      role: 'ADMIN' | 'CUSTOMER';
    } & DefaultSession['user'];
  }
}

// Usage
const session = await auth();
if (session?.user?.role === 'ADMIN') {
  // TypeScript knows role is 'ADMIN' | 'CUSTOMER'
}
```

### 2. Protected Routes
```typescript
export default async function AdminPage() {
  const session = await auth();
  
  if (!session || session.user.role !== 'ADMIN') {
    redirect('/auth/signin');
  }
  
  // TypeScript enforces the session exists here
  return <AdminPanel user={session.user} />;
}
```

## Best Practices

### 1. Prefer Type Inference
```typescript
// Bad
const products: Product[] = await fetchProducts();

// Good - let TypeScript infer
const products = await fetchProducts(); // already returns Product[]
```

### 2. Use Zod for Runtime Validation
```typescript
// Bad
function processOrder(data: any) {
  if (typeof data.total !== 'number') throw new Error();
  // ... more validation
}

// Good
const OrderSchema = z.object({
  total: z.number().positive(),
  items: z.array(OrderItemSchema),
});

function processOrder(data: unknown) {
  const validated = OrderSchema.parse(data); // Type-safe!
  // ... process
}
```

### 3. Async/Await with Proper Error Handling
```typescript
async function fetchData(): Promise<AsyncResult<Data>> {
  try {
    const response = await fetch('/api/data');
    if (!response.ok) throw new Error('Failed');
    const data = await response.json();
    return { success: true, data };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    };
  }
}
```

### 4. Use const for Constants
```typescript
// Bad
let MAX_RETRIES = 3;

// Good
const MAX_RETRIES = 3;
const CONFIG = {
  timeout: 5000,
  retries: MAX_RETRIES,
} as const;
```

### 5. Destructure with Types
```typescript
// In function parameters
function processProduct({ name, price }: Product) {
  // ...
}

// In async parameters
export default async function Page({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ page?: string }>;
}) {
  const { id } = await params;
  // ...
}
```

## Performance Patterns

### 1. Memoization
```typescript
const MemoizedComponent = memo(function ProductCard({ product }: Props) {
  return <div>{product.name}</div>;
});
```

### 2. Lazy Loading
```typescript
const AdminPanel = lazy(() => import('@/components/AdminPanel'));

function App() {
  return (
    <Suspense fallback={<Loading />}>
      <AdminPanel />
    </Suspense>
  );
}
```

### 3. Debouncing with Hooks
```typescript
const debouncedSearch = useDebounce(searchTerm, 500);

useEffect(() => {
  if (debouncedSearch) {
    searchProducts(debouncedSearch);
  }
}, [debouncedSearch]);
```

## Conclusion

This project leverages the latest TypeScript and React features to provide:
- **Type Safety**: Catch errors at compile time
- **Better DX**: Autocomplete and IntelliSense
- **Runtime Safety**: Zod validation
- **Performance**: React Server Components and caching
- **Maintainability**: Clear patterns and structure
