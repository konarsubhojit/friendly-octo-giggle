import { NextRequest, NextResponse } from 'next/server';
import { drizzleDb } from '@/lib/db';
import * as schema from '@/lib/schema';
import { eq, and, isNull } from 'drizzle-orm';
import { auth } from '@/lib/auth';
import { AddToCartSchema, type AddToCartInput } from '@/lib/validations';
import { handleValidationError } from '@/lib/api-utils';
import type { Session } from 'next-auth';

export const dynamic = 'force-dynamic';

// Types for cart operations
interface ProductWithVariations {
  id: string;
  stock: number;
  variations: Array<{ id: string; stock: number }>;
}

interface CartWithItems {
  id: string;
  createdAt: Date;
  updatedAt: Date;
  items: Array<{
    id: string;
    quantity: number;
    createdAt: Date;
    updatedAt: Date;
    product: {
      id: string;
      createdAt: Date;
      updatedAt: Date;
      variations: Array<{ createdAt: Date; updatedAt: Date }>;
    };
    variation: { createdAt: Date; updatedAt: Date } | null;
  }>;
}

// Helper: Verify product exists and has sufficient stock
async function verifyProductStock(
  body: AddToCartInput
): Promise<{ product: ProductWithVariations; availableStock: number } | { error: string; status: number }> {
  const product = await drizzleDb.query.products.findFirst({
    where: eq(schema.products.id, body.productId),
    with: { variations: true },
  });

  if (!product) {
    return { error: 'Product not found', status: 404 };
  }

  let availableStock = product.stock;
  if (body.variationId) {
    const variation = product.variations.find((v) => v.id === body.variationId);
    if (!variation) {
      return { error: 'Variation not found', status: 404 };
    }
    availableStock = variation.stock;
  }

  if (availableStock < body.quantity) {
    return { error: 'Insufficient stock', status: 400 };
  }

  return { product, availableStock };
}

// Helper: Get or create cart for user/guest
async function getOrCreateCart(
  session: Session | null,
  sessionId: string | undefined
): Promise<{ cart: { id: string }; sessionId: string | undefined }> {
  if (session?.user?.id) {
    let cart = await drizzleDb.query.carts.findFirst({
      where: eq(schema.carts.userId, session.user.id),
    });
    if (!cart) {
      [cart] = await drizzleDb.insert(schema.carts).values({ userId: session.user.id, updatedAt: new Date() }).returning();
    }
    return { cart, sessionId: undefined };
  }

  // Guest user
  const guestSessionId = sessionId ?? `guest_${Date.now()}_${Math.random().toString(36).substring(7)}`;
  let cart = await drizzleDb.query.carts.findFirst({
    where: eq(schema.carts.sessionId, guestSessionId),
  });
  if (!cart) {
    [cart] = await drizzleDb.insert(schema.carts).values({ sessionId: guestSessionId, updatedAt: new Date() }).returning();
  }
  return { cart, sessionId: guestSessionId };
}

// Helper: Add or update cart item
async function addOrUpdateCartItem(
  cartId: string,
  body: AddToCartInput,
  availableStock: number
): Promise<{ error: string; status: number } | null> {
  const existingItem = await drizzleDb.query.cartItems.findFirst({
    where: and(
      eq(schema.cartItems.cartId, cartId),
      eq(schema.cartItems.productId, body.productId),
      body.variationId
        ? eq(schema.cartItems.variationId, body.variationId)
        : isNull(schema.cartItems.variationId)
    ),
  });

  if (existingItem) {
    const newQuantity = existingItem.quantity + body.quantity;
    if (newQuantity > availableStock) {
      return { error: 'Insufficient stock', status: 400 };
    }
    await drizzleDb.update(schema.cartItems)
      .set({ quantity: newQuantity, updatedAt: new Date() })
      .where(eq(schema.cartItems.id, existingItem.id));
  } else {
    await drizzleDb.insert(schema.cartItems).values({
      cartId,
      productId: body.productId,
      variationId: body.variationId ?? null,
      quantity: body.quantity,
      updatedAt: new Date(),
    });
  }

  return null;
}

// Helper: Serialize cart for JSON response
function serializeCart(cart: CartWithItems) {
  return {
    ...cart,
    createdAt: cart.createdAt.toISOString(),
    updatedAt: cart.updatedAt.toISOString(),
    items: cart.items.map((item) => ({
      ...item,
      createdAt: item.createdAt.toISOString(),
      updatedAt: item.updatedAt.toISOString(),
      product: {
        ...item.product,
        createdAt: item.product.createdAt.toISOString(),
        updatedAt: item.product.updatedAt.toISOString(),
        variations: item.product.variations.map((v) => ({
          ...v,
          createdAt: v.createdAt.toISOString(),
          updatedAt: v.updatedAt.toISOString(),
        })),
      },
      variation: item.variation
        ? {
            ...item.variation,
            createdAt: item.variation.createdAt.toISOString(),
            updatedAt: item.variation.updatedAt.toISOString(),
          }
        : null,
    })),
  };
}

// Get cart for current user/session
export async function GET(request: NextRequest) {
  try {
    const session = await auth();
    const sessionId = request.cookies.get('cart_session')?.value;

    if (!session?.user?.id && !sessionId) {
      return NextResponse.json({ cart: null });
    }

    const cart = await drizzleDb.query.carts.findFirst({
      where: session?.user?.id
        ? eq(schema.carts.userId, session.user.id)
        : eq(schema.carts.sessionId, sessionId!),
      with: {
        items: {
          with: {
            product: { with: { variations: true } },
            variation: true,
          },
        },
      },
    });

    if (!cart) {
      return NextResponse.json({ cart: null });
    }

    return NextResponse.json({ cart: serializeCart(cart as unknown as CartWithItems) });
  } catch (error) {
    console.error('Error fetching cart:', error);
    return NextResponse.json({ error: 'Failed to fetch cart' }, { status: 500 });
  }
}

// Add item to cart
export async function POST(request: NextRequest) {
  try {
    const session = await auth();
    const rawBody = await request.json();

    // Validate input
    const parseResult = AddToCartSchema.safeParse(rawBody);
    if (!parseResult.success) {
      return handleValidationError(parseResult.error);
    }
    const body = parseResult.data;

    // Verify product and stock
    const stockResult = await verifyProductStock(body);
    if ('error' in stockResult) {
      return NextResponse.json({ error: stockResult.error }, { status: stockResult.status });
    }
    const { availableStock } = stockResult;

    // Get or create cart
    const cookieSessionId = request.cookies.get('cart_session')?.value;
    const { cart, sessionId } = await getOrCreateCart(session, cookieSessionId);

    // Add or update item
    const itemError = await addOrUpdateCartItem(cart.id, body, availableStock);
    if (itemError) {
      return NextResponse.json({ error: itemError.error }, { status: itemError.status });
    }

    // Fetch updated cart
    const updatedCart = await drizzleDb.query.carts.findFirst({
      where: eq(schema.carts.id, cart.id),
      with: {
        items: {
          with: {
            product: { with: { variations: true } },
            variation: true,
          },
        },
      },
    });

    if (!updatedCart) {
      return NextResponse.json({ error: 'Cart not found' }, { status: 404 });
    }

    // Build response with session cookie for guests
    const response = NextResponse.json(
      { cart: serializeCart(updatedCart as unknown as CartWithItems) },
      { status: 201 }
    );

    if (!session?.user?.id && sessionId) {
      response.cookies.set('cart_session', sessionId, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax',
        maxAge: 60 * 60 * 24 * 30,
      });
    }

    return response;
  } catch (error) {
    console.error('Error adding to cart:', error);
    return NextResponse.json({ error: 'Failed to add to cart' }, { status: 500 });
  }
}

// Clear cart (for after order is placed)
export async function DELETE(request: NextRequest) {
  try {
    const session = await auth();
    const sessionId = request.cookies.get('cart_session')?.value;

    if (!session?.user?.id && !sessionId) {
      return NextResponse.json({ success: true });
    }

    const cart = await drizzleDb.query.carts.findFirst({
      where: session?.user?.id
        ? eq(schema.carts.userId, session.user.id)
        : eq(schema.carts.sessionId, sessionId!),
    });

    if (cart) {
      await drizzleDb.delete(schema.carts).where(eq(schema.carts.id, cart.id));
    }

    const response = NextResponse.json({ success: true });
    // Clear cart session cookie
    if (!session?.user?.id && sessionId) {
      response.cookies.delete('cart_session');
    }

    return response;
  } catch (error) {
    console.error('Error clearing cart:', error);
    return NextResponse.json(
      { error: 'Failed to clear cart' },
      { status: 500 }
    );
  }
}
