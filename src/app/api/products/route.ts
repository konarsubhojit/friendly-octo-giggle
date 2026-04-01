import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { apiSuccess, handleApiError } from "@/lib/api-utils";
import { withLogging } from "@/lib/api-middleware";
import { cacheProductsList } from "@/lib/cache";
import { searchProductIds } from "@/lib/search-service";

const DEFAULT_LIMIT = 24;
const MAX_LIMIT = 100;

const parseProductLimit = (raw: string | null): number =>
  Math.min(
    Math.max(
      1,
      Number.parseInt(raw ?? String(DEFAULT_LIMIT), 10) || DEFAULT_LIMIT,
    ),
    MAX_LIMIT,
  );

async function handleGet(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const search = searchParams.get("q")?.trim();
    const category = searchParams.get("category")?.trim();
    const limit = parseProductLimit(searchParams.get("limit"));
    const offset = Math.max(
      0,
      Number.parseInt(searchParams.get("offset") ?? "0", 10) || 0,
    );
    const requestedWindow = offset + limit + 1;

    if (search) {
      const matchedIds = await searchProductIds(search, {
        limit: requestedWindow,
        category,
      });

      if (matchedIds !== null) {
        const pageIds = matchedIds.slice(offset, offset + limit);
        const matchedProducts = await db.products.findMinimalByIds(
          pageIds,
          category,
        );
        const productsById = new Map(
          matchedProducts.map((product) => [product.id, product]),
        );
        const products = pageIds.flatMap((id) => {
          const product = productsById.get(id);
          return product ? [product] : [];
        });

        const response = apiSuccess({
          products,
          hasMore: matchedIds.length > offset + limit,
        });
        response.headers.set(
          "Cache-Control",
          "s-maxage=60, stale-while-revalidate=120",
        );
        return response;
      }
    }

    const products = await cacheProductsList(
      () =>
        db.products.findAllMinimal({
          limit: limit + 1,
          offset,
          search,
          category,
        }),
      { limit: limit + 1, offset, search, category },
    );
    const hasMore = products.length > limit;

    const response = apiSuccess({
      products: products.slice(0, limit),
      hasMore,
    });
    response.headers.set(
      "Cache-Control",
      "s-maxage=60, stale-while-revalidate=120",
    );
    return response;
  } catch (error) {
    return handleApiError(error);
  }
}

export const GET = withLogging(handleGet);
