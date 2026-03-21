import { NextRequest } from "next/server";
import { z } from "zod";
import { searchProducts, isSearchAvailable } from "@/lib/search";
import { apiSuccess, apiError, handleApiError } from "@/lib/api-utils";

const SearchQuerySchema = z.object({
  q: z.string().min(1).max(200),
  category: z.string().optional(),
  limit: z.coerce.number().int().min(1).max(50).default(20),
});

/**
 * GET /api/search?q=cotton+shirt&category=Clothing&limit=10
 *
 * Full-text search powered by Upstash Search (products only).
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

    const { q, category, limit } = parseResult.data;

    const results = await searchProducts(q, { limit, category });

    const response = apiSuccess({ results, query: q, type: "products" });
    response.headers.set(
      "Cache-Control",
      "public, s-maxage=30, stale-while-revalidate=60",
    );
    return response;
  } catch (error) {
    return handleApiError(error);
  }
}
