import { NextRequest, NextResponse } from 'next/server';
import { drizzleDb } from '@/lib/db';
import { orders, orderItems, products, productVariations } from '@/lib/schema';
import { eq, inArray, sql, desc } from 'drizzle-orm';
import { invalidateCache } from '@/lib/redis';
import { CreateOrderInput, OrderItemInput } from '@/lib/types';
import { withLogging } from '@/lib/api-middleware';
import { logBusinessEvent, logError } from '@/lib/logger';
import { auth } from '@/lib/auth';

export const dynamic = 'force-dynamic';

// Type for products with variations
type ProductWithVariations = Awaited<ReturnType<typeof drizzleDb.query.products.findMany>>[number] & {
  variations: Array<{ id: string; priceModifier: number; stock: number }>;
};

// Validation result type
type ValidationResult = 
  | { valid: true; customerName: string; customerEmail: string; customerAddress: string }
  | { valid: false; error: string; status: number; reason: string };

// Stock check result type
type StockCheckResult = 
  | { valid: true; totalAmount: number }
  | { valid: false; error: string; status: number; reason: string; details?: Record<string, unknown> };

function validateCustomerInfo(
  body: CreateOrderInput,
  session: { user: { id: string; name?: string | null; email?: string | null } }
): ValidationResult {
  const customerName = body.customerName || session.user.name || 'Unknown';
  const customerEmail = body.customerEmail || session.user.email;
  const customerAddress = body.customerAddress || '';

  const errorMap: Record<'missing_email' | 'missing_address', { error: string; status: number; reason: string }> = {
    missing_email: {
      error: 'Email address is required. Please update your profile.',
      status: 400,
      reason: 'missing_email',
    },
    missing_address: {
      error: 'Shipping address is required',
      status: 400,
      reason: 'missing_address',
    },
  };

  const checks: [boolean, keyof typeof errorMap][] = [
    [!customerEmail, 'missing_email'],
    [!customerAddress, 'missing_address'],
  ];
  const found = checks.find(([cond]) => cond);
  if (found) {
    const [, reason] = found;
    return { valid: false, ...errorMap[reason] };
  }

  return { valid: true, customerName, customerEmail, customerAddress };
}

function checkStockForItem(
  item: OrderItemInput,
  product: ProductWithVariations
): StockCheckResult {
  let price = product.price;
  let stockToCheck = product.stock;

  if (item.variationId) {
    const variation = product.variations.find((v) => v.id === item.variationId);
    if (!variation) {
      return { valid: false, error: `Variation not found for ${product.name}`, status: 404, reason: 'variation_not_found' };
    }
    price = product.price + variation.priceModifier;
    stockToCheck = variation.stock;
  }

  if (stockToCheck < item.quantity) {
    return {
      valid: false,
      error: `Insufficient stock for ${product.name}`,
      status: 400,
      reason: 'insufficient_stock',
      details: { productId: product.id, productName: product.name, requested: item.quantity, available: stockToCheck },
    };
  }

  return { valid: true, totalAmount: price * item.quantity };
}

function validateStockAndCalculateTotal(
  items: OrderItemInput[],
  products: ProductWithVariations[]
): StockCheckResult {
  let totalAmount = 0;

  for (const item of items) {
    const product = products.find((p) => p.id === item.productId);
    if (!product) {
      return { valid: false, error: `Product ${item.productId} not found`, status: 404, reason: 'product_not_found' };
    }

    const result = checkStockForItem(item, product);
    if (!result.valid) {
      return result;
    }
    totalAmount += result.totalAmount;
  }

  return { valid: true, totalAmount };
}

async function handleGet(_request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json(
        { error: 'Authentication required' },
        { status: 401 }
      );
    }

    const orderList = await drizzleDb.query.orders.findMany({
      where: eq(orders.userId, session.user.id),
      with: {
        items: {
          with: {
            product: true,
            variation: true,
          },
        },
      },
      orderBy: [desc(orders.createdAt)],
    });

    return NextResponse.json({
      orders: orderList.map((order) => ({
        ...order,
        createdAt: order.createdAt.toISOString(),
        updatedAt: order.updatedAt.toISOString(),
        items: order.items.map((item) => ({
          ...item,
          product: {
            ...item.product,
            createdAt: item.product.createdAt.toISOString(),
            updatedAt: item.product.updatedAt.toISOString(),
          },
        })),
      })),
    });
  } catch (error) {
    logError({
      error,
      context: 'fetch_user_orders',
    });
    return NextResponse.json(
      { error: 'Failed to fetch orders' },
      { status: 500 }
    );
  }
}

async function handlePost(request: NextRequest) {
  try {
    const session = await auth();
    const body: CreateOrderInput = await request.json();
    const customerValidation = validateCustomerInfo(body, session);
    const reason =
      !session?.user?.id
        ? 'not_authenticated'
        : !body.items || body.items.length === 0
        ? 'missing_items'
        : !customerValidation.valid
        ? customerValidation.reason
        : null;
    if (reason) {
      const errorMapping = {
        not_authenticated: {
          error: 'Authentication required. Please sign in to place orders.',
          status: 401,
        },
        missing_items: {
          error: 'Order must contain at least one item',
          status: 400,
        },
        [customerValidation.reason]: {
          error: customerValidation.error,
          status: customerValidation.status,
        },
      };
      logBusinessEvent({
        event: 'order_create_failed',
        details: { reason },
        success: false,
      });
      const { error, status } = errorMapping[reason];
      return NextResponse.json({ error }, { status });
    }
    const { customerName, customerEmail, customerAddress } = customerValidation;

    // Fetch products with variations
    const productIds = body.items.map(item => item.productId);
    const productList = await drizzleDb.query.products.findMany({
      where: inArray(products.id, productIds),
      with: { variations: true },
    }) as ProductWithVariations[];

    if (productList.length !== body.items.length) {
      logBusinessEvent({ event: 'order_create_failed', details: { reason: 'products_not_found', requestedCount: body.items.length, foundCount: productList.length }, success: false });
      return NextResponse.json({ error: 'Some products not found' }, { status: 404 });
    }

    // Validate stock and calculate total
    const stockResult = validateStockAndCalculateTotal(body.items, productList);
    if (!stockResult.valid) {
      logBusinessEvent({ event: 'order_create_failed', details: { reason: stockResult.reason, ...stockResult.details }, success: false });
      return NextResponse.json({ error: stockResult.error }, { status: stockResult.status });
    }
    const { totalAmount } = stockResult;

    // Create order and update stock in a transaction
    const order = await drizzleDb.transaction(async (tx) => {
      // Create order with userId
      const [newOrder] = await tx.insert(orders).values({
        userId: session.user.id,
        customerName,
        customerEmail,
        customerAddress,
        totalAmount,
        status: 'PENDING',
        updatedAt: new Date(),
      }).returning();

      // Create order items
      await tx.insert(orderItems).values(
        body.items.map(item => {
          const product = productList.find((p) => p.id === item.productId);
          if (!product) {
            throw new Error(`Product with id ${item.productId} not found`);
          }
          const variationMap = new Map(product.variations.map((v) => [v.id, v.priceModifier]));
          const price = product.price + (variationMap.get(item.variationId) ?? 0);

          const rawNote = item.customizationNote;
          const trimmed = typeof rawNote === 'string' ? rawNote.trim() : '';
          const key = typeof rawNote !== 'string'
            ? 'invalid'
            : trimmed.length === 0
              ? 'empty'
              : trimmed.length > 500
                ? 'long'
                : 'valid';
          const noteMap: Record<string, string | null> = {
            invalid: null,
            empty: null,
            long: trimmed.slice(0, 500),
            valid: trimmed,
          };
          const customizationNote = noteMap[key];

          return { orderId: newOrder.id, productId: item.productId, variationId: item.variationId ?? null, quantity: item.quantity, price, customizationNote };
        })
      );

      // Update product/variation stock
      for (const item of body.items) {
        if (item.variationId) {
          // Update variation stock
          await tx.update(productVariations)
            .set({ stock: sql`${productVariations.stock} - ${item.quantity}`, updatedAt: new Date() })
            .where(eq(productVariations.id, item.variationId));
        }

        // Always update total product stock
        await tx.update(products)
          .set({ stock: sql`${products.stock} - ${item.quantity}`, updatedAt: new Date() })
          .where(eq(products.id, item.productId));
      }

      return newOrder;
    });

    // Re-fetch order with items, product, and variation details
    const fullOrder = await drizzleDb.query.orders.findFirst({
      where: eq(orders.id, order.id),
      with: { items: { with: { product: true, variation: true } } },
    });

    if (!fullOrder) {
      return NextResponse.json(
        { error: 'Failed to retrieve created order' },
        { status: 500 }
      );
    }

    // Infer order item type from the full order result
    type OrderItem = (typeof fullOrder.items)[number];

    // Log successful order creation
    logBusinessEvent({
      event: 'order_created',
      details: {
        orderId: fullOrder.id,
        totalAmount: fullOrder.totalAmount,
        itemCount: fullOrder.items.length,
        customerEmail: fullOrder.customerEmail,
      },
      success: true,
    });

    // Invalidate product cache
    await invalidateCache('products:*');
    for (const item of body.items) {
      await invalidateCache(`product:${item.productId}`);
    }
    
    // Invalidate order caches
    await invalidateCache('admin:orders:*');

    return NextResponse.json({ 
      order: {
        ...fullOrder,
        createdAt: fullOrder.createdAt.toISOString(),
        updatedAt: fullOrder.updatedAt.toISOString(),
        items: fullOrder.items.map((item: OrderItem) => ({
          ...item,
          product: {
            ...item.product,
            createdAt: item.product.createdAt.toISOString(),
            updatedAt: item.product.updatedAt.toISOString(),
          },
        })),
      },
    }, { status: 201 });
  } catch (error) {
    logError({
      error,
      context: 'order_creation',
      additionalInfo: {
        path: request.nextUrl.pathname,
      },
    });
    return NextResponse.json(
      { error: 'Failed to create order' },
      { status: 500 }
    );
  }
}

export const GET = withLogging(handleGet);
export const POST = withLogging(handlePost);
