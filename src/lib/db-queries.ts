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
  type SQL,
} from 'drizzle-orm'
import {
  products,
  productShares,
  wishlists,
  orders,
  orderItems,
} from './schema'
import { drizzleDb, primaryDrizzleDb } from './db'
import { Product, ProductInput } from './types'
import {
  cacheProductById,
  invalidateProductCaches,
  cacheShareResolve,
} from './cache'
import { serializeProduct, serializeVariant } from './serializers'

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
}

/** Derive price/stock from embedded variant rows. */
function deriveMinimalProduct(row: {
  id: string
  name: string
  description: string
  category: string
  image: string
  variants: Array<{ price: number; stock: number }>
}): MinimalProduct {
  const { variants, ...base } = row
  const price =
    variants.length > 0 ? Math.min(...variants.map((v) => v.price)) : 0
  const stock = variants.reduce((sum, v) => sum + v.stock, 0)
  return { ...base, price, stock }
}

export const db = {
  products: {
    /**
     * Find all products with optional pagination
     * @param options - Pagination options
     * @returns Array of products with full details including variations
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
     * so that only the final result-set rows are loaded into memory. Variations
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

      return rows.map((p) => ({
        ...serializeProduct(p),
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

      return rows.map(deriveMinimalProduct)
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

      return rows.map(deriveMinimalProduct)
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
            variants: {
              where: (v, { isNull }) => isNull(v.deletedAt),
            },
          },
        })
        if (!row) return null
        return {
          ...serializeProduct(row),
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
     * Resolve a share key to its product and variation IDs.
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
}
