import { NextRequest, NextResponse } from 'next/server';
import { drizzleDb } from '@/lib/db';
import * as schema from '@/lib/schema';
import { eq, inArray, sql, desc } from 'drizzle-orm';
import { invalidateCache } from '@/lib/redis';
import { CreateOrderInput } from '@/lib/types';
import { withLogging } from '@/lib/api-middleware';
import { logBusinessEvent, logError } from '@/lib/logger';
import { auth } from '@/lib/auth';

export const dynamic = 'force-dynamic';

async function handleGet(_request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json(
        { error: 'Authentication required' },
        { status: 401 }
      );
    }

    const orders = await drizzleDb.query.orders.findMany({
      where: eq(schema.orders.userId, session.user.id),
      with: {
        items: {
          with: {
            product: true,
            variation: true,
          },
        },
      },
      orderBy: [desc(schema.orders.createdAt)],
    });

    return NextResponse.json({
      orders: orders.map((order) => ({
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
    // Check authentication
    const session = await auth();
    if (!session?.user?.id) {
      logBusinessEvent({
        event: 'order_create_failed',
        details: { reason: 'not_authenticated' },
        success: false,
      });
      return NextResponse.json(
        { error: 'Authentication required. Please sign in to place orders.' },
        { status: 401 }
      );
    }

    const body: CreateOrderInput = await request.json();
    
    // Validate input - now we get customer info from session
    if (!body.items || body.items.length === 0) {
      logBusinessEvent({
        event: 'order_create_failed',
        details: { reason: 'missing_items' },
        success: false,
      });
      return NextResponse.json(
        { error: 'Order must contain at least one item' },
        { status: 400 }
      );
    }

    // Use customer info from session, with optional override from body
    const customerName = body.customerName || session.user.name || 'Unknown';
    const customerEmail = body.customerEmail || session.user.email;
    const customerAddress = body.customerAddress || '';

    if (!customerEmail) {
      logBusinessEvent({
        event: 'order_create_failed',
        details: { reason: 'missing_email' },
        success: false,
      });
      return NextResponse.json(
        { error: 'Email address is required. Please update your profile.' },
        { status: 400 }
      );
    }

    if (!customerAddress) {
      logBusinessEvent({
        event: 'order_create_failed',
        details: { reason: 'missing_address' },
        success: false,
      });
      return NextResponse.json(
        { error: 'Shipping address is required' },
        { status: 400 }
      );
    }

    // Calculate total and verify product/variation availability
    let totalAmount = 0;
    const productIds = body.items.map(item => item.productId);
    const products = await drizzleDb.query.products.findMany({
      where: inArray(schema.products.id, productIds),
      with: { variations: true },
    });

    type ProductWithVariations = (typeof products)[number];
    type ProductVariation = ProductWithVariations['variations'][number];

    if (products.length !== body.items.length) {
      logBusinessEvent({
        event: 'order_create_failed',
        details: { reason: 'products_not_found', requestedCount: body.items.length, foundCount: products.length },
        success: false,
      });
      return NextResponse.json(
        { error: 'Some products not found' },
        { status: 404 }
      );
    }

    // Check stock and calculate total
    for (const item of body.items) {
      const product = products.find((p: ProductWithVariations) => p.id === item.productId);
      if (!product) {
        return NextResponse.json(
          { error: `Product ${item.productId} not found` },
          { status: 404 }
        );
      }
      
      let price = product.price;
      let stockToCheck = product.stock;
      
      // If variation is selected, use variation price and stock
      if (item.variationId) {
        const variation = product.variations.find((v: ProductVariation) => v.id === item.variationId);
        if (!variation) {
          return NextResponse.json(
            { error: `Variation not found for ${product.name}` },
            { status: 404 }
          );
        }
        price = product.price + variation.priceModifier;
        stockToCheck = variation.stock;
      }
      
      if (stockToCheck < item.quantity) {
        logBusinessEvent({
          event: 'order_create_failed',
          details: { 
            reason: 'insufficient_stock', 
            productId: product.id,
            productName: product.name,
            requested: item.quantity,
            available: stockToCheck,
          },
          success: false,
        });
        return NextResponse.json(
          { error: `Insufficient stock for ${product.name}` },
          { status: 400 }
        );
      }
      
      totalAmount += price * item.quantity;
    }

    // Create order and update stock in a transaction
    const order = await drizzleDb.transaction(async (tx) => {
      // Create order with userId
      const [newOrder] = await tx.insert(schema.orders).values({
        userId: session.user.id,
        customerName,
        customerEmail,
        customerAddress,
        totalAmount,
        status: 'PENDING',
        updatedAt: new Date(),
      }).returning();

      // Create order items
      await tx.insert(schema.orderItems).values(
        body.items.map(item => {
          const product = products.find((p: ProductWithVariations) => p.id === item.productId)!;
          let price = product.price;

          if (item.variationId) {
            const variation = product.variations.find((v: ProductVariation) => v.id === item.variationId);
            if (variation) {
              price = product.price + variation.priceModifier;
            }
          }

          return {
            orderId: newOrder.id,
            productId: item.productId,
            variationId: item.variationId ?? null,
            quantity: item.quantity,
            price,
          };
        })
      );

      // Update product/variation stock
      for (const item of body.items) {
        if (item.variationId) {
          // Update variation stock
          await tx.update(schema.productVariations)
            .set({ stock: sql`${schema.productVariations.stock} - ${item.quantity}`, updatedAt: new Date() })
            .where(eq(schema.productVariations.id, item.variationId));
        }

        // Always update total product stock
        await tx.update(schema.products)
          .set({ stock: sql`${schema.products.stock} - ${item.quantity}`, updatedAt: new Date() })
          .where(eq(schema.products.id, item.productId));
      }

      return newOrder;
    });

    // Re-fetch order with items, product, and variation details
    const fullOrder = await drizzleDb.query.orders.findFirst({
      where: eq(schema.orders.id, order.id),
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
