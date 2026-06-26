import { drizzleDb, primaryDrizzleDb } from '@/lib/db'
import {
  products,
  productVariants,
  carts,
  cartItems,
  users,
} from '@/lib/schema'
import { eq, and, isNull, inArray, type SQL } from 'drizzle-orm'
import { logError } from '@/lib/logger'
import { getCachedData } from '@/lib/redis'
import { CACHE_KEYS, CACHE_TTL, invalidateCartCache } from '@/lib/cache'
import {
  fetchCartFromRedis,
  backfillCartToRedis,
  removeCartItemsByCartId,
  type CartItemRedis,
} from '@/features/cart/services/cart-redis'
import { createGuestCartSessionId } from '@/features/cart/services/cart-session'
import type { Session } from 'next-auth'
import type { AddToCartInput } from '@/features/cart/validations'

interface ProductWithVariants {
  id: string
  variants: Array<{ id: string; stock: number }>
}

interface CartVariantOptionValueRecord {
  id: string
  optionId: string
  value: string
  sortOrder: number
  createdAt: Date | string
}

interface CartVariantOptionValueLink {
  optionValue: CartVariantOptionValueRecord
}

interface CartVariantRecord {
  id?: string
  sku?: string | null
  price?: number | null
  stock?: number | null
  image?: string | null
  images?: string[]
  createdAt: Date | string
  updatedAt: Date | string
}

interface CartItemVariantDbRecord extends CartVariantRecord {
  optionValues?: CartVariantOptionValueLink[]
}

interface CartProductOptionValueRecord {
  id: string
  optionId: string
  value: string
  sortOrder: number
  createdAt: Date | string
}

interface CartProductOptionRecord {
  id: string
  name: string
  sortOrder: number
  createdAt: Date | string
  values: CartProductOptionValueRecord[]
}

interface CartProductRecord {
  id: string
  name?: string
  description?: string
  image?: string
  category?: string
  options?: CartProductOptionRecord[]
  createdAt: Date | string
  updatedAt: Date | string
  variants: CartVariantRecord[]
}

interface CartItemRecord {
  id: string
  variantId: string
  quantity: number
  createdAt: Date | string
  updatedAt: Date | string
  product: CartProductRecord
  variant: CartItemVariantDbRecord | null
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

export const isCartRequestError = (error: unknown): error is CartRequestError =>
  error instanceof CartRequestError

const cartItemKey = (item: { productId: string; variantId: string }): string =>
  `${item.productId}:${item.variantId}`

const verifyProductStock = async (
  body: AddToCartInput
): Promise<{ product: ProductWithVariants; availableStock: number }> => {
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

const getOrCreateCart = async (
  session: Session | null,
  sessionId: string | undefined
): Promise<{ cart: { id: string }; sessionId: string | undefined }> => {
  const createGuestCart = async (providedSessionId?: string) => {
    const guestSessionId = providedSessionId ?? createGuestCartSessionId()
    const existing = await primaryDrizzleDb.query.carts.findFirst({
      where: eq(carts.sessionId, guestSessionId),
    })
    if (existing) {
      return { cart: existing, sessionId: guestSessionId }
    }

    // Atomic insert-or-ignore: relies on the unique constraint on
    // carts.sessionId to prevent duplicate rows under concurrent requests
    // sharing the same guest session id.
    const [inserted] = await primaryDrizzleDb
      .insert(carts)
      .values({ sessionId: guestSessionId, updatedAt: new Date() })
      .onConflictDoNothing({ target: carts.sessionId })
      .returning()

    if (inserted) {
      return { cart: inserted, sessionId: guestSessionId }
    }

    // A concurrent request inserted the row first; re-read it.
    const racedCart = await primaryDrizzleDb.query.carts.findFirst({
      where: eq(carts.sessionId, guestSessionId),
    })
    if (!racedCart) {
      throw new CartRequestError('Failed to create guest cart', 500)
    }
    return { cart: racedCart, sessionId: guestSessionId }
  }

  if (session?.user?.id) {
    const userId = session.user.id
    const existing = await primaryDrizzleDb.query.carts.findFirst({
      where: eq(carts.userId, userId),
    })
    if (existing) {
      return { cart: existing, sessionId: undefined }
    }

    const userRecord = await primaryDrizzleDb.query.users.findFirst({
      where: eq(users.id, userId),
      columns: { id: true },
    })

    if (!userRecord) {
      logError({
        error: new Error('Authenticated session user not found in database'),
        context: 'cart_invalid_session_user',
        additionalInfo: { userId },
      })

      return createGuestCart(sessionId)
    }

    // Atomic insert-or-ignore on the unique userId constraint to avoid
    // duplicate carts when concurrent requests race for the same user.
    const [inserted] = await primaryDrizzleDb
      .insert(carts)
      .values({ userId, updatedAt: new Date() })
      .onConflictDoNothing({ target: carts.userId })
      .returning()

    if (inserted) {
      return { cart: inserted, sessionId: undefined }
    }

    const racedCart = await primaryDrizzleDb.query.carts.findFirst({
      where: eq(carts.userId, userId),
    })
    if (!racedCart) {
      throw new CartRequestError('Failed to create user cart', 500)
    }
    return { cart: racedCart, sessionId: undefined }
  }

  return createGuestCart(sessionId)
}

const addOrUpdateCartItem = async (
  cartId: string,
  body: AddToCartInput,
  availableStock: number
): Promise<CartMutationWarning> => {
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
    let { quantity } = body
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

const toISOString = (value: Date | string): string =>
  typeof value === 'string' ? value : value.toISOString()

const buildVariantLabel = (
  variantOptionValues: CartVariantOptionValueLink[] | undefined,
  productOptions: CartProductOptionRecord[] | undefined
): string | null => {
  if (!variantOptionValues?.length || !productOptions?.length) return null
  const optionMap = new Map(productOptions.map((opt) => [opt.id, opt]))
  const sorted = [...variantOptionValues].sort((a, b) => {
    const aOrder = optionMap.get(a.optionValue.optionId)?.sortOrder ?? 0
    const bOrder = optionMap.get(b.optionValue.optionId)?.sortOrder ?? 0
    return aOrder - bOrder
  })
  const parts = sorted
    .map(({ optionValue }) => {
      const option = optionMap.get(optionValue.optionId)
      return option ? `${option.name}: ${optionValue.value}` : optionValue.value
    })
    .filter(Boolean)
  return parts.length > 0 ? parts.join(' / ') : null
}

const serializeCart = (cart: CartRecord) => {
  return {
    ...cart,
    createdAt: toISOString(cart.createdAt),
    updatedAt: toISOString(cart.updatedAt),
    items: cart.items.map((item) => {
      const flatOptionValues = item.variant?.optionValues?.map(
        ({ optionValue }) => ({
          id: optionValue.id,
          optionId: optionValue.optionId,
          value: optionValue.value,
          sortOrder: optionValue.sortOrder,
          createdAt: toISOString(optionValue.createdAt),
        })
      )
      const options = item.product.options?.map((opt) => ({
        id: opt.id,
        productId: item.product.id,
        name: opt.name,
        sortOrder: opt.sortOrder,
        createdAt: toISOString(opt.createdAt),
        values: opt.values.map((val) => ({
          id: val.id,
          optionId: val.optionId,
          value: val.value,
          sortOrder: val.sortOrder,
          createdAt: toISOString(val.createdAt),
        })),
      }))
      return {
        ...item,
        createdAt: toISOString(item.createdAt),
        updatedAt: toISOString(item.updatedAt),
        variantLabel:
          buildVariantLabel(item.variant?.optionValues, item.product.options) ??
          null,
        product: {
          ...item.product,
          createdAt: toISOString(item.product.createdAt),
          updatedAt: toISOString(item.product.updatedAt),
          options,
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
              optionValues: flatOptionValues ?? [],
            }
          : null,
      }
    }),
  }
}

/**
 * Single authoritative query for a cart with its full relation tree.
 * Used in fetchCartFromDB (both user and guest paths) and addItemToCart.
 */
const findCartWithRelations = (where: SQL<unknown>) =>
  drizzleDb.query.carts.findFirst({
    where,
    with: {
      items: {
        with: {
          product: {
            with: {
              options: {
                orderBy: (o, { asc }) => [asc(o.sortOrder)],
                with: {
                  values: {
                    orderBy: (v, { asc }) => [asc(v.sortOrder)],
                  },
                },
              },
              variants: {
                where: (variant, { isNull: isVariantNull }) =>
                  isVariantNull(variant.deletedAt),
              },
            },
          },
          variant: {
            with: {
              optionValues: {
                with: {
                  optionValue: true,
                },
              },
            },
          },
        },
      },
    },
  })

const fetchCartFromDB = (userId?: string, sessionId?: string) => {
  if (userId) return findCartWithRelations(eq(carts.userId, userId))
  if (sessionId) return findCartWithRelations(eq(carts.sessionId, sessionId))
  return Promise.resolve(undefined)
}

export const getCartIdentity = (
  session: { user?: { id?: string } } | null,
  sessionId: string | undefined
): CartIdentity => {
  return { userId: session?.user?.id, sessionId }
}

const getCartCacheKey = (
  userId?: string,
  sessionId?: string
): string | null => {
  if (userId) return CACHE_KEYS.CART_BY_USER(userId)
  if (sessionId) return CACHE_KEYS.CART_BY_SESSION(sessionId)
  return null
}

const findCartForDeletion = (userId?: string, sessionId?: string) => {
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

export const buildGuestSessionCookieOptions = () => {
  return {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax' as const,
    maxAge: 60 * 60 * 24 * 30,
  }
}

type CartItemRow = {
  id: string
  cartId: string
  productId: string
  variantId: string
  quantity: number
}

const buildStockByVariantId = async (
  variantIds: string[]
): Promise<Map<string, number>> => {
  const stockByVariantId = new Map<string, number>()
  if (variantIds.length === 0) return stockByVariantId

  const variantRows = await primaryDrizzleDb
    .select({
      id: productVariants.id,
      stock: productVariants.stock,
      deletedAt: productVariants.deletedAt,
    })
    .from(productVariants)
    .where(inArray(productVariants.id, variantIds))

  for (const variant of variantRows) {
    // Treat soft-deleted variants as out of stock.
    stockByVariantId.set(
      variant.id,
      variant.deletedAt ? 0 : Math.max(0, variant.stock)
    )
  }
  return stockByVariantId
}

const capQuantityToStock = (
  stockByVariantId: Map<string, number>,
  variantId: string,
  desiredQuantity: number
): number => {
  const available = stockByVariantId.get(variantId) ?? 0
  if (available <= 0) return 0
  return Math.min(desiredQuantity, available)
}

const upsertMergedItem = async (
  cartId: string,
  guestItem: CartItemRow,
  existingItem: CartItemRow | undefined,
  cappedQuantity: number,
  now: Date
): Promise<void> => {
  if (existingItem) {
    if (cappedQuantity <= 0) {
      await primaryDrizzleDb
        .delete(cartItems)
        .where(eq(cartItems.id, existingItem.id))
      return
    }
    if (cappedQuantity === existingItem.quantity) return
    await primaryDrizzleDb
      .update(cartItems)
      .set({ quantity: cappedQuantity, updatedAt: now })
      .where(eq(cartItems.id, existingItem.id))
    return
  }

  if (cappedQuantity <= 0) return
  await primaryDrizzleDb.insert(cartItems).values({
    cartId,
    productId: guestItem.productId,
    variantId: guestItem.variantId,
    quantity: cappedQuantity,
    updatedAt: now,
  })
}

const mergeGuestItemsIntoUserCart = async (
  userCart: { id: string; items: CartItemRow[] },
  guestCart: { id: string; items: CartItemRow[] },
  stockByVariantId: Map<string, number>,
  now: Date
): Promise<void> => {
  const existingItems = new Map(
    userCart.items.map((item) => [cartItemKey(item), item])
  )

  for (const guestItem of guestCart.items) {
    const existingItem = existingItems.get(cartItemKey(guestItem))
    const desiredQuantity = (existingItem?.quantity ?? 0) + guestItem.quantity
    const cappedQuantity = capQuantityToStock(
      stockByVariantId,
      guestItem.variantId,
      desiredQuantity
    )
    await upsertMergedItem(
      userCart.id,
      guestItem,
      existingItem,
      cappedQuantity,
      now
    )
  }

  await primaryDrizzleDb
    .update(carts)
    .set({ updatedAt: now })
    .where(eq(carts.id, userCart.id))

  await primaryDrizzleDb.delete(carts).where(eq(carts.id, guestCart.id))
}

const PG_UNIQUE_VIOLATION = '23505'

const isUniqueViolation = (error: unknown): boolean => {
  if (!error || typeof error !== 'object') return false
  const { code } = error as { code?: unknown }
  if (code === PG_UNIQUE_VIOLATION) return true
  // Some drivers (neon-http) wrap the pg error; fall back to message inspection.
  const message =
    typeof (error as { message?: unknown }).message === 'string'
      ? (error as { message: string }).message
      : ''
  return (
    message.includes(PG_UNIQUE_VIOLATION) ||
    message.includes('duplicate key value')
  )
}

const promoteGuestCartToUser = async (
  userId: string,
  guestCart: { id: string; items: CartItemRow[] },
  stockByVariantId: Map<string, number>,
  now: Date
): Promise<{ promoted: boolean }> => {
  try {
    await primaryDrizzleDb
      .update(carts)
      .set({ userId, sessionId: null, updatedAt: now })
      .where(eq(carts.id, guestCart.id))
  } catch (error) {
    // A concurrent request created the user's cart between the read and this
    // update. The unique constraint on carts.userId blocks the promotion;
    // signal the caller to fall back to a merge against the now-existing cart.
    if (isUniqueViolation(error)) {
      return { promoted: false }
    }
    throw error
  }

  for (const guestItem of guestCart.items) {
    const cappedQuantity = capQuantityToStock(
      stockByVariantId,
      guestItem.variantId,
      guestItem.quantity
    )

    if (cappedQuantity <= 0) {
      await primaryDrizzleDb
        .delete(cartItems)
        .where(eq(cartItems.id, guestItem.id))
      continue
    }

    if (cappedQuantity === guestItem.quantity) continue

    await primaryDrizzleDb
      .update(cartItems)
      .set({ quantity: cappedQuantity, updatedAt: now })
      .where(eq(cartItems.id, guestItem.id))
  }

  return { promoted: true }
}

const runMergeCleanup = async (
  userId: string,
  sessionId: string,
  guestCartId: string
): Promise<void> => {
  const cleanupOperations = [
    {
      operation: 'invalidate_user_cart_cache',
      promise: invalidateCartCache(userId),
    },
    {
      operation: 'invalidate_guest_cart_cache',
      promise: invalidateCartCache(undefined, sessionId),
    },
    {
      operation: 'remove_guest_cart_items_from_redis',
      promise: removeCartItemsByCartId(guestCartId, undefined, sessionId),
    },
  ] as const

  const cleanupResults = await Promise.allSettled(
    cleanupOperations.map(({ promise }) => promise)
  )

  cleanupResults.forEach((result, index) => {
    if (result.status === 'fulfilled') return
    logError({
      error: result.reason,
      context: 'cart_merge_cache_cleanup',
      additionalInfo: {
        operation: cleanupOperations[index]?.operation,
        userId,
        sessionId,
        guestCartId,
      },
    })
  })
}

/**
 * Merge a guest cart into an authenticated user's cart and invalidate the
 * previous guest session identifier.
 *
 * Quantities are capped at each variant's live `stock` value so the merge
 * cannot push a user cart past available inventory. Items whose variant is
 * out of stock or has been deleted are dropped from the merge.
 *
 * Returns a freshly generated guest session ID when a guest cart was found and
 * merged so callers can rotate the `cart_session` cookie. Returns `undefined`
 * when there is no guest cart for the provided session ID.
 */
export const mergeGuestCartIntoUserCart = async (
  userId: string,
  sessionId: string
): Promise<string | undefined> => {
  const guestCart = await primaryDrizzleDb.query.carts.findFirst({
    where: eq(carts.sessionId, sessionId),
    with: { items: true },
  })

  if (!guestCart) return undefined

  const now = new Date()
  const userCart = await primaryDrizzleDb.query.carts.findFirst({
    where: eq(carts.userId, userId),
    with: { items: true },
  })

  const variantIds = Array.from(
    new Set([
      ...guestCart.items.map((item) => item.variantId),
      ...(userCart?.items.map((item) => item.variantId) ?? []),
    ])
  )
  const stockByVariantId = await buildStockByVariantId(variantIds)

  if (userCart) {
    await mergeGuestItemsIntoUserCart(
      userCart,
      guestCart,
      stockByVariantId,
      now
    )
  } else {
    const result = await promoteGuestCartToUser(
      userId,
      guestCart,
      stockByVariantId,
      now
    )

    if (!result.promoted) {
      // Race: another request created the user cart while we were promoting.
      // Re-fetch it and fall back to a merge so the guest items are not lost.
      const racedUserCart = await primaryDrizzleDb.query.carts.findFirst({
        where: eq(carts.userId, userId),
        with: { items: true },
      })

      if (!racedUserCart) {
        // The cart that blocked us has disappeared (rare); surface a 500 so
        // the caller can retry rather than silently dropping guest items.
        throw new CartRequestError(
          'Failed to merge guest cart after concurrent write',
          500
        )
      }

      // Refresh the stock map with any newly referenced variants from the
      // raced user cart so cap enforcement still covers every line.
      const refreshedVariantIds = Array.from(
        new Set([
          ...variantIds,
          ...racedUserCart.items.map((item) => item.variantId),
        ])
      )
      const refreshedStockByVariantId =
        await buildStockByVariantId(refreshedVariantIds)

      await mergeGuestItemsIntoUserCart(
        racedUserCart,
        guestCart,
        refreshedStockByVariantId,
        now
      )
    }
  }

  await runMergeCleanup(userId, sessionId, guestCart.id)

  return createGuestCartSessionId()
}

const dbCartToRedisItems = (
  cart: CartRecord,
  userId?: string,
  sessionId?: string
): CartItemRedis[] => {
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
    variantId: item.variantId,
    variantSku: item.variant?.sku ?? null,
    variantPrice: item.variant?.price ?? null,
    variantStock: item.variant?.stock ?? null,
    variantOptionLabel:
      buildVariantLabel(item.variant?.optionValues, item.product.options) ??
      null,
    quantity: item.quantity,
    createdAt: toISOString(item.createdAt),
    updatedAt: toISOString(item.updatedAt),
  }))
}

const redisItemsToCartResponse = (items: CartItemRedis[]) => {
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
      variantLabel: item.variantOptionLabel ?? null,
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
            sku: item.variantSku,
            createdAt: item.createdAt,
            updatedAt: item.updatedAt,
          }
        : null,
    })),
  }
}

export const getCart = async (
  identity: CartIdentity
): Promise<{
  cart:
    | ReturnType<typeof serializeCart>
    | ReturnType<typeof redisItemsToCartResponse>
    | null
}> => {
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
  // Fire-and-forget: backfill is best-effort and handles its own errors.
  backfillCartToRedis(dbCartToRedisItems(cart, userId, sessionId))

  return { cart: serialized }
}

export const addItemToCart = async (
  session: Session | null,
  body: AddToCartInput,
  sessionId: string | undefined
): Promise<AddToCartResult> => {
  const [{ availableStock }, { cart, sessionId: resolvedSessionId }] =
    await Promise.all([
      verifyProductStock(body),
      getOrCreateCart(session, sessionId),
    ])

  const stockWarning = await addOrUpdateCartItem(cart.id, body, availableStock)

  const [updatedCart] = await Promise.all([
    findCartWithRelations(eq(carts.id, cart.id)),
    invalidateCartCache(session?.user?.id, resolvedSessionId),
  ])

  if (!updatedCart) {
    throw new CartRequestError('Cart not found', 404)
  }

  const typedCart = updatedCart as CartRecord
  // Fire-and-forget: backfill is best-effort and handles its own errors.
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

export const clearCart = async (identity: CartIdentity): Promise<void> => {
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
