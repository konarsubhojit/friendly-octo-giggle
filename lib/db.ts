import { Pool } from '@neondatabase/serverless';
import { drizzle } from 'drizzle-orm/neon-serverless';
import * as schema from './schema';
import { eq, desc } from 'drizzle-orm';
import { Product, ProductInput } from './types';
import { env } from './env';

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

const pool = globalForDb.pool ?? createPool();
if (env.NODE_ENV !== 'production') globalForDb.pool = pool;

// ─── Drizzle Instance ───────────────────────────────────

export const drizzleDb = drizzle(pool, { schema });

// Export type for use in other files
export type DrizzleDb = typeof drizzleDb;

// ─── Product Helpers (with date serialization) ──────────

export const db = {
  products: {
    findAll: async (): Promise<Product[]> => {
      const rows = await drizzleDb.query.products.findMany({
        orderBy: [desc(schema.products.createdAt)],
        with: { variations: true },
      });
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
    },

    findById: async (id: string): Promise<Product | null> => {
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
    },

    create: async (input: ProductInput): Promise<Product> => {
      const [row] = await drizzleDb
        .insert(schema.products)
        .values({ ...input, updatedAt: new Date() })
        .returning();
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
      return result.length > 0;
    },
  },
};
