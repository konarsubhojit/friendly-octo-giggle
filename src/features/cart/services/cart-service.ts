import { drizzleDb, primaryDrizzleDb } from '@/lib/db'
import { products, carts, cartItems, users } from '@/lib/schema'
import { eq, and, isNull } from 'drizzle-orm'
import { logError } from '@/lib/logger'
import { getCachedData } from '@/lib/redis'
import { CACHE_KEYS, CACHE_TTL, invalidateCartCache } from '@/lib/cache'
import {
  fetchCartFromRedis,
  backfillCartToRedis,
  removeCartItemsByCartId,
  type CartItemRedis,
} from '@/features/cart/services/cart-redis'
import type { Session } from 'next-auth'
import type { AddToCartInput } from '@/features/cart/validations'

interface ProductWithVariants {
  id: string
  variants: Array<{ id: string; stock: number }>
}

interface CartVariantRecord {
  id?: string
  sku?: string | null
  price?: number | null
  stock?: number | null
  createdAt: Date | string
  updatedAt: Date | string
}

interface CartProductRecord {
  id: string
  name?: string
  description?: string
  image?: string
  category?: string
  createdAt: Date | string
  updatedAt: Date | string
  variants: CartVariantRecord[]
}

interface CartItemRecord {
  id: string
  quantity: number
  createdAt: Date | string
  updatedAt: Date | string
  product: CartProductRecord
  variant: CartVariantRecord | null
}

interface CartRecord {
  id: string
  createdAt: Date | string
  updatedAt: Date | string
  items: CartItemRecord[]
}

interface CartIdentity {
  userId?: string
  sessionId?: string
}

interface AddToCartResult {
  cart: ReturnType<typeof serializeCart>
  sessionId?: string
  warning?: string
  adjustedQuantity?: number
}

type CartMutationWarning = { warning: string; adjustedQuantity: number } | null

export class CartRequestError extends Error {
  readonly status: number

  constructor(message: string, status: number) {
    super(message)
    this.name = 'CartRequestError'
    this.status = status
  }
}

export function isCartRequestError(error: unknown): error is CartRequestError {
  return error instanceof CartRequestError
}

async function verifyProductStock(
  body: AddToCartInput
): Promise<{ product: ProductWithVariants; availableStock: number }> {
  const product = await drizzleDb.query.products.findFirst({
    where: and(eq(products.id, body.productId), isNull(products.deletedAt)),
    with: {
      variants: {
        where: (variant, { isNull: isVariantNull }) =>
          isVariantNull(variant.deletedAt),
      },
    },
  })

  if (!product) {
    throw new CartRequestError('Product not found', 404)
  }

  const variant = product.variants.find((v) => v.id === body.variantId)
  if (!variant) {
    throw new CartRequestError('Variant not found', 404)
  }
  const availableStock = variant.stock

  if (availableStock <= 0) {
    throw new CartRequestError('This product is currently out of stock', 400)
  }

  return { product, availableStock }
}

async function getOrCreateCart(
  session: Session | null,
  sessionId: string | undefined
): Promise<{ cart: { id: string }; sessionId: string | undefined }> {
  const createGuestCart = async (providedSessionId?: string) => {
    const guestSessionId =
      providedSessionId ?? `guest_${Date.now()}_${crypto.randomUUID()}`
    let cart = await primaryDrizzleDb.query.carts.findFirst({
      where: eq(carts.sessionId, guestSessionId),
    })
    if (!cart) {
      ;[cart] = await primaryDrizzleDb
        .insert(carts)
        .values({ sessionId: guestSessionId, updatedAt: new Date() })
        .returning()
    }
    return { cart, sessionId: guestSessionId }
  }

  if (session?.user?.id) {
    let cart = await primaryDrizzleDb.query.carts.findFirst({
      where: eq(carts.userId, session.user.id),
    })
    if (!cart) {
      const userRecord = await primaryDrizzleDb.query.users.findFirst({
        where: eq(users.id, session.user.id),
        columns: { id: true },
      })

      if (!userRecord) {
        logError({
          error: new Error('Authenticated session user not found in database'),
          context: 'cart_invalid_session_user',
          additionalInfo: { userId: session.user.id },
        })

        return createGuestCart(sessionId)
      }

      ;[cart] = await primaryDrizzleDb
        .insert(carts)
        .values({ userId: session.user.id, updatedAt: new Date() })
        .returning()
    }
    return { cart, sessionId: undefined }
  }

  return createGuestCart(sessionId)
}

async function addOrUpdateCartItem(
  cartId: string,
  body: AddToCartInput,
  availableStock: number
): Promise<CartMutationWarning> {
  const existingItem = await primaryDrizzleDb.query.cartItems.findFirst({
    where: and(
      eq(cartItems.cartId, cartId),
      eq(cartItems.productId, body.productId),
      eq(cartItems.variantId, body.variantId)
    ),
  })

  let warning: string | null = null
  let adjustedQuantity: number | null = null

  if (existingItem) {
    let newQuantity = existingItem.quantity + body.quantity
    if (newQuantity > availableStock) {
      if (existingItem.quantity >= availableStock) {
        throw new CartRequestError(
          `You already have the maximum available quantity (${availableStock}) in your cart`,
          400
        )
      }
      const canAdd = availableStock - existingItem.quantity
      newQuantity = availableStock
      adjustedQuantity = newQuantity
      warning = `Only ${availableStock} items available. Added ${canAdd} instead of ${body.quantity} (you already had ${existingItem.quantity} in your cart).`
    }
    await primaryDrizzleDb
      .update(cartItems)
      .set({ quantity: newQuantity, updatedAt: new Date() })
      .where(eq(cartItems.id, existingItem.id))
  } else {
    let quantity = body.quantity
    if (quantity > availableStock) {
      quantity = availableStock
      adjustedQuantity = quantity
      warning = `Only ${availableStock} items available. Added ${availableStock} to your cart.`
    }
    await primaryDrizzleDb.insert(cartItems).values({
      cartId,
      productId: body.productId,
      variantId: body.variantId,
      quantity,
      updatedAt: new Date(),
    })
  }

  return warning && adjustedQuantity !== null
    ? { warning, adjustedQuantity }
    : null
}

function toISOString(value: Date | string): string {
  return typeof value === 'string' ? value : value.toISOString()
}

function serializeCart(cart: CartRecord) {
  return {
    ...cart,
    createdAt: toISOString(cart.createdAt),
    updatedAt: toISOString(cart.updatedAt),
    items: cart.items.map((item) => ({
      ...item,
      createdAt: toISOString(item.createdAt),
      updatedAt: toISOString(item.updatedAt),
      product: {
        ...item.product,
        createdAt: toISOString(item.product.createdAt),
        updatedAt: toISOString(item.product.updatedAt),
        variants: item.product.variants.map((variant) => ({
          ...variant,
          createdAt: toISOString(variant.createdAt),
          updatedAt: toISOString(variant.updatedAt),
        })),
      },
      variant: item.variant
        ? {
            ...item.variant,
            createdAt: toISOString(item.variant.createdAt),
            updatedAt: toISOString(item.variant.updatedAt),
          }
        : null,
    })),
  }
}

function fetchCartFromDB(userId?: string, sessionId?: string) {
  if (userId) {
    return drizzleDb.query.carts.findFirst({
      where: eq(carts.userId, userId),
      with: {
        items: {
          with: {
            product: {
              with: {
                variants: {
                  where: (variant, { isNull: isVariantNull }) =>
                    isVariantNull(variant.deletedAt),
                },
              },
            },
            variant: true,
          },
        },
      },
    })
  }

  if (sessionId) {
    return drizzleDb.query.carts.findFirst({
      where: eq(carts.sessionId, sessionId),
      with: {
        items: {
          with: {
            product: {
              with: {
                variants: {
                  where: (variant, { isNull: isVariantNull }) =>
                    isVariantNull(variant.deletedAt),
                },
              },
            },
            variant: true,
          },
        },
      },
    })
  }

  return Promise.resolve(undefined)
}

export function getCartIdentity(
  session: { user?: { id?: string } } | null,
  sessionId: string | undefined
): CartIdentity {
  return { userId: session?.user?.id, sessionId }
}

function getCartCacheKey(userId?: string, sessionId?: string): string | null {
  if (userId) return CACHE_KEYS.CART_BY_USER(userId)
  if (sessionId) return CACHE_KEYS.CART_BY_SESSION(sessionId)
  return null
}

function findCartForDeletion(userId?: string, sessionId?: string) {
  if (userId) {
    return drizzleDb.query.carts.findFirst({ where: eq(carts.userId, userId) })
  }
  if (sessionId) {
    return drizzleDb.query.carts.findFirst({
      where: eq(carts.sessionId, sessionId),
    })
  }
  return Promise.resolve(undefined)
}

export function buildGuestSessionCookieOptions() {
  return {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax' as const,
    maxAge: 60 * 60 * 24 * 30,
  }
}

function dbCartToRedisItems(
  cart: CartRecord,
  userId?: string,
  sessionId?: string
): CartItemRedis[] {
  return cart.items.map((item) => ({
    itemId: item.id,
    cartId: cart.id,
    userId: userId ?? '',
    sessionId: sessionId ?? '',
    productId: item.product.id,
    productName: item.product.name ?? '',
    productDescription: item.product.description ?? '',
    productImage: item.product.image ?? '',
    productCategory: item.product.category ?? '',
    variantId: item.variant?.id ?? '',
    variantSku: item.variant?.sku ?? null,
    variantPrice: item.variant?.price ?? 0,
    variantStock: item.variant?.stock ?? 0,
    quantity: item.quantity,
    createdAt: toISOString(item.createdAt),
    updatedAt: toISOString(item.updatedAt),
  }))
}

function redisItemsToCartResponse(items: CartItemRedis[]) {
  if (items.length === 0) return null

  const first = items[0]
  return {
    id: first.cartId,
    createdAt: first.createdAt,
    updatedAt: first.updatedAt,
    items: items.map((item) => ({
      id: item.itemId,
      cartId: item.cartId,
      productId: item.productId,
      variantId: item.variantId,
      quantity: item.quantity,
      createdAt: item.createdAt,
      updatedAt: item.updatedAt,
      product: {
        id: item.productId,
        name: item.productName,
        description: item.productDescription,
        image: item.productImage,
        category: item.productCategory,
        createdAt: item.createdAt,
        updatedAt: item.updatedAt,
        variants: item.variantId
          ? [
              {
                id: item.variantId,
                price: item.variantPrice,
                stock: item.variantStock,
                createdAt: item.createdAt,
                updatedAt: item.updatedAt,
              },
            ]
          : [],
      },
      variant: item.variantId
        ? {
            id: item.variantId,
            price: item.variantPrice,
            stock: item.variantStock,
            createdAt: item.createdAt,
            updatedAt: item.updatedAt,
          }
        : null,
    })),
  }
}

export async function getCart(identity: CartIdentity): Promise<{
  cart:
    | ReturnType<typeof serializeCart>
    | ReturnType<typeof redisItemsToCartResponse>
    | null
}> {
  const { userId, sessionId } = identity

  if (!userId && !sessionId) {
    return { cart: null }
  }

  const redisItems = await fetchCartFromRedis(userId, sessionId)
  if (redisItems && redisItems.length > 0) {
    return { cart: redisItemsToCartResponse(redisItems) }
  }

  const cacheKey = getCartCacheKey(userId, sessionId)
  if (!cacheKey) {
    return { cart: null }
  }

  const cart = (await getCachedData(
    cacheKey,
    CACHE_TTL.CART,
    () => fetchCartFromDB(userId, sessionId),
    CACHE_TTL.CART_STALE
  )) as CartRecord | undefined

  if (!cart) {
    return { cart: null }
  }

  const serialized = serializeCart(cart)
  backfillCartToRedis(dbCartToRedisItems(cart, userId, sessionId))

  return { cart: serialized }
}

export async function addItemToCart(
  session: Session | null,
  body: AddToCartInput,
  sessionId: string | undefined
): Promise<AddToCartResult> {
  const [{ availableStock }, { cart, sessionId: resolvedSessionId }] =
    await Promise.all([
      verifyProductStock(body),
      getOrCreateCart(session, sessionId),
    ])

  const stockWarning = await addOrUpdateCartItem(cart.id, body, availableStock)

  const [updatedCart] = await Promise.all([
    drizzleDb.query.carts.findFirst({
      where: eq(carts.id, cart.id),
      with: {
        items: {
          with: {
            product: {
              with: {
                variants: {
                  where: (variant, { isNull: isVariantNull }) =>
                    isVariantNull(variant.deletedAt),
                },
              },
            },
            variant: true,
          },
        },
      },
    }),
    invalidateCartCache(session?.user?.id, resolvedSessionId),
  ])

  if (!updatedCart) {
    throw new CartRequestError('Cart not found', 404)
  }

  const typedCart = updatedCart as CartRecord
  backfillCartToRedis(
    dbCartToRedisItems(typedCart, session?.user?.id, resolvedSessionId)
  )

  return {
    cart: serializeCart(typedCart),
    sessionId: resolvedSessionId,
    warning: stockWarning?.warning,
    adjustedQuantity: stockWarning?.adjustedQuantity,
  }
}

export async function clearCart(identity: CartIdentity): Promise<void> {
  const { userId, sessionId } = identity

  if (!userId && !sessionId) {
    return
  }

  const cart = await findCartForDeletion(userId, sessionId)
  if (cart) {
    await Promise.all([
      primaryDrizzleDb.delete(carts).where(eq(carts.id, cart.id)),
      invalidateCartCache(userId, sessionId),
      removeCartItemsByCartId(cart.id, userId, sessionId),
    ])
    return
  }

  await invalidateCartCache(userId, sessionId)
}
