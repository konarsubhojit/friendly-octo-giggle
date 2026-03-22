import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { apiSuccess, handleApiError } from "@/lib/api-utils";
import { withLogging } from "@/lib/api-middleware";

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

    const products = await db.products.findAllMinimal({
      limit,
      offset,
      search,
      category,
      withCache: !search && !category && offset === 0,
    });

    const response = apiSuccess({ products });
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
