import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import pg from 'pg';
import { Product, ProductInput } from './types';

// Singleton Prisma client for serverless
const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

function createPrismaClient() {
  const pool = new pg.Pool({
    connectionString: process.env.DATABASE_URL,
  });
  const adapter = new PrismaPg(pool);
  return new PrismaClient({ adapter, log: ['error'] });
}

export const prisma = globalForPrisma.prisma ?? createPrismaClient();

if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = prisma;

export const db = {
  products: {
    findAll: async (): Promise<Product[]> => {
      const products = await prisma.product.findMany({
        orderBy: { createdAt: 'desc' },
      });
      return products.map(p => ({
        ...p,
        createdAt: p.createdAt.toISOString(),
        updatedAt: p.updatedAt.toISOString(),
      }));
    },
    
    findById: async (id: string): Promise<Product | null> => {
      const product = await prisma.product.findUnique({
        where: { id },
      });
      if (!product) return null;
      return {
        ...product,
        createdAt: product.createdAt.toISOString(),
        updatedAt: product.updatedAt.toISOString(),
      };
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
