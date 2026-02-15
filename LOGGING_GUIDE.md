# Server-Side Logging Guide

## Overview

This application uses **Pino** for structured, high-performance logging. All logs are output in JSON format in production for easy integration with log aggregation services (Datadog, Vercel Analytics, CloudWatch, etc.).

## Logger Infrastructure

### Core Logger (`lib/logger.ts`)

The centralized logging utility provides specialized functions for different types of events:

```typescript
import { 
  logger, 
  logApiRequest,
  logDatabaseOperation,
  logAuthEvent,
  logBusinessEvent,
  logError,
  logPerformance,
  logCacheOperation,
  Timer
} from '@/lib/logger';
```

### Log Levels

- **debug**: Detailed information for diagnosing issues (cache hits, db queries)
- **info**: General informational messages (successful operations)
- **warn**: Warning messages (slow queries, failed logins)
- **error**: Error messages (exceptions, failed operations)

Set log level via environment variable:
```bash
LOG_LEVEL=debug  # development
LOG_LEVEL=info   # production (default)
```

## Log Types

### 1. API Request Logs

Automatically logged when using `withLogging()` middleware:

```typescript
import { withLogging } from '@/lib/api-middleware';

async function handleGet(request: NextRequest) {
  // Your handler code
}

export const GET = withLogging(handleGet);
```

**Log Output:**
```json
{
  "level": "info",
  "type": "api_request",
  "method": "GET",
  "path": "/api/products",
  "requestId": "req_1234567890_abc123",
  "userId": "user_xyz",
  "duration": 145,
  "statusCode": 200,
  "msg": "API request completed"
}
```

**Features:**
- Unique request ID for tracing
- User identification
- Request duration in milliseconds
- HTTP status code
- Automatic error detection (status >= 400)

### 2. Database Operation Logs

Automatically logged in `lib/db.ts` for all database operations:

```typescript
logDatabaseOperation({
  operation: 'findMany',
  model: 'Product',
  duration: 45,
  recordCount: 20,
  success: true,
});
```

**Log Output:**
```json
{
  "level": "debug",
  "type": "database_operation",
  "operation": "findMany",
  "model": "Product",
  "duration": 45,
  "recordCount": 20,
  "success": true,
  "msg": "Database operation completed"
}
```

**Slow Query Detection:**
Queries taking >1000ms are automatically logged as warnings.

### 3. Authentication Event Logs

Logged in `lib/auth.ts` for all auth-related events:

```typescript
logAuthEvent({
  event: 'login',
  userId: 'user_123',
  email: 'user@example.com',
  provider: 'google',
  success: true,
});
```

**Tracked Events:**
- `login` - User signs in
- `logout` - User signs out
- `register` - New user registration
- `failed_login` - Failed login attempt
- `session_created` - New session created
- `session_expired` - Session expired

**Log Output:**
```json
{
  "level": "info",
  "type": "auth_event",
  "event": "login",
  "userId": "user_123",
  "email": "user@example.com",
  "provider": "google",
  "success": true,
  "msg": "Authentication event: login"
}
```

### 4. Business Event Logs

Track important business operations:

```typescript
import { logBusinessEvent } from '@/lib/logger';

logBusinessEvent({
  event: 'order_created',
  userId: 'user_123',
  details: {
    orderId: 'order_456',
    totalAmount: 99.99,
    itemCount: 3,
  },
  success: true,
});
```

**Common Events:**
- `order_created` - New order placed
- `order_cancelled` - Order cancelled
- `cart_item_added` - Item added to cart
- `product_created` - New product added
- `product_updated` - Product updated
- `payment_processed` - Payment completed

**Log Output:**
```json
{
  "level": "info",
  "type": "business_event",
  "event": "order_created",
  "userId": "user_123",
  "details": {
    "orderId": "order_456",
    "totalAmount": 99.99,
    "itemCount": 3
  },
  "success": true,
  "msg": "Business event: order_created"
}
```

### 5. Error Logs

Comprehensive error logging with stack traces:

```typescript
import { logError } from '@/lib/logger';

try {
  // Your code
} catch (error) {
  logError({
    error,
    context: 'order_creation',
    userId: 'user_123',
    requestId: 'req_123',
    additionalInfo: {
      orderId: 'order_456',
    },
  });
}
```

**Log Output:**
```json
{
  "level": "error",
  "type": "error",
  "context": "order_creation",
  "userId": "user_123",
  "requestId": "req_123",
  "errorName": "ValidationError",
  "errorMessage": "Invalid product ID",
  "stack": "Error: Invalid product ID\n    at ...",
  "orderId": "order_456",
  "msg": "Error occurred: order_creation"
}
```

### 6. Performance Logs

Track operation timing:

```typescript
import { Timer, logPerformance } from '@/lib/logger';

// Using Timer class
const timer = new Timer('expensive_operation');
// ... do work ...
const duration = timer.end({ metadata: 'value' });

// Or manually
logPerformance({
  operation: 'data_processing',
  duration: 1500,
  metadata: { recordCount: 1000 },
});
```

**Slow Operation Detection:**
Operations taking >1000ms are automatically logged as warnings.

**Log Output:**
```json
{
  "level": "warn",
  "type": "performance",
  "operation": "data_processing",
  "duration": 1500,
  "metadata": { "recordCount": 1000 },
  "msg": "Slow operation detected: data_processing"
}
```

### 7. Cache Operation Logs

Logged automatically in `lib/redis.ts`:

```typescript
logCacheOperation({
  operation: 'hit',
  key: 'products:all',
  success: true,
});
```

**Operations:**
- `hit` - Cache hit (data found)
- `miss` - Cache miss (data not found)
- `set` - Data cached
- `invalidate` - Cache cleared

**Log Output:**
```json
{
  "level": "debug",
  "type": "cache_operation",
  "operation": "hit",
  "key": "products:all",
  "success": true,
  "msg": "Cache hit: products:all"
}
```

## Usage Examples

### Adding Logging to a New API Route

```typescript
import { NextRequest, NextResponse } from 'next/server';
import { withLogging } from '@/lib/api-middleware';
import { logBusinessEvent, logError } from '@/lib/logger';

async function handlePost(request: NextRequest) {
  try {
    const body = await request.json();
    
    // Your business logic
    const result = await processData(body);
    
    // Log success
    logBusinessEvent({
      event: 'data_processed',
      details: { recordCount: result.length },
      success: true,
    });
    
    return NextResponse.json({ success: true, data: result });
  } catch (error) {
    logError({
      error,
      context: 'data_processing',
      additionalInfo: { path: request.nextUrl.pathname },
    });
    
    return NextResponse.json(
      { error: 'Processing failed' },
      { status: 500 }
    );
  }
}

export const POST = withLogging(handlePost);
```

### Adding Logging to Business Logic

```typescript
import { logBusinessEvent, Timer } from '@/lib/logger';

export async function createProduct(data: ProductInput) {
  const timer = new Timer('product_creation');
  
  try {
    const product = await prisma.product.create({ data });
    
    timer.end({ productId: product.id });
    
    logBusinessEvent({
      event: 'product_created',
      details: {
        productId: product.id,
        name: product.name,
        price: product.price,
      },
      success: true,
    });
    
    return product;
  } catch (error) {
    timer.end({ error: true });
    throw error;
  }
}
```

## Request Tracing

Each API request gets a unique `requestId` that can be used to trace the request through the system:

1. Generated in `withLogging()` middleware
2. Included in all logs related to that request
3. Returned in response header `X-Request-ID`
4. Use it to search logs for all events in a single request

**Example: Finding all logs for a request**
```bash
# In production logs
grep "req_1234567890_abc123" application.log
```

## Development vs. Production

### Development Mode
- Pretty-printed logs with colors
- Debug level enabled by default
- Human-readable timestamps
- Easier to read in terminal

**Example Output:**
```
[12:34:56] INFO (api_request): API request completed
    method: "POST"
    path: "/api/orders"
    duration: 245
    statusCode: 201
```

### Production Mode
- JSON format (one line per log)
- Info level by default
- ISO timestamps
- Ready for log aggregation services

**Example Output:**
```json
{"level":"info","time":1701234567890,"type":"api_request","method":"POST","path":"/api/orders","duration":245,"statusCode":201,"msg":"API request completed"}
```

## Integration with Log Services

### Vercel

Logs are automatically captured by Vercel. View them in:
- Vercel Dashboard → Your Project → Logs
- Filter by log level
- Search by request ID or user ID

### Datadog

Add Datadog integration:

```bash
# Install Datadog Lambda Layer or use DD_API_KEY
export DD_API_KEY=your-api-key
export DD_SITE=datadoghq.com
```

### Custom Service

All logs go to stdout in JSON format. Redirect to your logging service:

```typescript
// Optional: Send to external service
logger.addDestination({
  write: (log) => {
    // Send to your logging service
    fetch('https://your-log-service.com/ingest', {
      method: 'POST',
      body: JSON.stringify(log),
    });
  },
});
```

## Best Practices

### 1. Log at the Right Level

```typescript
// ✅ Good
logger.debug('Cache hit for key: products:all');
logger.info('Order created successfully');
logger.warn('Slow query detected: 1500ms');
logger.error('Failed to process payment');

// ❌ Bad
logger.info('Starting function'); // Too verbose
logger.error('User not found'); // Should be warn
```

### 2. Include Context

```typescript
// ✅ Good
logError({
  error,
  context: 'payment_processing',
  userId: 'user_123',
  additionalInfo: {
    orderId: 'order_456',
    amount: 99.99,
  },
});

// ❌ Bad
console.error('Payment failed');
```

### 3. Don't Log Sensitive Data

```typescript
// ✅ Good
logBusinessEvent({
  event: 'payment_processed',
  details: {
    orderId: 'order_123',
    amount: 99.99,
    lastFourDigits: '1234',
  },
  success: true,
});

// ❌ Bad
logBusinessEvent({
  event: 'payment_processed',
  details: {
    creditCardNumber: '1234567890123456', // NEVER!
    cvv: '123', // NEVER!
  },
  success: true,
});
```

### 4. Use Structured Data

```typescript
// ✅ Good
logBusinessEvent({
  event: 'order_created',
  details: {
    orderId: order.id,
    totalAmount: order.total,
    itemCount: order.items.length,
  },
  success: true,
});

// ❌ Bad
logger.info(`Order ${order.id} created with ${order.items.length} items`);
```

### 5. Log Failures with Reasons

```typescript
// ✅ Good
logBusinessEvent({
  event: 'order_create_failed',
  details: {
    reason: 'insufficient_stock',
    productId: 'prod_123',
    requested: 5,
    available: 2,
  },
  success: false,
});

// ❌ Bad
logBusinessEvent({
  event: 'order_failed',
  details: {},
  success: false,
});
```

## Performance Considerations

Pino is designed for high performance:
- **Asynchronous logging**: Doesn't block your application
- **JSON serialization**: Optimized for speed
- **Minimal overhead**: < 1ms per log in most cases
- **Serverless-friendly**: Works great with AWS Lambda, Vercel, etc.

## Troubleshooting

### Logs Not Appearing in Development

1. Check LOG_LEVEL environment variable:
   ```bash
   export LOG_LEVEL=debug
   ```

2. Ensure pino-pretty is installed:
   ```bash
   npm install pino-pretty
   ```

### Logs Not Structured in Production

Make sure `NODE_ENV=production` is set. Pino automatically switches to JSON format in production.

### Too Many Debug Logs

Set log level to info or warn:
```bash
export LOG_LEVEL=info
```

## Related Files

- `lib/logger.ts` - Core logger utility
- `lib/api-middleware.ts` - API logging middleware
- `lib/db.ts` - Database logging
- `lib/redis.ts` - Cache logging
- `lib/auth.ts` - Authentication logging

## Support

For issues or questions:
1. Check Vercel logs dashboard
2. Search logs by request ID
3. Use structured queries in your log aggregation service
4. Review error logs with stack traces
