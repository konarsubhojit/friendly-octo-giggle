import { drizzle } from 'drizzle-orm/node-postgres';
import pg from 'pg';
import * as schema from './schema';
import { eq, desc } from 'drizzle-orm';
import { Product, ProductInput } from './types';

// ─── Connection Pool (singleton for serverless) ─────────

const globalForDb = globalThis as unknown as {
  pool: pg.Pool | undefined;
};

function createPool() {
  const connectionString = process.env.DATABASE_URL || '';
  const isSSL = !connectionString.includes('sslmode=disable') && !connectionString.includes('localhost');
  
  // Enhanced SSL configuration for self-signed certificates
  const sslConfig = isSSL
    ? {
        rejectUnauthorized: false,
        // Explicitly bypass certificate validation for self-signed certs
        // This is required for managed PostgreSQL services (Neon, Supabase, Railway)
        checkServerIdentity: () => undefined,
      }
    : false;
  
  return new pg.Pool({
    connectionString,
    ssl: sslConfig,
    // Add connection timeout and retry settings for serverless environments
    connectionTimeoutMillis: 10000,
    idleTimeoutMillis: 30000,
  });
}

const pool = globalForDb.pool ?? createPool();
if (process.env.NODE_ENV !== 'production') globalForDb.pool = pool;

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
