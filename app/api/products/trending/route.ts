import { NextRequest } from 'next/server';
import { drizzleDb } from '@/lib/db';
import { orderItems, orders, products } from '@/lib/schema';
import { sql, desc, gt, eq, inArray, isNull, and } from 'drizzle-orm';
import { apiSuccess, handleApiError } from '@/lib/api-utils';
import { getCachedData } from '@/lib/redis';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  try {
    const limitParam = request.nextUrl.searchParams.get('limit');
    const limit = Math.min(Math.max(Number(limitParam) || 6, 1), 20);

    const trending = await getCachedData(
      `products:trending:${limit}`,
      300,
      async () => {
        // Get products ordered by total quantity sold in recent orders
        const trendingProducts = await drizzleDb
          .select({
            productId: orderItems.productId,
            totalSold: sql<number>`cast(sum(${orderItems.quantity}) as int)`,
          })
          .from(orderItems)
          .innerJoin(orders, eq(orders.id, orderItems.orderId))
          .where(gt(orders.createdAt, sql`now() - interval '30 days'`))
          .groupBy(orderItems.productId)
          .orderBy(desc(sql`sum(${orderItems.quantity})`))
          .limit(limit);

        if (trendingProducts.length === 0) {
          // Fallback: return newest products if no orders yet
          const newest = await drizzleDb.query.products.findMany({
            where: isNull(products.deletedAt),
            orderBy: [desc(products.createdAt)],
            limit,
            with: { variations: true },
          });
          return newest.map((p) => ({
            ...p,
            createdAt: p.createdAt instanceof Date ? p.createdAt.toISOString() : p.createdAt,
            updatedAt: p.updatedAt instanceof Date ? p.updatedAt.toISOString() : p.updatedAt,
            totalSold: 0,
          }));
        }

        const productIds = trendingProducts.map((t) => t.productId);
        const productRecords = await drizzleDb.query.products.findMany({
          where: and(inArray(products.id, productIds), isNull(products.deletedAt)),
          with: { variations: true },
        });

        // Merge totalSold and sort by it
        const soldMap = new Map(trendingProducts.map((t) => [t.productId, t.totalSold]));
        return productRecords
          .map((p) => ({
            ...p,
            createdAt: p.createdAt instanceof Date ? p.createdAt.toISOString() : p.createdAt,
            updatedAt: p.updatedAt instanceof Date ? p.updatedAt.toISOString() : p.updatedAt,
            totalSold: soldMap.get(p.id) ?? 0,
          }))
          .sort((a, b) => b.totalSold - a.totalSold);
      },
      60
    );

    return apiSuccess({ products: trending });
  } catch (error) {
    return handleApiError(error);
  }
}
