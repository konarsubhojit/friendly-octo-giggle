import { NextRequest } from "next/server";
import { z } from "zod";
import { searchProducts, searchOrders, isSearchAvailable } from "@/lib/search";
import { apiSuccess, apiError, handleApiError } from "@/lib/api-utils";
import { auth } from "@/lib/auth";

const SearchQuerySchema = z.object({
  q: z.string().min(1).max(200),
  type: z.enum(["products", "orders"]).default("products"),
  category: z.string().optional(),
  status: z.string().optional(),
  limit: z.coerce.number().int().min(1).max(50).default(20),
});

/**
 * GET /api/search?q=cotton+shirt&type=products&category=Clothing&limit=10
 *
 * Full-text search powered by Upstash Search.
 * - `type=products` is public
 * - `type=orders` requires admin authentication
 */
export async function GET(request: NextRequest) {
  if (!isSearchAvailable()) {
    return apiError("Search is not configured", 503);
  }

  try {
    const { searchParams } = new URL(request.url);
    const params = Object.fromEntries(searchParams.entries());

    const parseResult = SearchQuerySchema.safeParse(params);
    if (!parseResult.success) {
      return apiError("Invalid search parameters", 400, {
        issues: parseResult.error.issues,
      });
    }

    const { q, type, category, status, limit } = parseResult.data;

    if (type === "orders") {
      const session = await auth();
      if (!session?.user) {
        return apiError("Authentication required", 401);
      }
      if (session.user.role !== "ADMIN") {
        return apiError("Admin access required", 403);
      }

      const results = await searchOrders(q, { limit, status });
      return apiSuccess({ results, query: q, type });
    }

    const results = await searchProducts(q, { limit, category });

    const response = apiSuccess({ results, query: q, type });
    response.headers.set(
      "Cache-Control",
      "public, s-maxage=30, stale-while-revalidate=60",
    );
    return response;
  } catch (error) {
    return handleApiError(error);
  }
}
