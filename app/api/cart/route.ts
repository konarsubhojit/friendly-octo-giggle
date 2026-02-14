import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { auth } from '@/lib/auth';
import { AddToCartInput } from '@/lib/types';

export const dynamic = 'force-dynamic';

// Get cart for current user/session
export async function GET(request: NextRequest) {
  try {
    const session = await auth();
    const sessionId = request.cookies.get('cart_session')?.value;

    if (!session?.user?.id && !sessionId) {
      // No cart exists yet
      return NextResponse.json({ cart: null });
    }

    const cart = await prisma.cart.findFirst({
      where: session?.user?.id
        ? { userId: session.user.id }
        : { sessionId },
      include: {
        items: {
          include: {
            product: {
              include: {
                variations: true,
              },
            },
            variation: true,
          },
        },
      },
    });

    if (!cart) {
      return NextResponse.json({ cart: null });
    }

    // Serialize dates
    const serializedCart = {
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

    return NextResponse.json({ cart: serializedCart });
  } catch (error) {
    console.error('Error fetching cart:', error);
    return NextResponse.json(
      { error: 'Failed to fetch cart' },
      { status: 500 }
    );
  }
}

// Add item to cart
export async function POST(request: NextRequest) {
  try {
    const session = await auth();
    const body: AddToCartInput = await request.json();

    if (!body.productId || !body.quantity || body.quantity < 1) {
      return NextResponse.json(
        { error: 'Invalid input' },
        { status: 400 }
      );
    }

    // Verify product exists and has stock
    const product = await prisma.product.findUnique({
      where: { id: body.productId },
      include: { variations: true },
    });

    if (!product) {
      return NextResponse.json(
        { error: 'Product not found' },
        { status: 404 }
      );
    }

    // Check stock
    let availableStock = product.stock;
    if (body.variationId) {
      const variation = product.variations.find((v) => v.id === body.variationId);
      if (!variation) {
        return NextResponse.json(
          { error: 'Variation not found' },
          { status: 404 }
        );
      }
      availableStock = variation.stock;
    }

    if (availableStock < body.quantity) {
      return NextResponse.json(
        { error: 'Insufficient stock' },
        { status: 400 }
      );
    }

    // Get or create cart
    let cart;
    let sessionId = request.cookies.get('cart_session')?.value;

    if (session?.user?.id) {
      // Logged-in user
      cart = await prisma.cart.upsert({
        where: { userId: session.user.id },
        create: { userId: session.user.id },
        update: {},
      });
    } else {
      // Guest user
      if (!sessionId) {
        sessionId = `guest_${Date.now()}_${Math.random().toString(36).substring(7)}`;
      }
      
      cart = await prisma.cart.upsert({
        where: { sessionId },
        create: { sessionId },
        update: {},
      });
    }

    // Add or update cart item
    // Find existing item (variationId can be null, so we need to handle it separately)
    const existingItem = await prisma.cartItem.findFirst({
      where: {
        cartId: cart.id,
        productId: body.productId,
        variationId: body.variationId ?? null,
      },
    });

    let cartItem;
    if (existingItem) {
      // Update quantity
      const newQuantity = existingItem.quantity + body.quantity;
      if (newQuantity > availableStock) {
        return NextResponse.json(
          { error: 'Insufficient stock' },
          { status: 400 }
        );
      }
      cartItem = await prisma.cartItem.update({
        where: { id: existingItem.id },
        data: { quantity: newQuantity },
      });
    } else {
      // Create new item
      cartItem = await prisma.cartItem.create({
        data: {
          cartId: cart.id,
          productId: body.productId,
          variationId: body.variationId ?? null,
          quantity: body.quantity,
        },
      });
    }

    // Fetch updated cart
    const updatedCart = await prisma.cart.findUnique({
      where: { id: cart.id },
      include: {
        items: {
          include: {
            product: {
              include: {
                variations: true,
              },
            },
            variation: true,
          },
        },
      },
    });

    if (!updatedCart) {
      return NextResponse.json(
        { error: 'Cart not found' },
        { status: 404 }
      );
    }

    // Serialize response
    const serializedCart = {
      ...updatedCart,
      createdAt: updatedCart.createdAt.toISOString(),
      updatedAt: updatedCart.updatedAt.toISOString(),
      items: updatedCart.items.map((item) => ({
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

    // Set cart session cookie for guest users
    const response = NextResponse.json({ cart: serializedCart }, { status: 201 });
    if (!session?.user?.id && sessionId) {
      response.cookies.set('cart_session', sessionId, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax',
        maxAge: 60 * 60 * 24 * 30, // 30 days
      });
    }

    return response;
  } catch (error) {
    console.error('Error adding to cart:', error);
    return NextResponse.json(
      { error: 'Failed to add to cart' },
      { status: 500 }
    );
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

    const cart = await prisma.cart.findFirst({
      where: session?.user?.id
        ? { userId: session.user.id }
        : { sessionId },
    });

    if (cart) {
      await prisma.cart.delete({
        where: { id: cart.id },
      });
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
