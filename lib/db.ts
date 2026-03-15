import { Pool } from "@neondatabase/serverless";
import { drizzle } from "drizzle-orm/neon-serverless";
import {
  products,
  productVariations,
  users,
  accounts,
  sessions,
  verificationTokens,
  passwordHistory,
  orders,
  orderItems,
  carts,
  cartItems,
  userRoleEnum,
  orderStatusEnum,
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
} from "./schema";
import { eq, desc, and, isNull, sql, ne } from "drizzle-orm";
import { Product, ProductInput } from "./types";
import { env } from "./env";
import {
  cacheProductsList,
  cacheProductById,
  cacheProductsBestsellers,
  invalidateProductCaches,
} from "./cache";

// All schema tables and relations collected into one object for Drizzle relational queries
const schema = {
  userRoleEnum,
  orderStatusEnum,
  users,
  accounts,
  sessions,
  verificationTokens,
  passwordHistory,
  products,
  productVariations,
  orders,
  orderItems,
  carts,
  cartItems,
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
};

// ─── Connection Pool (singleton for serverless) ─────────

const globalForDb = globalThis as unknown as {
  pool: Pool | undefined;
};

function createPool() {
  // No SSL config needed — Neon's driver uses WebSocket protocol,
  // bypassing TCP/TLS certificate issues entirely
  return new Pool({
    connectionString: env.DATABASE_URL,
  });
}

// Using ??= pattern for singleton to avoid recreating pools on hot reloads
const pool = (globalForDb.pool ??= createPool());
if (env.NODE_ENV !== "production") globalForDb.pool = pool;

// ─── Drizzle Instance ───────────────────────────────────

export const drizzleDb = drizzle(pool, { schema });

// Export type for use in other files
export type DrizzleDb = typeof drizzleDb;

// ─── Product Helpers (with date serialization) ──────────

export interface ProductListOptions {
  limit?: number;
  offset?: number;
  withCache?: boolean;
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
          with: { variations: true },
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
    findBestsellers: (
      options: ProductListOptions = {},
    ): Promise<Product[]> => {
      const { limit, withCache = false } = options;

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

        const rows = await drizzleDb
          .select({
            id: products.id,
            name: products.name,
            description: products.description,
            price: products.price,
            image: products.image,
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
            desc(salesSubquery.totalSold),
            desc(products.createdAt),
          )
          .$dynamic()
          .then((r) => (limit ? r.slice(0, limit) : r));

        if (rows.length === 0) return [];

        // Fetch variations only for the products that made the cut
        const productIds = rows.map((r) => r.id);
        const varRows = await drizzleDb.query.productVariations.findMany({
          where: (pv, { inArray }) => inArray(pv.productId, productIds),
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
        Pick<Product, "id" | "name" | "price" | "stock" | "category" | "image">
      >
    > => {
      const { limit, offset, withCache = false } = options;

      const fetcher = async () => {
        const rows = await drizzleDb.query.products.findMany({
          where: isNull(products.deletedAt),
          orderBy: [desc(products.createdAt)],
          columns: {
            id: true,
            name: true,
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
      if (withCache && !limit && !offset) {
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
          with: { variations: true },
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
};
