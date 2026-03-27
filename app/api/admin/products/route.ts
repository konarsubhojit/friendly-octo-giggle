import { NextRequest } from "next/server";
import { drizzleDb, db } from "@/lib/db";
import { products } from "@/lib/schema";
import { desc, lt, ilike, and, isNull, inArray, SQL, count } from "drizzle-orm";
import { ProductInputSchema } from "@/lib/validations";
import {
  apiSuccess,
  apiError,
  handleApiError,
  parseOffsetParam,
} from "@/lib/api-utils";
import { revalidateTag } from "next/cache";
import { invalidateProductCaches } from "@/lib/cache";
import { indexProduct } from "@/lib/search";
import { searchProductIds } from "@/lib/search-service";
import { checkAdminAuth } from "@/lib/admin-auth";

export const dynamic = "force-dynamic";

const PAGE_SIZE = 20;

type SearchFilterResult =
  | { type: "conditions"; condition: SQL }
  | { type: "empty" };

async function resolveSearchFilter(
  search: string,
  limit: number,
): Promise<SearchFilterResult | null> {
  if (!search) return null;
  const matchedIds = await searchProductIds(search, { limit: limit * 5 });
  if (matchedIds === null) {
    return { type: "conditions", condition: ilike(products.name, `%${search}%`) };
  }
  if (matchedIds.length === 0) {
    return { type: "empty" };
  }
  return { type: "conditions", condition: inArray(products.id, matchedIds) };
}

function applyCursorFilter(
  conditions: SQL[],
  cursor: string | null,
  useOffset: boolean,
): void {
  if (useOffset || !cursor) return;
  const cursorDate = new Date(cursor);
  if (!Number.isNaN(cursorDate.getTime())) {
    conditions.push(lt(products.createdAt, cursorDate));
  }
}

function toWhereClause(conditions: SQL[]): SQL {
  return conditions.length === 1 ? conditions[0]! : and(...conditions)!;
}

/**
 * GET /api/admin/products
 * Supports cursor-based pagination + search.
 * Query params:
 *   cursor   — ISO timestamp of the last item (for next page)
 *   limit    — page size (default 20, max 100)
 *   search   — text filter (matches product name)
 */
export const GET = async (request: NextRequest) => {
  const authCheck = await checkAdminAuth();
  if (!authCheck.authorized) {
    return apiError(authCheck.error ?? "Unknown error", authCheck.status);
  }

  try {
    const { searchParams } = new URL(request.url);
    const cursor = searchParams.get("cursor");
    const limitParam = searchParams.get("limit");
    const offsetParam = searchParams.get("offset");
    const useOffset = offsetParam !== null;
    const search = searchParams.get("search")?.trim() ?? "";

    const limit = Math.min(
      Math.max(
        1,
        Number.parseInt(limitParam ?? String(PAGE_SIZE), 10) || PAGE_SIZE,
      ),
      100,
    );

    const offset = useOffset ? parseOffsetParam(offsetParam) : 0;

    const conditions: SQL[] = [isNull(products.deletedAt)];
    const countConditions: SQL[] = [isNull(products.deletedAt)];

    applyCursorFilter(conditions, cursor, useOffset);

    const searchFilter = await resolveSearchFilter(search, limit);
    if (searchFilter?.type === "empty") {
      return apiSuccess({
        products: [],
        nextCursor: null,
        hasMore: false,
        totalCount: 0,
      });
    }
    if (searchFilter?.type === "conditions") {
      conditions.push(searchFilter.condition);
      countConditions.push(searchFilter.condition);
    }

    const whereClause = toWhereClause(conditions);
    const countWhereClause = toWhereClause(countConditions);

    const [rows, totalRows] = await Promise.all([
      drizzleDb.query.products.findMany({
        where: whereClause,
        orderBy: [desc(products.createdAt)],
        limit: limit + 1,
        offset: useOffset ? offset : undefined,
        with: { variations: true },
      }),
      drizzleDb
        .select({ value: count() })
        .from(products)
        .where(countWhereClause),
    ]);

    const hasMore = rows.length > limit;
    const pageItems = hasMore ? rows.slice(0, limit) : rows;
    const nextCursor = hasMore
      ? pageItems.at(-1)!.createdAt.toISOString()
      : null;
    const totalCount = Number(totalRows[0]?.value ?? 0);

    const serialized = pageItems.map((p) => ({
      ...p,
      deletedAt: null,
      createdAt: p.createdAt.toISOString(),
      updatedAt: p.updatedAt.toISOString(),
      variations: p.variations.map((v) => ({
        ...v,
        image: v.image ?? null,
        images: v.images ?? [],
        createdAt: v.createdAt.toISOString(),
        updatedAt: v.updatedAt.toISOString(),
      })),
    }));

    return apiSuccess({
      products: serialized,
      nextCursor,
      hasMore,
      totalCount,
    });
  } catch (error) {
    return handleApiError(error);
  }
};

export const POST = async (request: NextRequest) => {
  const authCheck = await checkAdminAuth();
  if (!authCheck.authorized) {
    return apiError(authCheck.error ?? "Unauthorized", authCheck.status);
  }

  try {
    const body = await request.json();

    const validated = ProductInputSchema.parse(body);

    const product = await db.products.create(validated);

    revalidateTag("products", {});

    await invalidateProductCaches();

    void indexProduct(product);

    return apiSuccess({ product }, 201);
  } catch (error) {
    return handleApiError(error);
  }
};
