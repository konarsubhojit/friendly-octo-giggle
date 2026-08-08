import {
  eq,
  desc,
  and,
  isNull,
  sql,
  ne,
  ilike,
  or,
  inArray,
  count,
  lt,
  gte,
  type SQL,
} from 'drizzle-orm'
import {
  products,
  productShares,
  wishlists,
  coupons,
  couponRedemptions,
  orders,
  orderItems,
  carts,
  cartItems,
  checkoutRequests,
  productVariants,
  users,
  type CheckoutRequestItemRecord,
} from './schema'
import { drizzleDb, primaryDrizzleDb } from './db'
import { Product, ProductInput, CheckoutRequestStatus } from './types'
import {
  cacheProductById,
  cacheProductSoldCounts,
  invalidateProductCaches,
  cacheShareResolve,
} from './cache'
import { serializeProduct, serializeVariant } from './serializers'
import { CONFIRMED_ORDER_STATUSES } from './constants/order-statuses'
import { isPaymentProvider } from './payments/providers'
import type { VerifiedPayment } from './payments/gateway'
import type { ShippingMethodName } from './shipping/methods'
import { toShippingMethod } from './shipping/methods'
import {
  consumeForCheckoutRequest,
  getHeldQuantitiesForCheckoutRequest,
} from '@/features/orders/services/stock-reservation'
import { availableUnits } from './stock-availability'

// ─── Shared error types ──────────────────────────────────

/**
 * Ceiling for any invocation that can hold a `PROCESSING` claim.
 *
 * Declared as `maxDuration` on every claim-holding route so the platform kills
 * a stuck worker before its claim is considered stale.
 */
export const CLAIM_HOLDER_MAX_DURATION_SECONDS = 30

/**
 * A checkout request left in `PROCESSING` for longer than this is treated as
 * abandoned (e.g. the worker crashed) and may be reclaimed by a retry.
 *
 * The value sits above `CLAIM_HOLDER_MAX_DURATION_SECONDS`, so a live claim
 * holder can never have its claim stolen mid-flight: the platform kills the
 * invocation before the window expires.
 *
 * There is no longer an upper bound tied to a redelivery interval. The claim
 * is taken in its own memoized Inngest step, so a retry of a later step
 * resumes behind the existing claim rather than racing to re-take it. The
 * window now only has to cover the inline `waitUntil` fallback and a run that
 * dies before any step checkpointed.
 */
export const STALE_PROCESSING_CLAIM_MS = 45 * 1000

/**
 * Thrown by `db.orders.createWithItems` when a stock reservation fails due to
 * a concurrent order. Callers should map this to their domain-specific error
 * (e.g. OrderRequestError with HTTP 409).
 */
export class StockConflictError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'StockConflictError'
  }
}

/**
 * Thrown when a coupon redemption loses the race for the last available use
 * (global or per-user cap) while the order transaction is in flight.
 */
export class CouponConflictError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'CouponConflictError'
  }
}

// ─── Product Helpers (with date serialization) ──────────

export interface ProductListOptions {
  limit?: number
  offset?: number
  search?: string
  category?: string
}

/**
 * Options for {@link db.products.findBestsellers}.
 *
 * `withCache` controls the Redis sold-count lookup only. Callers inside a
 * `"use cache"` scope must pass `false`: nesting a Redis round trip inside a
 * cached scope stores the same rows twice and splits invalidation across two
 * systems, so the cached scope could serve data the tag revalidation already
 * cleared.
 */
export interface BestsellerOptions extends ProductListOptions {
  withCache?: boolean
}

/** Minimal product representation returned by list queries (includes derived price/stock). */
export interface MinimalProduct {
  id: string
  name: string
  description: string
  category: string
  image: string
  /** Lowest variant price; 0 when no active variants exist */
  price: number
  /** Sum of variant stock; 0 when no active variants exist */
  stock: number
  /** Sum of sold quantities from non-cancelled orders */
  soldCount: number
}

/** Derive price/stock from embedded variant rows. */
function deriveMinimalProduct(row: {
  id: string
  name: string
  description: string
  category: string
  image: string
  variants: Array<{ price: number; stock: number }>
}): MinimalProductDerivedFields {
  const { variants, ...base } = row
  const price =
    variants.length > 0 ? Math.min(...variants.map((v) => v.price)) : 0
  // On-hand units on purpose: these listings are served from `"use cache"`
  // catalog scopes whose profiles outlive a hold by minutes, so a
  // reservation-derived figure would be cached long after the hold settled
  // (plan decision D4). Availability is recomputed per request at every point
  // that can actually reject a shopper — the cart cap, cart validation, and
  // the reservation grant itself.
  const stock = variants.reduce((sum, v) => sum + v.stock, 0)
  return { ...base, price, stock }
}

type MinimalProductDerivedFields = {
  id: string
  name: string
  description: string
  category: string
  image: string
  price: number
  stock: number
}

const fetchProductSoldCounts = async (
  productIds: string[],
  withCache = true
): Promise<Map<string, number>> => {
  if (productIds.length === 0) {
    return new Map()
  }

  const fetcher = async () =>
    drizzleDb
      .select({
        productId: orderItems.productId,
        soldCount:
          sql<number>`cast(coalesce(sum(${orderItems.quantity}), 0) as int)`.as(
            'soldCount'
          ),
      })
      .from(orderItems)
      .innerJoin(
        orders,
        and(
          eq(orders.id, orderItems.orderId),
          inArray(orders.status, CONFIRMED_ORDER_STATUSES)
        )
      )
      .where(inArray(orderItems.productId, productIds))
      .groupBy(orderItems.productId)

  const rows = withCache
    ? await cacheProductSoldCounts(productIds, fetcher)
    : await fetcher()

  return new Map(rows.map((row) => [row.productId, row.soldCount]))
}

// ─── Private helpers ──────────────────────────────────────────────────────────

/**
 * Shared implementation for the three `db.carts.findWithRelationsBy*` methods.
 * The `with` relation tree is verbose enough that we avoid repeating it.
 */
const _findCartWithRelations = (where: SQL) =>
  drizzleDb.query.carts.findFirst({
    where,
    with: {
      items: {
        with: {
          product: {
            with: {
              options: {
                with: { values: true },
              },
              variants: true,
            },
          },
          variant: {
            with: {
              optionValues: {
                with: { optionValue: true },
              },
            },
          },
        },
      },
    },
  })

export const db = {
  products: {
    /**
     * Find all products with optional pagination
     * @param options - Pagination options
     * @returns Array of products with full details including variants
     */
    findAll: async (options: ProductListOptions = {}): Promise<Product[]> => {
      const { limit, offset } = options

      const query = drizzleDb.query.products.findMany({
        where: isNull(products.deletedAt),
        orderBy: [desc(products.createdAt)],
        with: {
          variants: {
            where: (v, { isNull }) => isNull(v.deletedAt),
          },
        },
        limit,
        offset,
      })

      const rows = await query

      return rows.map((p) => ({
        ...serializeProduct(p),
        variants: p.variants.map(serializeVariant),
      }))
    },

    /**
     * Find products sorted by total units sold (bestsellers first).
     * Products with no sales appear at the end, ordered by creation date.
     * Only counts items from non-cancelled orders.
     *
     * The sort and limit are pushed entirely to SQL using a LEFT JOIN subquery
     * so that only the final result-set rows are loaded into memory. Variants
     * are fetched in a second, narrowly-scoped query so we never load the full
     * catalog into Node.
     *
     * Caching is only enabled when no `limit` is requested, mirroring the
     * `findAll` behavior to avoid cache-key collisions between differently-sized
     * result sets.
     *
     * @param options - Pagination and cache options
     * @returns Array of products sorted by sales volume descending
     */
    findBestsellers: async (
      options: BestsellerOptions = {}
    ): Promise<Product[]> => {
      const { limit = 5, withCache = true } = options

      // Single SQL query: LEFT JOIN a sales-aggregate subquery so products
      // with no sales still appear (totalSold = 0), then sort + limit in DB.
      const salesSubquery = drizzleDb
        .select({
          productId: orderItems.productId,
          totalSold:
            sql<number>`cast(coalesce(sum(${orderItems.quantity}), 0) as int)`.as(
              'total_sold'
            ),
        })
        .from(orderItems)
        .innerJoin(
          orders,
          and(eq(orders.id, orderItems.orderId), ne(orders.status, 'CANCELLED'))
        )
        .groupBy(orderItems.productId)
        .as('sales')

      let bestsellerQuery = drizzleDb
        .select({
          id: products.id,
          name: products.name,
          description: products.description,
          image: products.image,
          images: products.images,
          category: products.category,
          deletedAt: products.deletedAt,
          createdAt: products.createdAt,
          updatedAt: products.updatedAt,
        })
        .from(products)
        .leftJoin(salesSubquery, eq(products.id, salesSubquery.productId))
        .where(isNull(products.deletedAt))
        .orderBy(
          desc(sql`coalesce(${salesSubquery.totalSold}, 0)`),
          desc(products.createdAt)
        )
        .$dynamic()

      if (limit) {
        bestsellerQuery = bestsellerQuery.limit(limit)
      }

      const rows = await bestsellerQuery

      if (rows.length === 0) return []

      // Fetch variants only for the products that made the cut
      const productIds = rows.map((r) => r.id)
      const varRows = await drizzleDb.query.productVariants.findMany({
        where: (pv, { inArray, and, isNull }) =>
          and(inArray(pv.productId, productIds), isNull(pv.deletedAt)),
      })

      // Group variants by productId for O(1) lookup
      const varsByProduct = new Map<string, typeof varRows>()
      for (const v of varRows) {
        const list = varsByProduct.get(v.productId) ?? []
        list.push(v)
        varsByProduct.set(v.productId, list)
      }

      const soldCountByProductId = await fetchProductSoldCounts(
        productIds,
        withCache
      )

      return rows.map((p) => ({
        ...serializeProduct(p),
        soldCount: soldCountByProductId.get(p.id) ?? 0,
        variants: (varsByProduct.get(p.id) ?? []).map(serializeVariant),
      }))
    },

    /**
     * Find products for list views (minimal fields + variant-derived price/stock)
     * @param options - Pagination and filter options
     * @returns Array of products with essential fields and derived price/stock
     */
    findAllMinimal: async (
      options: ProductListOptions = {}
    ): Promise<MinimalProduct[]> => {
      const { limit, offset, search, category } = options

      const filters: SQL[] = [isNull(products.deletedAt)]
      const normalizedSearch = search?.trim()
      const normalizedCategory = category?.trim()

      if (normalizedSearch) {
        filters.push(
          or(
            ilike(products.name, `%${normalizedSearch}%`),
            ilike(products.description, `%${normalizedSearch}%`)
          ) as SQL
        )
      }

      if (normalizedCategory) {
        filters.push(eq(products.category, normalizedCategory))
      }

      const whereClause = filters.length === 1 ? filters[0] : and(...filters)

      const rows = await drizzleDb.query.products.findMany({
        where: whereClause,
        orderBy: [desc(products.createdAt)],
        columns: {
          id: true,
          name: true,
          description: true,
          category: true,
          image: true,
        },
        with: {
          variants: {
            where: (v, { isNull }) => isNull(v.deletedAt),
            columns: { price: true, stock: true },
          },
        },
        limit,
        offset,
      })

      const soldCountByProductId = await fetchProductSoldCounts(
        rows.map((row) => row.id)
      )

      return rows.map((row) => ({
        ...deriveMinimalProduct(row),
        soldCount: soldCountByProductId.get(row.id) ?? 0,
      }))
    },

    /**
     * Fetch minimal product records for a known list of product IDs.
     * Returns rows in database order; callers should reorder if needed.
     */
    findMinimalByIds: async (
      ids: string[],
      category?: string
    ): Promise<MinimalProduct[]> => {
      if (ids.length === 0) {
        return []
      }

      const rows = await drizzleDb.query.products.findMany({
        where: and(
          inArray(products.id, ids),
          isNull(products.deletedAt),
          category ? eq(products.category, category) : undefined
        ),
        columns: {
          id: true,
          name: true,
          description: true,
          category: true,
          image: true,
        },
        with: {
          variants: {
            where: (v, { isNull }) => isNull(v.deletedAt),
            columns: { price: true, stock: true },
          },
        },
      })

      const soldCountByProductId = await fetchProductSoldCounts(
        rows.map((row) => row.id)
      )

      return rows.map((row) => ({
        ...deriveMinimalProduct(row),
        soldCount: soldCountByProductId.get(row.id) ?? 0,
      }))
    },

    /**
     * Find product by ID with optional caching
     * @param id - Product ID
     * @param withCache - Whether to use Redis cache. Pass `false` from inside a
     *   `"use cache"` scope so the cached scope holds no nested Redis read.
     * @returns Product with full details or null if not found
     */
    findById: async (id: string, withCache = true): Promise<Product | null> => {
      const fetcher = async () => {
        const row = await drizzleDb.query.products.findFirst({
          where: and(eq(products.id, id), isNull(products.deletedAt)),
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
              where: (v, { isNull }) => isNull(v.deletedAt),
              orderBy: (v, { asc }) => [asc(v.sortOrder)],
              with: {
                optionValues: {
                  with: {
                    optionValue: true,
                  },
                },
              },
            },
          },
        })
        if (!row) return null
        const soldCountByProductId = await fetchProductSoldCounts(
          [id],
          withCache
        )
        return {
          ...serializeProduct(row),
          soldCount: soldCountByProductId.get(id) ?? 0,
          options: row.options.map((opt) => ({
            id: opt.id,
            productId: opt.productId,
            name: opt.name,
            sortOrder: opt.sortOrder,
            createdAt:
              typeof opt.createdAt === 'string'
                ? opt.createdAt
                : opt.createdAt.toISOString(),
            values: opt.values.map((val) => ({
              id: val.id,
              optionId: val.optionId,
              value: val.value,
              sortOrder: val.sortOrder,
              createdAt:
                typeof val.createdAt === 'string'
                  ? val.createdAt
                  : val.createdAt.toISOString(),
            })),
          })),
          variants: row.variants.map(serializeVariant),
        }
      }

      if (withCache) {
        return cacheProductById(id, fetcher)
      }

      return fetcher()
    },

    create: async (input: ProductInput): Promise<Product> => {
      const [row] = await primaryDrizzleDb
        .insert(products)
        .values({ ...input, updatedAt: new Date() })
        .returning()

      // Invalidate product caches after creation
      await invalidateProductCaches()

      return serializeProduct(row)
    },

    update: async (
      id: string,
      input: Partial<ProductInput>
    ): Promise<Product | null> => {
      const [row] = await primaryDrizzleDb
        .update(products)
        .set({ ...input, updatedAt: new Date() })
        .where(eq(products.id, id))
        .returning()

      if (!row) return null

      // Invalidate product caches after update
      await invalidateProductCaches(id)

      return {
        ...row,
        deletedAt: row.deletedAt?.toISOString() ?? null,
        createdAt: row.createdAt.toISOString(),
        updatedAt: row.updatedAt.toISOString(),
      }
    },

    /**
     * Delete a product (soft delete)
     * @param id - Product ID
     * @returns true if deleted, false if not found
     */
    delete: async (id: string): Promise<boolean> => {
      // Soft delete: set deletedAt timestamp instead of removing the row
      const result = await primaryDrizzleDb
        .update(products)
        .set({ deletedAt: new Date(), updatedAt: new Date() })
        .where(and(eq(products.id, id), isNull(products.deletedAt)))
        .returning({ id: products.id })

      const success = result.length > 0

      if (success) {
        await invalidateProductCaches(id)
      }

      return success
    },

    /**
     * Find products with their variants for order stock validation.
     * Uses the primary DB to avoid stale reads before stock checks.
     *
     * Each variant carries an `availableStock` figure: on-hand minus units held
     * by *other* checkout requests. The requesting checkout's own hold is added
     * back, since those units are exactly what it is about to spend.
     */
    findManyWithVariantsForOrderValidation: async (
      ids: string[],
      checkoutRequestId?: string | null
    ) => {
      const [rows, ownHeld] = await Promise.all([
        primaryDrizzleDb.query.products.findMany({
          where: and(inArray(products.id, ids), isNull(products.deletedAt)),
          with: {
            variants: {
              where: (variant, operators) =>
                operators.isNull(variant.deletedAt),
            },
          },
        }),
        checkoutRequestId
          ? getHeldQuantitiesForCheckoutRequest(checkoutRequestId)
          : Promise.resolve(new Map<string, number>()),
      ])

      return rows.map((row) => ({
        ...row,
        variants: row.variants.map((variant) => ({
          ...variant,
          availableStock:
            availableUnits(variant) + (ownHeld.get(variant.id) ?? 0),
        })),
      }))
    },

    /**
     * Fetch id + name pairs for a set of product IDs.
     * Used to build product name strings for order summaries.
     */
    findNamesByIds: async (
      ids: string[]
    ): Promise<Array<{ id: string; name: string }>> => {
      if (ids.length === 0) return []
      return drizzleDb.query.products.findMany({
        where: inArray(products.id, ids),
        columns: { id: true, name: true },
      })
    },

    /**
     * Find a single product with its active variants for cart stock checks.
     *
     * Variants carry `availableStock` so the cart caps quantities at what a
     * shopper could actually buy rather than at on-hand units.
     */
    findFirstForCart: async (productId: string) => {
      const row = await drizzleDb.query.products.findFirst({
        where: and(eq(products.id, productId), isNull(products.deletedAt)),
        with: {
          variants: {
            where: (variant, { isNull: isVariantNull }) =>
              isVariantNull(variant.deletedAt),
          },
        },
      })

      if (!row) return row

      return {
        ...row,
        variants: row.variants.map((variant) => ({
          ...variant,
          availableStock: availableUnits(variant),
        })),
      }
    },
  },

  wishlists: {
    /**
     * Get all wishlist product IDs for a user
     */
    getProductIds: async (userId: string): Promise<string[]> => {
      const rows = await drizzleDb
        .select({ productId: wishlists.productId })
        .from(wishlists)
        .where(eq(wishlists.userId, userId))
      return rows.map((r) => r.productId)
    },

    /**
     * Get full wishlist products for a user
     */
    getProducts: async (userId: string): Promise<Product[]> => {
      const rows = await drizzleDb.query.wishlists.findMany({
        where: eq(wishlists.userId, userId),
        with: {
          product: {
            with: {
              variants: {
                where: (v, { isNull }) => isNull(v.deletedAt),
              },
            },
          },
        },
      })

      return rows
        .filter((r) => r.product !== null && !r.product.deletedAt)
        .map((r) => ({
          ...serializeProduct(r.product),
          variants: r.product.variants.map(serializeVariant),
        }))
    },

    /**
     * Add a product to the user's wishlist (idempotent)
     */
    add: async (
      userId: string,
      productId: string
    ): Promise<{ userId: string; productId: string }> => {
      const [row] = await primaryDrizzleDb
        .insert(wishlists)
        .values({ userId, productId })
        .onConflictDoNothing()
        .returning({
          userId: wishlists.userId,
          productId: wishlists.productId,
        })

      return row ?? { userId, productId }
    },

    /**
     * Remove a product from the user's wishlist
     */
    remove: async (userId: string, productId: string): Promise<boolean> => {
      const result = await primaryDrizzleDb
        .delete(wishlists)
        .where(
          and(eq(wishlists.userId, userId), eq(wishlists.productId, productId))
        )
        .returning({ id: wishlists.id })

      return result.length > 0
    },

    /**
     * Check if a product is in the user's wishlist
     */
    has: async (userId: string, productId: string): Promise<boolean> => {
      const row = await drizzleDb.query.wishlists.findFirst({
        where: and(
          eq(wishlists.userId, userId),
          eq(wishlists.productId, productId)
        ),
        columns: { id: true },
      })
      return row !== undefined
    },
  },

  shares: {
    /**
     * Create a new product share link.
     * Returns the 7-char base62 key that acts as the shareable token.
     */
    create: async (
      productId: string,
      variantId: string | null
    ): Promise<string> => {
      const [row] = await primaryDrizzleDb
        .insert(productShares)
        .values({ productId, variantId: variantId ?? null })
        .returning({ key: productShares.key })
      return row.key
    },

    /**
     * Resolve a share key to its product and variant IDs.
     * Result is cached in Redis with a 1-year TTL since share tokens
     * are immutable — the mapping never changes after creation.
     * Null results (missing token) are not cached to prevent poisoning.
     * Returns null if the key does not exist.
     */
    resolve: (
      key: string
    ): Promise<{ productId: string; variantId: string | null } | null> => {
      return cacheShareResolve(key, async () => {
        const row = await drizzleDb.query.productShares.findFirst({
          where: eq(productShares.key, key),
          columns: { productId: true, variantId: true },
        })
        if (!row) return null
        return { productId: row.productId, variantId: row.variantId }
      })
    },
  },

  users: {
    /**
     * Fetch a user's currency preference.
     * Returns null if the user does not exist.
     */
    findPreferences: async (
      userId: string
    ): Promise<{
      currencyPreference: string | null
    } | null> => {
      const row = await drizzleDb.query.users.findFirst({
        where: eq(users.id, userId),
        columns: { currencyPreference: true },
      })
      return row ?? null
    },

    /**
     * Check whether a user record exists.
     * Uses the primary DB to avoid stale reads before writes.
     */
    existsById: async (userId: string): Promise<boolean> => {
      const row = await primaryDrizzleDb.query.users.findFirst({
        where: eq(users.id, userId),
        columns: { id: true },
      })
      return row !== undefined
    },
  },

  orders: {
    /**
     * Paginated order list for a user.
     * Supports cursor-based and offset pagination, and optional search filtering.
     */
    findMany: async (options: {
      userId: string
      cursor?: string | null
      useOffset: boolean
      searchIds?: string[]
      limit: number
      offset?: number
    }) => {
      const conditions: SQL[] = [eq(orders.userId, options.userId)]

      if (!options.useOffset && options.cursor) {
        const cursorDate = new Date(options.cursor)
        if (!Number.isNaN(cursorDate.getTime())) {
          conditions.push(lt(orders.createdAt, cursorDate))
        }
      }

      if (options.searchIds && options.searchIds.length > 0) {
        conditions.push(inArray(orders.id, options.searchIds))
      }

      return drizzleDb.query.orders.findMany({
        where: and(...conditions),
        with: { items: { with: { product: true, variant: true } } },
        orderBy: [desc(orders.createdAt)],
        limit: options.limit,
        offset: options.useOffset ? options.offset : undefined,
      })
    },

    /**
     * Total number of orders for a user (no cursor applied — always the full count).
     */
    count: async (userId: string): Promise<number> => {
      const result = await drizzleDb
        .select({ value: count() })
        .from(orders)
        .where(eq(orders.userId, userId))
      return Number(result[0]?.value ?? 0)
    },

    /**
     * Check for a duplicate payment transaction.
     * Uses the primary DB so the check is always current.
     */
    findFirstByPaymentTransactionId: async (
      paymentTransactionId: string
    ): Promise<{ id: string } | null> => {
      const [row] = await primaryDrizzleDb
        .select({ id: orders.id })
        .from(orders)
        .where(eq(orders.paymentTransactionId, paymentTransactionId))
        .limit(1)
      return row ?? null
    },

    /**
     * Atomically create an order and its items inside a transaction, then
     * decrement variant stock with optimistic locking.
     *
     * Throws `StockConflictError` when the stock decrement is blocked by a
     * concurrent order (the row's stock dropped below the requested quantity
     * between the pre-check and this write).
     */
    createWithItems: async (input: {
      userId: string
      customerDetails: {
        customerName: string
        customerEmail: string
        customerAddress: string
        addressLine1: string | null
        addressLine2: string | null
        addressLine3: string | null
        pinCode: string | null
        city: string | null
        state: string | null
      }
      checkoutRequestId: string | null
      subtotalAmount: number
      shippingAmount: number
      taxAmount: number
      shippingMethod: ShippingMethodName
      totalAmount: number
      discountAmount?: number
      /**
       * Coupons resolved server-side. Every entry is redeemed inside the same
       * transaction as the order, so caps can never be exceeded.
       */
      appliedCoupons?: Array<{
        couponId: string
        code: string
        discountAmount: number
      }>
      verifiedPayment?: VerifiedPayment | null
      items: Array<{
        productId: string
        variantId: string
        quantity: number
        price: number
        customizationNote: string | null
      }>
    }) => {
      const appliedCoupons = input.appliedCoupons ?? []
      const primaryCoupon = appliedCoupons[0] ?? null

      return primaryDrizzleDb.transaction(async (tx) => {
        const [newOrder] = await tx
          .insert(orders)
          .values({
            userId: input.userId,
            customerName: input.customerDetails.customerName,
            customerEmail: input.customerDetails.customerEmail,
            customerAddress: input.customerDetails.customerAddress,
            addressLine1: input.customerDetails.addressLine1,
            addressLine2: input.customerDetails.addressLine2,
            addressLine3: input.customerDetails.addressLine3,
            pinCode: input.customerDetails.pinCode,
            city: input.customerDetails.city,
            state: input.customerDetails.state,
            checkoutRequestId: input.checkoutRequestId,
            subtotalAmount: input.subtotalAmount,
            shippingAmount: input.shippingAmount,
            taxAmount: input.taxAmount,
            shippingMethod: input.shippingMethod,
            totalAmount: input.totalAmount,
            discountAmount: input.discountAmount ?? 0,
            // Mirrors the primary coupon for display/export; the full set of
            // coupons for an order always lives in CouponRedemption.
            couponId: primaryCoupon?.couponId ?? null,
            couponCode: primaryCoupon?.code ?? null,
            status: 'PENDING',
            // A verified payment that has not settled yet (e.g. Cash on
            // Delivery) stays PENDING until settlement is confirmed.
            paymentStatus: input.verifiedPayment?.paidAt ? 'PAID' : 'PENDING',
            paymentProvider: input.verifiedPayment?.provider ?? null,
            paymentOrderId: input.verifiedPayment?.paymentOrderId ?? null,
            paymentTransactionId:
              input.verifiedPayment?.paymentTransactionId ?? null,
            amountPaid: input.verifiedPayment?.amountPaid ?? 0,
            paidAt: input.verifiedPayment?.paidAt ?? null,
            updatedAt: new Date(),
          })
          .returning()

        await tx.insert(orderItems).values(
          input.items.map((item) => ({
            orderId: newOrder.id,
            productId: item.productId,
            variantId: item.variantId,
            quantity: item.quantity,
            price: item.price,
            customizationNote: item.customizationNote,
          }))
        )

        const stockUpdateResults = await Promise.all(
          input.items.map((item) =>
            tx
              .update(productVariants)
              .set({
                stock: sql`${productVariants.stock} - ${item.quantity}`,
                updatedAt: new Date(),
              })
              .where(
                and(
                  eq(productVariants.id, item.variantId),
                  gte(productVariants.stock, item.quantity)
                )
              )
              .returning({ id: productVariants.id })
          )
        )

        if (stockUpdateResults.some((rows) => rows.length === 0)) {
          throw new StockConflictError(
            'Unable to reserve stock — item was sold out by a concurrent order'
          )
        }

        // On-hand and held units move together, in the transaction that commits
        // the order. The claim-shaped update means a retried pipeline that
        // reaches here twice consumes nothing the second time.
        if (input.checkoutRequestId) {
          await consumeForCheckoutRequest(tx, input.checkoutRequestId)
        }

        for (const applied of appliedCoupons) {
          // The conditional increment both enforces the global cap and takes a
          // row lock held until commit, which serialises concurrent redemptions
          // of the same coupon and makes the per-user check below race-free.
          const [claimed] = await tx
            .update(coupons)
            .set({
              usageCount: sql`${coupons.usageCount} + 1`,
              updatedAt: new Date(),
            })
            .where(
              and(
                eq(coupons.id, applied.couponId),
                eq(coupons.isActive, true),
                sql`(${coupons.usageLimit} IS NULL OR ${coupons.usageCount} < ${coupons.usageLimit})`
              )
            )
            .returning({
              id: coupons.id,
              perUserLimit: coupons.perUserLimit,
            })

          if (!claimed) {
            throw new CouponConflictError(
              `Coupon ${applied.code} is no longer available`
            )
          }

          if (claimed.perUserLimit !== null) {
            const [usedByUser] = await tx
              .select({ value: count() })
              .from(couponRedemptions)
              .where(
                and(
                  eq(couponRedemptions.couponId, applied.couponId),
                  eq(couponRedemptions.userId, input.userId)
                )
              )

            if (Number(usedByUser?.value ?? 0) >= claimed.perUserLimit) {
              throw new CouponConflictError(
                `Coupon ${applied.code} has already been used`
              )
            }
          }

          await tx.insert(couponRedemptions).values({
            couponId: applied.couponId,
            userId: input.userId,
            orderId: newOrder.id,
            discountAmount: applied.discountAmount,
          })
        }

        return newOrder
      })
    },

    /**
     * Fetch a fully hydrated order row (with items, product, and variant) from
     * the primary DB. Returns null when the order does not exist.
     */
    findFirstById: async (orderId: string) => {
      const row = await primaryDrizzleDb.query.orders.findFirst({
        where: eq(orders.id, orderId),
        with: { items: { with: { product: true, variant: true } } },
      })
      return row ?? null
    },

    /**
     * All orders for a user, newest first, with their line items.
     */
    findManyByUserId: async (userId: string) => {
      return drizzleDb.query.orders.findMany({
        where: eq(orders.userId, userId),
        orderBy: [desc(orders.createdAt)],
        with: { items: true },
      })
    },

    /**
     * Fetch a batch of orders by ID, with their line items.
     */
    findManyByIds: async (ids: string[]) => {
      if (ids.length === 0) return []
      return drizzleDb.query.orders.findMany({
        where: (orderTable, { inArray: inArrayOperator }) =>
          inArrayOperator(orderTable.id, ids),
        with: { items: true },
      })
    },

    /**
     * Insert an order and its items in a single transaction.
     * Uses `drizzleDb` (which routes to the primary for write operations).
     */
    insertWithItems: async (params: {
      orderId: string
      userId: string
      customerName: string
      customerEmail: string
      customerAddress: string
      addressLine1: string | null
      addressLine2: string | null
      addressLine3: string | null
      pinCode: string | null
      city: string | null
      state: string | null
      totalAmount: number
      items: Array<{
        productId: string
        variantId: string
        quantity: number
        price: number
        customizationNote: string | null
      }>
    }): Promise<void> => {
      await drizzleDb.transaction(async (tx) => {
        await tx.insert(orders).values({
          id: params.orderId,
          userId: params.userId,
          customerName: params.customerName,
          customerEmail: params.customerEmail,
          customerAddress: params.customerAddress,
          addressLine1: params.addressLine1,
          addressLine2: params.addressLine2,
          addressLine3: params.addressLine3,
          pinCode: params.pinCode,
          city: params.city,
          state: params.state,
          totalAmount: params.totalAmount,
          status: 'PENDING' as const,
          updatedAt: new Date(),
        })

        await tx.insert(orderItems).values(
          params.items.map((item) => ({
            orderId: params.orderId,
            productId: item.productId,
            variantId: item.variantId,
            quantity: item.quantity,
            price: item.price,
            customizationNote: item.customizationNote,
          }))
        )
      })
    },

    /**
     * Update the status of an order.
     * Returns the order ID on success, null when not found.
     */
    updateStatus: async (
      id: string,
      status: string
    ): Promise<{ id: string } | null> => {
      const result = await drizzleDb
        .update(orders)
        .set({
          status: status as
            | 'PENDING'
            | 'PROCESSING'
            | 'SHIPPED'
            | 'DELIVERED'
            | 'CANCELLED',
          updatedAt: new Date(),
        })
        .where(eq(orders.id, id))
        .returning({ id: orders.id })
      return result[0] ?? null
    },

    /**
     * Find the first order linked to a checkout request.
     */
    findFirstByCheckoutRequestId: async (
      checkoutRequestId: string
    ): Promise<{ id: string } | null> => {
      const result = await drizzleDb
        .select({ id: orders.id })
        .from(orders)
        .where(eq(orders.checkoutRequestId, checkoutRequestId))
        .limit(1)
      return result[0] ?? null
    },
  },

  coupons: {
    /**
     * Resolve coupon codes for redemption. Reads from the primary DB so a
     * coupon created or exhausted moments ago is never served stale.
     */
    findManyByCodes: async (codes: string[]) => {
      if (codes.length === 0) return []
      return primaryDrizzleDb
        .select()
        .from(coupons)
        .where(inArray(coupons.code, codes))
    },

    findById: async (id: string) => {
      const [row] = await primaryDrizzleDb
        .select()
        .from(coupons)
        .where(eq(coupons.id, id))
        .limit(1)
      return row ?? null
    },

    /** Redemptions already made by a user, keyed by coupon ID. */
    countUserRedemptions: async (
      userId: string,
      couponIds: string[]
    ): Promise<Record<string, number>> => {
      if (couponIds.length === 0) return {}
      const rows = await primaryDrizzleDb
        .select({
          couponId: couponRedemptions.couponId,
          value: count(),
        })
        .from(couponRedemptions)
        .where(
          and(
            eq(couponRedemptions.userId, userId),
            inArray(couponRedemptions.couponId, couponIds)
          )
        )
        .groupBy(couponRedemptions.couponId)

      return Object.fromEntries(
        rows.map((row) => [row.couponId, Number(row.value)])
      )
    },

    findAll: async () =>
      drizzleDb.select().from(coupons).orderBy(desc(coupons.createdAt)),

    create: async (values: typeof coupons.$inferInsert) => {
      const [created] = await primaryDrizzleDb
        .insert(coupons)
        .values(values)
        .returning()
      return created
    },

    update: async (
      id: string,
      values: Partial<typeof coupons.$inferInsert>
    ) => {
      const [updated] = await primaryDrizzleDb
        .update(coupons)
        .set({ ...values, updatedAt: new Date() })
        .where(eq(coupons.id, id))
        .returning()
      return updated ?? null
    },

    /** Number of redemptions recorded for a coupon. */
    countRedemptions: async (couponId: string): Promise<number> => {
      const [row] = await primaryDrizzleDb
        .select({ value: count() })
        .from(couponRedemptions)
        .where(eq(couponRedemptions.couponId, couponId))
      return Number(row?.value ?? 0)
    },

    delete: async (id: string): Promise<{ id: string } | null> => {
      const [deleted] = await primaryDrizzleDb
        .delete(coupons)
        .where(eq(coupons.id, id))
        .returning({ id: coupons.id })
      return deleted ?? null
    },

    /** Per-coupon redemption totals for the admin usage report. */
    redemptionSummary: async () => {
      const rows = await drizzleDb
        .select({
          couponId: coupons.id,
          code: coupons.code,
          discountType: coupons.discountType,
          isActive: coupons.isActive,
          usageLimit: coupons.usageLimit,
          usageCount: coupons.usageCount,
          redemptionCount: count(couponRedemptions.id),
          totalDiscount: sql<number>`coalesce(sum(${couponRedemptions.discountAmount}), 0)`,
          lastRedeemedAt: sql<Date | null>`max(${couponRedemptions.createdAt})`,
        })
        .from(coupons)
        .leftJoin(couponRedemptions, eq(couponRedemptions.couponId, coupons.id))
        .groupBy(
          coupons.id,
          coupons.code,
          coupons.discountType,
          coupons.isActive,
          coupons.usageLimit,
          coupons.usageCount
        )
        .orderBy(desc(coupons.createdAt))

      return rows
    },
  },

  checkoutRequests: {
    /**
     * Find a checkout request by its ID.
     */
    findById: async (id: string) => {
      const [row] = await drizzleDb
        .select()
        .from(checkoutRequests)
        .where(eq(checkoutRequests.id, id))
        .limit(1)
      return row ?? null
    },

    /**
     * Insert a new checkout request and return its ID and status.
     */
    create: async (values: {
      userId: string
      customerName: string
      customerEmail: string
      customerAddress: string
      addressLine1: string
      addressLine2: string | null
      addressLine3: string | null
      pinCode: string
      city: string
      state: string
      items: CheckoutRequestItemRecord[]
      couponCode?: string | null
      shippingMethod?: string | null
      paymentProvider?: string | null
      paymentOrderId?: string | null
      paymentTransactionId?: string | null
      paymentSignature?: string | null
      status: CheckoutRequestStatus
    }): Promise<{ id: string; status: CheckoutRequestStatus }> => {
      const [row] = await primaryDrizzleDb
        .insert(checkoutRequests)
        .values({
          userId: values.userId,
          customerName: values.customerName,
          customerEmail: values.customerEmail,
          customerAddress: values.customerAddress,
          addressLine1: values.addressLine1,
          addressLine2: values.addressLine2,
          addressLine3: values.addressLine3,
          pinCode: values.pinCode,
          city: values.city,
          state: values.state,
          items: values.items,
          couponCode: values.couponCode ?? null,
          shippingMethod: toShippingMethod(values.shippingMethod),
          paymentProvider: isPaymentProvider(values.paymentProvider)
            ? values.paymentProvider
            : null,
          paymentOrderId: values.paymentOrderId ?? null,
          paymentTransactionId: values.paymentTransactionId ?? null,
          paymentSignature: values.paymentSignature ?? null,
          status: values.status,
          updatedAt: new Date(),
        })
        .returning({
          id: checkoutRequests.id,
          status: checkoutRequests.status,
        })
      return row as { id: string; status: CheckoutRequestStatus }
    },

    /**
     * Atomically claim a checkout request for processing.
     *
     * This is a compare-and-swap on the status column rather than a
     * read-then-write, so concurrent deliveries of the same webhook or queue
     * message can never both start processing the request. A request that has
     * been stuck in `PROCESSING` for longer than `staleAfterMs` (e.g. a worker
     * that crashed mid-flight) can be reclaimed so retries still recover.
     *
     * @returns true when the caller now owns the request.
     */
    claimForProcessing: async (
      id: string,
      staleAfterMs = STALE_PROCESSING_CLAIM_MS
    ): Promise<boolean> => {
      const staleBefore = new Date(Date.now() - staleAfterMs)
      const claimed = await primaryDrizzleDb
        .update(checkoutRequests)
        .set({
          status: 'PROCESSING',
          errorMessage: null,
          updatedAt: new Date(),
        })
        .where(
          and(
            eq(checkoutRequests.id, id),
            or(
              eq(checkoutRequests.status, 'PENDING'),
              and(
                eq(checkoutRequests.status, 'PROCESSING'),
                lt(checkoutRequests.updatedAt, staleBefore)
              )
            )
          )
        )
        .returning({ id: checkoutRequests.id })

      return claimed.length > 0
    },

    /**
     * Update the status (and optional error message) of a checkout request.
     */
    updateStatus: async (
      id: string,
      status: string,
      errorMessage: string | null
    ): Promise<void> => {
      await primaryDrizzleDb
        .update(checkoutRequests)
        .set({
          status: status as CheckoutRequestStatus,
          errorMessage,
          updatedAt: new Date(),
        })
        .where(eq(checkoutRequests.id, id))
    },

    /**
     * Fetch recent checkout requests joined to their linked order (if any).
     * Returns up to `limit * 4` rows (pre-filtered set for in-memory search).
     */
    findRecentWithOrders: async (options: { limit?: number }) => {
      const { limit = 50 } = options
      return drizzleDb
        .select({
          id: checkoutRequests.id,
          userId: checkoutRequests.userId,
          customerName: checkoutRequests.customerName,
          customerEmail: checkoutRequests.customerEmail,
          customerAddress: checkoutRequests.customerAddress,
          items: checkoutRequests.items,
          status: checkoutRequests.status,
          errorMessage: checkoutRequests.errorMessage,
          orderId: orders.id,
          createdAt: checkoutRequests.createdAt,
          updatedAt: checkoutRequests.updatedAt,
        })
        .from(checkoutRequests)
        .leftJoin(orders, eq(orders.checkoutRequestId, checkoutRequests.id))
        .orderBy(desc(checkoutRequests.createdAt))
        .limit(Math.max(limit * 4, 50))
    },
  },

  carts: {
    /**
     * Find a cart with its full relation tree (items → product/variant).
     * Uses the read-replica via `drizzleDb` — suitable for display queries.
     */
    findWithRelationsByUserId: (userId: string) =>
      _findCartWithRelations(eq(carts.userId, userId)),

    findWithRelationsBySessionId: (sessionId: string) =>
      _findCartWithRelations(eq(carts.sessionId, sessionId)),

    findWithRelationsById: (id: string) =>
      _findCartWithRelations(eq(carts.id, id)),

    /**
     * Find a cart by user ID using the primary DB (write-consistent reads
     * that precede inserts / updates).
     */
    findByUserId: async (userId: string) => {
      return primaryDrizzleDb.query.carts.findFirst({
        where: eq(carts.userId, userId),
      })
    },

    findBySessionId: async (sessionId: string) => {
      return primaryDrizzleDb.query.carts.findFirst({
        where: eq(carts.sessionId, sessionId),
      })
    },

    /**
     * Find a cart with its items (shallow — no product/variant relations).
     * Used by the merge/promote flow where only item IDs and quantities matter.
     */
    findWithItemsByUserId: async (userId: string) => {
      return primaryDrizzleDb.query.carts.findFirst({
        where: eq(carts.userId, userId),
        with: { items: true },
      })
    },

    findWithItemsBySessionId: async (sessionId: string) => {
      return primaryDrizzleDb.query.carts.findFirst({
        where: eq(carts.sessionId, sessionId),
        with: { items: true },
      })
    },

    /**
     * Atomic insert-or-ignore for a user cart.
     * Returns the inserted row, or `undefined` if the row already existed
     * (unique constraint on `carts.userId`).
     */
    createForUserOrIgnore: async (userId: string) => {
      const [inserted] = await primaryDrizzleDb
        .insert(carts)
        .values({ userId, updatedAt: new Date() })
        .onConflictDoNothing({ target: carts.userId })
        .returning()
      return inserted
    },

    createForSessionOrIgnore: async (sessionId: string) => {
      const [inserted] = await primaryDrizzleDb
        .insert(carts)
        .values({ sessionId, updatedAt: new Date() })
        .onConflictDoNothing({ target: carts.sessionId })
        .returning()
      return inserted
    },

    /**
     * Touch a cart's `updatedAt` timestamp.
     */
    update: async (id: string, values: { updatedAt: Date }): Promise<void> => {
      await primaryDrizzleDb.update(carts).set(values).where(eq(carts.id, id))
    },

    /**
     * Promote a guest cart to a user cart by setting `userId` and clearing
     * `sessionId`.
     */
    promoteToUser: async (
      cartId: string,
      userId: string,
      now: Date
    ): Promise<void> => {
      await primaryDrizzleDb
        .update(carts)
        .set({ userId, sessionId: null, updatedAt: now })
        .where(eq(carts.id, cartId))
    },

    delete: async (id: string): Promise<void> => {
      await primaryDrizzleDb.delete(carts).where(eq(carts.id, id))
    },

    /** Find a single cart item by cart + product + variant. */
    findItem: async (cartId: string, productId: string, variantId: string) => {
      return primaryDrizzleDb.query.cartItems.findFirst({
        where: and(
          eq(cartItems.cartId, cartId),
          eq(cartItems.productId, productId),
          eq(cartItems.variantId, variantId)
        ),
      })
    },

    insertItem: async (values: {
      cartId: string
      productId: string
      variantId: string
      quantity: number
    }): Promise<void> => {
      await primaryDrizzleDb.insert(cartItems).values({
        ...values,
        updatedAt: new Date(),
      })
    },

    updateItem: async (id: string, quantity: number): Promise<void> => {
      await primaryDrizzleDb
        .update(cartItems)
        .set({ quantity, updatedAt: new Date() })
        .where(eq(cartItems.id, id))
    },

    deleteItem: async (id: string): Promise<void> => {
      await primaryDrizzleDb.delete(cartItems).where(eq(cartItems.id, id))
    },

    /**
     * Fetch current stock for a set of product variants.
     * Uses the primary DB so the cart merge / stock cap is always accurate.
     */
    findVariantStock: async (
      variantIds: string[]
    ): Promise<
      Array<{
        id: string
        stock: number
        reservedStock: number
        availableStock: number
        deletedAt: Date | null
      }>
    > => {
      if (variantIds.length === 0) return []
      const rows = await primaryDrizzleDb
        .select({
          id: productVariants.id,
          stock: productVariants.stock,
          reservedStock: productVariants.reservedStock,
          deletedAt: productVariants.deletedAt,
        })
        .from(productVariants)
        .where(inArray(productVariants.id, variantIds))

      return rows.map((row) => ({
        ...row,
        availableStock: availableUnits(row),
      }))
    },
  },
}
