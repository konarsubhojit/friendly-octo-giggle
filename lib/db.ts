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
  const pool = new pg.Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: process.env.DATABASE_URL?.includes('sslmode=disable') 
      ? false 
      : { rejectUnauthorized: false },
  });
  const adapter = new PrismaPg(pool);
  return new PrismaClient({ adapter, log: ['error'] });
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
