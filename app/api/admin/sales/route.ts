import { drizzleDb } from "@/lib/db";
import { orders, orderItems, products, users } from "@/lib/schema";
import { sql, eq, count, and, gte, lt, ne } from "drizzle-orm";
import { apiSuccess, apiError, handleApiError } from "@/lib/api-utils";
import { checkAdminAuth } from "@/lib/admin-auth";
import { cacheAdminSales } from "@/lib/cache";

export const dynamic = "force-dynamic";

export async function GET() {
  const authCheck = await checkAdminAuth();
  if (!authCheck.authorized) {
    return apiError(authCheck.error, authCheck.status);
  }

  try {
    const sales = await cacheAdminSales(async () => {
      const now = new Date();
      const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
      const thisMonth = new Date(now.getFullYear(), now.getMonth(), 1);
      const lastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);

      const [totalStats] = await drizzleDb
        .select({
          totalRevenue: sql<number>`coalesce(sum(${orders.totalAmount}), 0)`,
          totalOrders: count(),
        })
        .from(orders)
        .where(ne(orders.status, "CANCELLED"));

      const [todayStats] = await drizzleDb
        .select({
          revenue: sql<number>`coalesce(sum(${orders.totalAmount}), 0)`,
          orderCount: count(),
        })
        .from(orders)
        .where(
          and(gte(orders.createdAt, today), ne(orders.status, "CANCELLED")),
        );

      const [monthStats] = await drizzleDb
        .select({
          revenue: sql<number>`coalesce(sum(${orders.totalAmount}), 0)`,
          orderCount: count(),
        })
        .from(orders)
        .where(
          and(gte(orders.createdAt, thisMonth), ne(orders.status, "CANCELLED")),
        );

      const [lastMonthStats] = await drizzleDb
        .select({
          revenue: sql<number>`coalesce(sum(${orders.totalAmount}), 0)`,
          orderCount: count(),
        })
        .from(orders)
        .where(
          and(
            gte(orders.createdAt, lastMonth),
            lt(orders.createdAt, thisMonth),
            ne(orders.status, "CANCELLED"),
          ),
        );

      const statusCounts = await drizzleDb
        .select({
          status: orders.status,
          count: count(),
        })
        .from(orders)
        .where(ne(orders.status, "CANCELLED"))
        .groupBy(orders.status);

      const topProducts = await drizzleDb
        .select({
          productId: orderItems.productId,
          productName: products.name,
          totalQuantity: sql<number>`cast(sum(${orderItems.quantity}) as int)`,
          totalRevenue: sql<number>`sum(${orderItems.price} * ${orderItems.quantity})`,
        })
        .from(orderItems)
        .innerJoin(products, eq(orderItems.productId, products.id))
        .innerJoin(orders, eq(orderItems.orderId, orders.id))
        .where(ne(orders.status, "CANCELLED"))
        .groupBy(orderItems.productId, products.name)
        .orderBy(sql`sum(${orderItems.quantity}) desc`)
        .limit(5);

      const [customerCount] = await drizzleDb
        .select({ count: count() })
        .from(users)
        .where(eq(users.role, "CUSTOMER"));

      return {
        totalRevenue: Number(totalStats.totalRevenue),
        totalOrders: totalStats.totalOrders,
        todayRevenue: Number(todayStats.revenue),
        todayOrders: todayStats.orderCount,
        monthRevenue: Number(monthStats.revenue),
        monthOrders: monthStats.orderCount,
        lastMonthRevenue: Number(lastMonthStats.revenue),
        lastMonthOrders: lastMonthStats.orderCount,
        ordersByStatus: statusCounts.reduce(
          (acc, s) => {
            acc[s.status] = s.count;
            return acc;
          },
          {} as Record<string, number>,
        ),
        topProducts: topProducts.map((p) => ({
          productId: p.productId,
          name: p.productName,
          totalQuantity: p.totalQuantity,
          totalRevenue: Number(p.totalRevenue),
        })),
        totalCustomers: customerCount.count,
      };
    });

    return apiSuccess({ sales });
  } catch (error) {
    return handleApiError(error);
  }
}
