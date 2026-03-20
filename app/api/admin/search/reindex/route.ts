import { apiSuccess, apiError, handleApiError } from "@/lib/api-utils";
import { auth } from "@/lib/auth";
import { drizzleDb } from "@/lib/db";
import { products } from "@/lib/schema";
import { isNull } from "drizzle-orm";
import {
  isSearchAvailable,
  resetIndex,
  indexProducts,
  indexOrders,
} from "@/lib/search";

/**
 * POST /api/admin/search/reindex
 *
 * Full reindex of products and/or orders into Upstash Search.
 * Body: { "target": "products" | "orders" | "all" }
 */
export async function POST(request: Request) {
  const session = await auth();
  if (!session?.user) {
    return apiError("Not authenticated", 401);
  }
  if (session.user.role !== "ADMIN") {
    return apiError("Not authorized - Admin access required", 403);
  }

  if (!isSearchAvailable()) {
    return apiError("Search is not configured", 503);
  }

  try {
    const body = await request.json();
    const target = body.target ?? "all";

    if (!["products", "orders", "all"].includes(target)) {
      return apiError(
        "Invalid target. Must be 'products', 'orders', or 'all'",
        400,
      );
    }

    const results: Record<string, number> = {};

    if (target === "products" || target === "all") {
      await resetIndex("products");

      const allProducts = await drizzleDb.query.products.findMany({
        where: isNull(products.deletedAt),
      });

      await indexProducts(
        allProducts.map((p) => ({
          id: p.id,
          name: p.name,
          description: p.description,
          category: p.category,
          price: p.price,
          stock: p.stock,
          image: p.image,
        })),
      );

      results.products = allProducts.length;
    }

    if (target === "orders" || target === "all") {
      await resetIndex("orders");

      const allOrders = await drizzleDb.query.orders.findMany();

      await indexOrders(
        allOrders.map((o) => ({
          id: o.id,
          customerName: o.customerName,
          customerEmail: o.customerEmail,
          customerAddress: o.customerAddress,
          status: o.status,
          totalAmount: o.totalAmount,
          createdAt: o.createdAt.toISOString(),
        })),
      );

      results.orders = allOrders.length;
    }

    return apiSuccess({ reindexed: results });
  } catch (error) {
    return handleApiError(error);
  }
}
