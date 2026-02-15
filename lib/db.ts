import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import pg from 'pg';
import { Product, ProductInput } from './types';
import { logDatabaseOperation, Timer } from './logger';

// Singleton Prisma client for serverless
const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

function createPrismaClient() {
  const connectionString = process.env.DATABASE_URL;
  
  // Prepare connection string with SSL parameters if not already present
  let enhancedConnectionString = connectionString;
  if (connectionString && !connectionString.includes('sslmode=')) {
    const separator = connectionString.includes('?') ? '&' : '?';
    enhancedConnectionString = `${connectionString}${separator}sslmode=require&sslaccept=accept_invalid_certs`;
  }
  
  // Configure SSL for pg.Pool to handle self-signed certificates
  const sslConfig = connectionString?.includes('sslmode=disable') 
    ? false 
    : { 
        rejectUnauthorized: false,
        // Explicitly bypass certificate validation for self-signed certificates
        // This is required for managed PostgreSQL services (Neon, Supabase, Railway)
        // that use self-signed certificates in serverless environments
        checkServerIdentity: () => undefined
      };
  
  const pool = new pg.Pool({
    connectionString: enhancedConnectionString,
    ssl: sslConfig,
    // Add connection timeout and retry settings for serverless
    connectionTimeoutMillis: 10000,
    idleTimeoutMillis: 30000,
  });
  
  const adapter = new PrismaPg(pool);
  // Note: In Prisma 7 with adapters, datasources cannot be passed to PrismaClient constructor
  // The connection string is already configured in the pg.Pool and passed via the adapter
  return new PrismaClient({ 
    adapter, 
    log: ['error', 'warn'],
  });
}

export const prisma = globalForPrisma.prisma ?? createPrismaClient();

if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = prisma;

export const db = {
  products: {
    findAll: async (options?: { limit?: number }): Promise<Product[]> => {
      const timer = new Timer('db.products.findAll');
      try {
        const products = await prisma.product.findMany({
          orderBy: { createdAt: 'desc' },
          include: {
            variations: true,
          },
          take: options?.limit,
        });
        type ProductWithVariations = (typeof products)[number];
        type Variation = ProductWithVariations['variations'][number];
        const duration = timer.end({ recordCount: products.length, limit: options?.limit });
        logDatabaseOperation({
          operation: 'findMany',
          model: 'Product',
          duration,
          recordCount: products.length,
          success: true,
        });
        return products.map((p: ProductWithVariations) => ({
          ...p,
          createdAt: p.createdAt.toISOString(),
          updatedAt: p.updatedAt.toISOString(),
          variations: p.variations.map((v: Variation) => ({
            ...v,
            createdAt: v.createdAt.toISOString(),
            updatedAt: v.updatedAt.toISOString(),
          })),
        }));
      } catch (error) {
        const duration = timer.end();
        logDatabaseOperation({
          operation: 'findMany',
          model: 'Product',
          duration,
          success: false,
          error: error instanceof Error ? error.message : String(error),
        });
        throw error;
      }
    },
    
    findById: async (id: string): Promise<Product | null> => {
      const timer = new Timer('db.products.findById');
      try {
        const product = await prisma.product.findUnique({
          where: { id },
          include: {
            variations: true,
          },
        });
        const duration = timer.end({ productId: id, found: !!product });
        logDatabaseOperation({
          operation: 'findUnique',
          model: 'Product',
          duration,
          recordCount: product ? 1 : 0,
          success: true,
        });
        if (!product) return null;
        type ProductWithVariations = typeof product;
        type Variation = ProductWithVariations['variations'][number];
        return {
          ...product,
          createdAt: product.createdAt.toISOString(),
          updatedAt: product.updatedAt.toISOString(),
          variations: product.variations.map((v: Variation) => ({
            ...v,
            createdAt: v.createdAt.toISOString(),
            updatedAt: v.updatedAt.toISOString(),
          })),
        };
      } catch (error) {
        const duration = timer.end();
        logDatabaseOperation({
          operation: 'findUnique',
          model: 'Product',
          duration,
          success: false,
          error: error instanceof Error ? error.message : String(error),
        });
        throw error;
      }
    },
    
    create: async (input: ProductInput): Promise<Product> => {
      const product = await prisma.product.create({
        data: input,
      });
      return {
        ...product,
        createdAt: product.createdAt.toISOString(),
        updatedAt: product.updatedAt.toISOString(),
      };
    },
    
    update: async (id: string, input: Partial<ProductInput>): Promise<Product | null> => {
      try {
        const product = await prisma.product.update({
          where: { id },
          data: input,
        });
        return {
          ...product,
          createdAt: product.createdAt.toISOString(),
          updatedAt: product.updatedAt.toISOString(),
        };
      } catch {
        return null;
      }
    },
    
    delete: async (id: string): Promise<boolean> => {
      try {
        await prisma.product.delete({
          where: { id },
        });
        return true;
      } catch {
        return false;
      }
    },
  },
};
