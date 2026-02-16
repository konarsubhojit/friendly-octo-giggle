import { NextRequest, NextResponse } from 'next/server';
import { drizzleDb } from '@/lib/db';
import * as schema from '@/lib/schema';
import { eq } from 'drizzle-orm';
import { auth } from '@/lib/auth';
import { UpdateCartItemSchema } from '@/lib/validations';
import { handleValidationError } from '@/lib/api-utils';

export const dynamic = 'force-dynamic';

// Update cart item quantity
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const session = await auth();
    const sessionId = request.cookies.get('cart_session')?.value;
    const rawBody = await request.json();

    // Validate input with Zod
    const parseResult = UpdateCartItemSchema.safeParse(rawBody);
    if (!parseResult.success) {
      return handleValidationError(parseResult.error);
    }
    const body = parseResult.data;

    // Get cart item
    const cartItem = await drizzleDb.query.cartItems.findFirst({
      where: eq(schema.cartItems.id, id),
      with: {
        cart: true,
        product: {
          with: {
            variations: true,
          },
        },
        variation: true,
      },
    });

    if (!cartItem) {
      return NextResponse.json(
        { error: 'Cart item not found' },
        { status: 404 }
      );
    }

    // Verify cart ownership
    const isOwner = session?.user?.id
      ? cartItem.cart.userId === session.user.id
      : cartItem.cart.sessionId === sessionId;

    if (!isOwner) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 403 }
      );
    }

    // Check stock
    const availableStock = cartItem.variationId
      ? cartItem.variation?.stock || 0
      : cartItem.product.stock;

    if (body.quantity > availableStock) {
      return NextResponse.json(
        { error: 'Insufficient stock' },
        { status: 400 }
      );
    }

    // Update quantity
    await drizzleDb.update(schema.cartItems)
      .set({ quantity: body.quantity, updatedAt: new Date() })
      .where(eq(schema.cartItems.id, id));

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error updating cart item:', error);
    return NextResponse.json(
      { error: 'Failed to update cart item' },
      { status: 500 }
    );
  }
}

// Delete cart item
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const session = await auth();
    const sessionId = request.cookies.get('cart_session')?.value;

    // Get cart item
    const cartItem = await drizzleDb.query.cartItems.findFirst({
      where: eq(schema.cartItems.id, id),
      with: {
        cart: true,
      },
    });

    if (!cartItem) {
      return NextResponse.json(
        { error: 'Cart item not found' },
        { status: 404 }
      );
    }

    // Verify cart ownership
    const isOwner = session?.user?.id
      ? cartItem.cart.userId === session.user.id
      : cartItem.cart.sessionId === sessionId;

    if (!isOwner) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 403 }
      );
    }

    // Delete item
    await drizzleDb.delete(schema.cartItems).where(eq(schema.cartItems.id, id));

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error deleting cart item:', error);
    return NextResponse.json(
      { error: 'Failed to delete cart item' },
      { status: 500 }
    );
  }
}
