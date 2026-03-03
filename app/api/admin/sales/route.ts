import { drizzleDb } from '@/lib/db';
import * as schema from '@/lib/schema';
import { sql, eq, count, and, gte, lt, ne } from 'drizzle-orm';
import { apiSuccess, apiError, handleApiError } from '@/lib/api-utils';
import { auth } from '@/lib/auth';
import { getCachedData } from '@/lib/redis';

export const dynamic = 'force-dynamic';

async function checkAdminAuth() {
  const session = await auth();
  if (!session?.user) {
    return { authorized: false, error: 'Not authenticated', status: 401 as const };
  }
  if (session.user.role !== 'ADMIN') {
    return { authorized: false, error: 'Not authorized - Admin access required', status: 403 as const };
  }
  return { authorized: true };
}

export async function GET() {
  const authCheck = await checkAdminAuth();
  if (!authCheck.authorized) {
    return apiError(authCheck.error!, authCheck.status);
  }

  try {
    const sales = await getCachedData(
      'admin:sales:summary',
      120,
      async () => {
        const now = new Date();
        const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
        const thisMonth = new Date(now.getFullYear(), now.getMonth(), 1);
        const lastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);

        // Total revenue and order count (all time)
        const [totalStats] = await drizzleDb
          .select({
            totalRevenue: sql<number>`coalesce(sum(${schema.orders.totalAmount}), 0)`,
            totalOrders: count(),
          })
          .from(schema.orders)
          .where(ne(schema.orders.status, 'CANCELLED'));

        // Today's revenue
        const [todayStats] = await drizzleDb
          .select({
            revenue: sql<number>`coalesce(sum(${schema.orders.totalAmount}), 0)`,
            orderCount: count(),
          })
          .from(schema.orders)
          .where(and(gte(schema.orders.createdAt, today), ne(schema.orders.status, 'CANCELLED')));

        // This month's revenue
        const [monthStats] = await drizzleDb
          .select({
            revenue: sql<number>`coalesce(sum(${schema.orders.totalAmount}), 0)`,
            orderCount: count(),
          })
          .from(schema.orders)
          .where(and(gte(schema.orders.createdAt, thisMonth), ne(schema.orders.status, 'CANCELLED')));

        // Last month's revenue (for comparison)
        const [lastMonthStats] = await drizzleDb
          .select({
            revenue: sql<number>`coalesce(sum(${schema.orders.totalAmount}), 0)`,
            orderCount: count(),
          })
          .from(schema.orders)
          .where(and(gte(schema.orders.createdAt, lastMonth), lt(schema.orders.createdAt, thisMonth), ne(schema.orders.status, 'CANCELLED')));

        // Orders by status (excluding cancelled to match totals)
        const statusCounts = await drizzleDb
          .select({
            status: schema.orders.status,
            count: count(),
          })
          .from(schema.orders)
          .where(ne(schema.orders.status, 'CANCELLED'))
          .groupBy(schema.orders.status);

        // Top selling products
        const topProducts = await drizzleDb
          .select({
            productId: schema.orderItems.productId,
            productName: schema.products.name,
            totalQuantity: sql<number>`cast(sum(${schema.orderItems.quantity}) as int)`,
            totalRevenue: sql<number>`sum(${schema.orderItems.price} * ${schema.orderItems.quantity})`,
          })
          .from(schema.orderItems)
          .innerJoin(schema.products, eq(schema.orderItems.productId, schema.products.id))
          .innerJoin(schema.orders, eq(schema.orderItems.orderId, schema.orders.id))
          .where(ne(schema.orders.status, 'CANCELLED'))
          .groupBy(schema.orderItems.productId, schema.products.name)
          .orderBy(sql`sum(${schema.orderItems.quantity}) desc`)
          .limit(5);

        // Total customers
        const [customerCount] = await drizzleDb
          .select({ count: count() })
          .from(schema.users)
          .where(eq(schema.users.role, 'CUSTOMER'));

        return {
          totalRevenue: Number(totalStats.totalRevenue),
          totalOrders: totalStats.totalOrders,
          todayRevenue: Number(todayStats.revenue),
          todayOrders: todayStats.orderCount,
          monthRevenue: Number(monthStats.revenue),
          monthOrders: monthStats.orderCount,
          lastMonthRevenue: Number(lastMonthStats.revenue),
          lastMonthOrders: lastMonthStats.orderCount,
          ordersByStatus: statusCounts.reduce((acc, s) => {
            acc[s.status] = s.count;
            return acc;
          }, {} as Record<string, number>),
          topProducts: topProducts.map((p) => ({
            productId: p.productId,
            name: p.productName,
            totalQuantity: p.totalQuantity,
            totalRevenue: Number(p.totalRevenue),
          })),
          totalCustomers: customerCount.count,
        };
      },
      30
    );

    return apiSuccess({ sales });
  } catch (error) {
    return handleApiError(error);
  }
}
