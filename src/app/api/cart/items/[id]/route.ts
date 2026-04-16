import { NextRequest, NextResponse } from 'next/server'
import { primaryDrizzleDb as drizzleDb } from '@/lib/db'
import { cartItems } from '@/lib/schema'
import { eq } from 'drizzle-orm'
import { auth } from '@/lib/auth'
import { UpdateCartItemSchema } from '@/features/cart/validations'
import { handleValidationError } from '@/lib/api-utils'
import { logError } from '@/lib/logger'
import { invalidateCartCache } from '@/lib/cache'
import {
  updateCartItemQuantityInRedis,
  removeCartItemFromRedis,
} from '@/features/cart/services/cart-redis'

export const dynamic = 'force-dynamic'

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const session = await auth()
    const sessionId = request.cookies.get('cart_session')?.value
    const rawBody = await request.json()

    const parseResult = UpdateCartItemSchema.safeParse(rawBody)
    if (!parseResult.success) {
      return handleValidationError(parseResult.error)
    }
    const body = parseResult.data

    const cartItem = await drizzleDb.query.cartItems.findFirst({
      where: eq(cartItems.id, id),
      with: {
        cart: true,
        product: {
          with: {
            variants: true,
          },
        },
        variant: true,
      },
    })

    if (!cartItem) {
      return NextResponse.json(
        { error: 'Cart item not found' },
        { status: 404 }
      )
    }

    const isOwner = session?.user?.id
      ? cartItem.cart.userId === session.user.id
      : cartItem.cart.sessionId === sessionId

    if (!isOwner) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 })
    }

    if (!cartItem.variant) {
      return NextResponse.json(
        { error: 'Cart item variant not found' },
        { status: 404 }
      )
    }

    const availableStock = cartItem.variant.stock ?? 0

    if (body.quantity > availableStock) {
      return NextResponse.json({ error: 'Insufficient stock' }, { status: 400 })
    }

    await drizzleDb
      .update(cartItems)
      .set({ quantity: body.quantity, updatedAt: new Date() })
      .where(eq(cartItems.id, id))

    await Promise.all([
      invalidateCartCache(session?.user?.id, sessionId),
      updateCartItemQuantityInRedis(id, body.quantity),
    ])

    return NextResponse.json({ success: true })
  } catch (error) {
    logError({ error, context: 'cart_item_update' })
    return NextResponse.json(
      { error: 'Failed to update cart item' },
      { status: 500 }
    )
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const session = await auth()
    const sessionId = request.cookies.get('cart_session')?.value

    const cartItem = await drizzleDb.query.cartItems.findFirst({
      where: eq(cartItems.id, id),
      with: {
        cart: true,
      },
    })

    if (!cartItem) {
      return NextResponse.json(
        { error: 'Cart item not found' },
        { status: 404 }
      )
    }

    const isOwner = session?.user?.id
      ? cartItem.cart.userId === session.user.id
      : cartItem.cart.sessionId === sessionId

    if (!isOwner) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 })
    }

    await drizzleDb.delete(cartItems).where(eq(cartItems.id, id))

    await Promise.all([
      invalidateCartCache(session?.user?.id, sessionId),
      removeCartItemFromRedis(id),
    ])

    return NextResponse.json({ success: true })
  } catch (error) {
    logError({ error, context: 'cart_item_delete' })
    return NextResponse.json(
      { error: 'Failed to delete cart item' },
      { status: 500 }
    )
  }
}
