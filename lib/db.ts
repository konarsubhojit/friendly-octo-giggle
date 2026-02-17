import { Pool } from '@neondatabase/serverless';
import { drizzle } from 'drizzle-orm/neon-serverless';
import * as schema from './schema';
import { eq, desc } from 'drizzle-orm';
import { Product, ProductInput } from './types';
import { env } from './env';
import { cacheProductsList, cacheProductById, invalidateProductCaches } from './cache';

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
const pool = globalForDb.pool ??= createPool();
if (env.NODE_ENV !== 'production') globalForDb.pool = pool;

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
          orderBy: [desc(schema.products.createdAt)],
          with: { variations: true },
          limit,
          offset,
        });

        const rows = await query;

        return rows.map((p) => ({
          ...p,
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
     * Find products for list views (minimal fields for performance)
     * @param options - Pagination options
     * @returns Array of products with only essential fields for list views
     */
    findAllMinimal: async (options: ProductListOptions = {}): Promise<Array<Pick<Product, 'id' | 'name' | 'price' | 'stock' | 'category' | 'image'>>> => {
      const { limit, offset, withCache = false } = options;

      const fetcher = async () => {
        const rows = await drizzleDb.query.products.findMany({
          orderBy: [desc(schema.products.createdAt)],
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
    findById: async (id: string, withCache = false): Promise<Product | null> => {
      const fetcher = async () => {
        const row = await drizzleDb.query.products.findFirst({
          where: eq(schema.products.id, id),
          with: { variations: true },
        });
        if (!row) return null;
        return {
          ...row,
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
        .insert(schema.products)
        .values({ ...input, updatedAt: new Date() })
        .returning();

      // Invalidate product caches after creation
      await invalidateProductCaches();

      return {
        ...row,
        createdAt: row.createdAt.toISOString(),
        updatedAt: row.updatedAt.toISOString(),
      };
    },

    update: async (id: string, input: Partial<ProductInput>): Promise<Product | null> => {
      const [row] = await drizzleDb
        .update(schema.products)
        .set({ ...input, updatedAt: new Date() })
        .where(eq(schema.products.id, id))
        .returning();

      if (!row) return null;

      // Invalidate product caches after update
      await invalidateProductCaches(id);

      return {
        ...row,
        createdAt: row.createdAt.toISOString(),
        updatedAt: row.updatedAt.toISOString(),
      };
    },

    delete: async (id: string): Promise<boolean> => {
      const result = await drizzleDb
        .delete(schema.products)
        .where(eq(schema.products.id, id))
        .returning({ id: schema.products.id });

      const success = result.length > 0;

      // Invalidate product caches after deletion
      if (success) {
        await invalidateProductCaches(id);
      }

      return success;
    },
  },
};
