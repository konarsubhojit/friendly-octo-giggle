import { apiSuccess, apiError, handleApiError } from "@/lib/api-utils";
import { auth } from "@/lib/auth";
import { drizzleDb } from "@/lib/db";
import { products } from "@/lib/schema";
import { isNull } from "drizzle-orm";
import { isSearchAvailable, resetIndex, indexProducts } from "@/lib/search";

/**
 * POST /api/admin/search/reindex
 *
 * Full reindex of products into Upstash Search.
 */
export async function POST(_request: Request) {
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

    return apiSuccess({ reindexed: { products: allProducts.length } });
  } catch (error) {
    return handleApiError(error);
  }
}
