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

// ─── Shared error types ──────────────────────────────────

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

// ─── Product Helpers (with date serialization) ──────────

export interface ProductListOptions {
  limit?: number
  offset?: number
  search?: string
  category?: string
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
  productIds: string[]
): Promise<Map<string, number>> => {
  if (productIds.length === 0) {
    return new Map()
  }

  const rows = await cacheProductSoldCounts(productIds, async () =>
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
  )

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
      options: ProductListOptions = {}
    ): Promise<Product[]> => {
      const { limit = 5 } = options

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
          localizedContent: products.localizedContent,
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

      const soldCountByProductId = await fetchProductSoldCounts(productIds)

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
     * @param withCache - Whether to use Redis cache
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
        const soldCountByProductId = await fetchProductSoldCounts([id])
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
     */
    findManyWithVariantsForOrderValidation: async (ids: string[]) => {
      return primaryDrizzleDb.query.products.findMany({
        where: and(inArray(products.id, ids), isNull(products.deletedAt)),
        with: {
          variants: {
            where: (variant, operators) => operators.isNull(variant.deletedAt),
          },
        },
      })
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
     */
    findFirstForCart: async (productId: string) => {
      return drizzleDb.query.products.findFirst({
        where: and(eq(products.id, productId), isNull(products.deletedAt)),
        with: {
          variants: {
            where: (variant, { isNull: isVariantNull }) =>
              isVariantNull(variant.deletedAt),
          },
        },
      })
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
     * Fetch a user's currency and locale preferences.
     * Returns null if the user does not exist.
     */
    findPreferences: async (
      userId: string
    ): Promise<{
      currencyPreference: string | null
      localePreference: string | null
    } | null> => {
      const row = await drizzleDb.query.users.findFirst({
        where: eq(users.id, userId),
        columns: { currencyPreference: true, localePreference: true },
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
      totalAmount: number
      verifiedPayment: {
        provider: 'RAZORPAY'
        paymentOrderId: string
        paymentTransactionId: string
        amountPaid: number
        paidAt: Date
      }
      items: Array<{
        productId: string
        variantId: string
        quantity: number
        price: number
        customizationNote: string | null
      }>
    }) => {
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
            totalAmount: input.totalAmount,
            status: 'PENDING',
            paymentStatus: 'PAID',
            paymentProvider: input.verifiedPayment.provider,
            paymentOrderId: input.verifiedPayment.paymentOrderId,
            paymentTransactionId: input.verifiedPayment.paymentTransactionId,
            amountPaid: input.verifiedPayment.amountPaid,
            paidAt: input.verifiedPayment.paidAt,
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
        .set({ status: status as 'PENDING' | 'PROCESSING' | 'SHIPPED' | 'DELIVERED' | 'CANCELLED', updatedAt: new Date() })
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
      paymentProvider: string
      paymentOrderId: string
      paymentTransactionId: string
      paymentSignature: string
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
          paymentProvider: values.paymentProvider as 'RAZORPAY',
          paymentOrderId: values.paymentOrderId,
          paymentTransactionId: values.paymentTransactionId,
          paymentSignature: values.paymentSignature,
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
     * Update the status (and optional error message) of a checkout request.
     */
    updateStatus: async (
      id: string,
      status: string,
      errorMessage: string | null
    ): Promise<void> => {
      await primaryDrizzleDb
        .update(checkoutRequests)
        .set({ status: status as CheckoutRequestStatus, errorMessage, updatedAt: new Date() })
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
      await primaryDrizzleDb
        .update(carts)
        .set(values)
        .where(eq(carts.id, id))
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
    findItem: async (
      cartId: string,
      productId: string,
      variantId: string
    ) => {
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
        deletedAt: Date | null
      }>
    > => {
      if (variantIds.length === 0) return []
      return primaryDrizzleDb
        .select({
          id: productVariants.id,
          stock: productVariants.stock,
          deletedAt: productVariants.deletedAt,
        })
        .from(productVariants)
        .where(inArray(productVariants.id, variantIds))
    },
  },
}
