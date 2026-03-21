import { Pool } from "@neondatabase/serverless";
import { drizzle } from "drizzle-orm/neon-serverless";
import {
  products,
  productVariations,
  productShares,
  categories,
  users,
  accounts,
  sessions,
  verificationTokens,
  passwordHistory,
  orders,
  orderItems,
  carts,
  cartItems,
  wishlists,
  reviews,
  failedEmails,
  userRoleEnum,
  orderStatusEnum,
  emailTypeEnum,
  failedEmailStatusEnum,
  usersRelations,
  accountsRelations,
  passwordHistoryRelations,
  sessionsRelations,
  productsRelations,
  productVariationsRelations,
  ordersRelations,
  orderItemsRelations,
  cartsRelations,
  cartItemsRelations,
  wishlistsRelations,
  reviewsRelations,
  productSharesRelations,
  categoriesRelations,
} from "./schema";
import {
  eq,
  desc,
  and,
  isNull,
  sql,
  ne,
  ilike,
  or,
  type SQL,
} from "drizzle-orm";
import { Product, ProductInput } from "./types";
import { env } from "./env";
import {
  cacheProductsList,
  cacheProductById,
  cacheProductsBestsellers,
  invalidateProductCaches,
  cacheShareResolve,
} from "./cache";

// All schema tables and relations collected into one object for Drizzle relational queries
const schema = {
  userRoleEnum,
  orderStatusEnum,
  emailTypeEnum,
  failedEmailStatusEnum,
  users,
  accounts,
  sessions,
  verificationTokens,
  passwordHistory,
  products,
  productVariations,
  productShares,
  categories,
  orders,
  orderItems,
  carts,
  cartItems,
  wishlists,
  failedEmails,
  usersRelations,
  categoriesRelations,
  accountsRelations,
  passwordHistoryRelations,
  sessionsRelations,
  productsRelations,
  productVariationsRelations,
  ordersRelations,
  orderItemsRelations,
  cartsRelations,
  cartItemsRelations,
  wishlistsRelations,
  reviews,
  reviewsRelations,
  productSharesRelations,
};

// ─── Connection Pool (singleton for serverless) ─────────

const globalForDb = globalThis as unknown as {
  pool: Pool | undefined;
};

const createPool = () =>
  new Pool({
    connectionString: env.DATABASE_URL,
  });

// Using ??= pattern for singleton to avoid recreating pools on hot reloads
const pool = (globalForDb.pool ??= createPool());
if (env.NODE_ENV === "development") globalForDb.pool = pool;

// ─── Drizzle Instance ───────────────────────────────────

export const drizzleDb = drizzle(pool, { schema });

// Export type for use in other files
export type DrizzleDb = typeof drizzleDb;

// ─── Product Helpers (with date serialization) ──────────

export interface ProductListOptions {
  limit?: number;
  offset?: number;
  withCache?: boolean;
  search?: string;
  category?: string;
}

export const db = {
  products: {
    /**
     * Find all products with optional pagination and caching
     * @param options - Pagination and cache options
     * @returns Array of products with full details including variations
     */
    findAll: async (options: ProductListOptions = {}): Promise<Product[]> => {
      const { limit, offset, withCache = false } = options;

      const fetcher = async () => {
        const query = drizzleDb.query.products.findMany({
          where: isNull(products.deletedAt),
          orderBy: [desc(products.createdAt)],
          with: {
            variations: {
              where: (v, { isNull }) => isNull(v.deletedAt),
            },
          },
          limit,
          offset,
        });

        const rows = await query;

        return rows.map((p) => ({
          ...p,
          deletedAt: null,
          createdAt: p.createdAt.toISOString(),
          updatedAt: p.updatedAt.toISOString(),
          variations: p.variations.map((v) => ({
            ...v,
            image: v.image ?? null,
            images: v.images ?? [],
            deletedAt: null,
            createdAt: v.createdAt.toISOString(),
            updatedAt: v.updatedAt.toISOString(),
          })),
        }));
      };

      // Use cache only if explicitly requested and no pagination
      if (withCache && !limit && !offset) {
        return cacheProductsList(fetcher);
      }

      return fetcher();
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
    findBestsellers: (options: ProductListOptions = {}): Promise<Product[]> => {
      const { limit = 5, withCache = false } = options;

      const fetcher = async () => {
        // Single SQL query: LEFT JOIN a sales-aggregate subquery so products
        // with no sales still appear (totalSold = 0), then sort + limit in DB.
        const salesSubquery = drizzleDb
          .select({
            productId: orderItems.productId,
            totalSold:
              sql<number>`cast(coalesce(sum(${orderItems.quantity}), 0) as int)`.as(
                "total_sold",
              ),
          })
          .from(orderItems)
          .innerJoin(
            orders,
            and(
              eq(orders.id, orderItems.orderId),
              ne(orders.status, "CANCELLED"),
            ),
          )
          .groupBy(orderItems.productId)
          .as("sales");

        let bestsellerQuery = drizzleDb
          .select({
            id: products.id,
            name: products.name,
            description: products.description,
            price: products.price,
            image: products.image,
            images: products.images,
            stock: products.stock,
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
            desc(products.createdAt),
          )
          .$dynamic();

        if (limit) {
          bestsellerQuery = bestsellerQuery.limit(limit);
        }

        const rows = await bestsellerQuery;

        if (rows.length === 0) return [];

        // Fetch variations only for the products that made the cut
        const productIds = rows.map((r) => r.id);
        const varRows = await drizzleDb.query.productVariations.findMany({
          where: (pv, { inArray, and, isNull }) =>
            and(inArray(pv.productId, productIds), isNull(pv.deletedAt)),
        });

        // Group variations by productId for O(1) lookup
        const varsByProduct = new Map<string, typeof varRows>();
        for (const v of varRows) {
          const list = varsByProduct.get(v.productId) ?? [];
          list.push(v);
          varsByProduct.set(v.productId, list);
        }

        return rows.map((p) => ({
          ...p,
          deletedAt: null,
          createdAt: p.createdAt.toISOString(),
          updatedAt: p.updatedAt.toISOString(),
          variations: (varsByProduct.get(p.id) ?? []).map((v) => ({
            ...v,
            image: v.image ?? null,
            images: v.images ?? [],
            deletedAt: null,
            createdAt: v.createdAt.toISOString(),
            updatedAt: v.updatedAt.toISOString(),
          })),
        }));
      };

      // Only cache when there is no pagination — a limited result set would
      // collide with the full-catalog entry under the same cache key.
      if (withCache && !limit) {
        return cacheProductsBestsellers(fetcher);
      }

      return fetcher();
    },

    /**
     * Find products for list views (minimal fields for performance)
     * @param options - Pagination options
     * @returns Array of products with only essential fields for list views
     */
    findAllMinimal: async (
      options: ProductListOptions = {},
    ): Promise<
      Array<
        Pick<
          Product,
          | "id"
          | "name"
          | "description"
          | "price"
          | "stock"
          | "category"
          | "image"
        >
      >
    > => {
      const { limit, offset, withCache = false, search, category } = options;

      const fetcher = async () => {
        const filters: SQL[] = [isNull(products.deletedAt)];
        const normalizedSearch = search?.trim();
        const normalizedCategory = category?.trim();

        if (normalizedSearch) {
          filters.push(
            or(
              ilike(products.name, `%${normalizedSearch}%`),
              ilike(products.description, `%${normalizedSearch}%`),
            ) as SQL,
          );
        }

        if (normalizedCategory) {
          filters.push(eq(products.category, normalizedCategory));
        }

        const whereClause = filters.length === 1 ? filters[0] : and(...filters);

        const rows = await drizzleDb.query.products.findMany({
          where: whereClause,
          orderBy: [desc(products.createdAt)],
          columns: {
            id: true,
            name: true,
            description: true,
            price: true,
            stock: true,
            category: true,
            image: true,
          },
          limit,
          offset,
        });

        return rows;
      };

      // Use cache only if explicitly requested and no pagination
      if (withCache && !limit && !offset && !search && !category) {
        return cacheProductsList(fetcher);
      }

      return fetcher();
    },

    /**
     * Find product by ID with optional caching
     * @param id - Product ID
     * @param withCache - Whether to use Redis cache
     * @returns Product with full details or null if not found
     */
    findById: async (
      id: string,
      withCache = false,
    ): Promise<Product | null> => {
      const fetcher = async () => {
        const row = await drizzleDb.query.products.findFirst({
          where: and(eq(products.id, id), isNull(products.deletedAt)),
          with: {
            variations: {
              where: (v, { isNull }) => isNull(v.deletedAt),
            },
          },
        });
        if (!row) return null;
        return {
          ...row,
          deletedAt: null,
          createdAt: row.createdAt.toISOString(),
          updatedAt: row.updatedAt.toISOString(),
          variations: row.variations.map((v) => ({
            ...v,
            image: v.image ?? null,
            images: v.images ?? [],
            deletedAt: null,
            createdAt: v.createdAt.toISOString(),
            updatedAt: v.updatedAt.toISOString(),
          })),
        };
      };

      if (withCache) {
        return cacheProductById(id, fetcher);
      }

      return fetcher();
    },

    create: async (input: ProductInput): Promise<Product> => {
      const [row] = await drizzleDb
        .insert(products)
        .values({ ...input, updatedAt: new Date() })
        .returning();

      // Invalidate product caches after creation
      await invalidateProductCaches();

      return {
        ...row,
        deletedAt: row.deletedAt?.toISOString() ?? null,
        createdAt: row.createdAt.toISOString(),
        updatedAt: row.updatedAt.toISOString(),
      };
    },

    update: async (
      id: string,
      input: Partial<ProductInput>,
    ): Promise<Product | null> => {
      const [row] = await drizzleDb
        .update(products)
        .set({ ...input, updatedAt: new Date() })
        .where(eq(products.id, id))
        .returning();

      if (!row) return null;

      // Invalidate product caches after update
      await invalidateProductCaches(id);

      return {
        ...row,
        deletedAt: row.deletedAt?.toISOString() ?? null,
        createdAt: row.createdAt.toISOString(),
        updatedAt: row.updatedAt.toISOString(),
      };
    },

    delete: async (id: string): Promise<boolean> => {
      // Soft delete: set deletedAt timestamp instead of removing the row
      const result = await drizzleDb
        .update(products)
        .set({ deletedAt: new Date(), updatedAt: new Date() })
        .where(and(eq(products.id, id), isNull(products.deletedAt)))
        .returning({ id: products.id });

      const success = result.length > 0;

      if (success) {
        await invalidateProductCaches(id);
      }

      return success;
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
        .where(eq(wishlists.userId, userId));
      return rows.map((r) => r.productId);
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
              variations: {
                where: (v, { isNull }) => isNull(v.deletedAt),
              },
            },
          },
        },
      });

      return rows
        .filter((r) => r.product !== null && !r.product.deletedAt)
        .map((r) => ({
          ...r.product,
          deletedAt: null,
          createdAt: r.product.createdAt.toISOString(),
          updatedAt: r.product.updatedAt.toISOString(),
          variations: r.product.variations.map((v) => ({
            ...v,
            image: v.image ?? null,
            images: v.images ?? [],
            deletedAt: null,
            createdAt: v.createdAt.toISOString(),
            updatedAt: v.updatedAt.toISOString(),
          })),
        }));
    },

    /**
     * Add a product to the user's wishlist (idempotent)
     */
    add: async (
      userId: string,
      productId: string,
    ): Promise<{ userId: string; productId: string }> => {
      const [row] = await drizzleDb
        .insert(wishlists)
        .values({ userId, productId })
        .onConflictDoNothing()
        .returning({
          userId: wishlists.userId,
          productId: wishlists.productId,
        });

      return row ?? { userId, productId };
    },

    /**
     * Remove a product from the user's wishlist
     */
    remove: async (userId: string, productId: string): Promise<boolean> => {
      const result = await drizzleDb
        .delete(wishlists)
        .where(
          and(eq(wishlists.userId, userId), eq(wishlists.productId, productId)),
        )
        .returning({ id: wishlists.id });

      return result.length > 0;
    },

    /**
     * Check if a product is in the user's wishlist
     */
    has: async (userId: string, productId: string): Promise<boolean> => {
      const row = await drizzleDb.query.wishlists.findFirst({
        where: and(
          eq(wishlists.userId, userId),
          eq(wishlists.productId, productId),
        ),
        columns: { id: true },
      });
      return row !== undefined;
    },
  },

  shares: {
    /**
     * Create a new product share link.
     * Returns the 7-char base62 key that acts as the shareable token.
     */
    create: async (
      productId: string,
      variationId: string | null,
    ): Promise<string> => {
      const [row] = await drizzleDb
        .insert(productShares)
        .values({ productId, variationId: variationId ?? null })
        .returning({ key: productShares.key });
      return row.key;
    },

    /**
     * Resolve a share key to its product and variation IDs.
     * Result is cached in Redis with a 1-year TTL since share tokens
     * are immutable — the mapping never changes after creation.
     * Null results (missing token) are not cached to prevent poisoning.
     * Returns null if the key does not exist.
     */
    resolve: (
      key: string,
    ): Promise<{ productId: string; variationId: string | null } | null> => {
      return cacheShareResolve(key, async () => {
        const row = await drizzleDb.query.productShares.findFirst({
          where: eq(productShares.key, key),
          columns: { productId: true, variationId: true },
        });
        if (!row) return null;
        return { productId: row.productId, variationId: row.variationId };
      });
    },
  },
};
