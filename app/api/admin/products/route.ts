import { NextRequest } from "next/server";
import { drizzleDb } from "@/lib/db";
import { products } from "@/lib/schema";
import { desc, lt, ilike, and, isNull, SQL } from "drizzle-orm";
import { db } from "@/lib/db";
import { ProductInputSchema } from "@/lib/validations";
import { apiSuccess, apiError, handleApiError } from "@/lib/api-utils";
import { auth } from "@/lib/auth";
import { revalidateTag } from "next/cache";
import { invalidateProductCaches } from "@/lib/cache";
import { indexProduct } from "@/lib/search";

export const dynamic = "force-dynamic";

const PAGE_SIZE = 20;

const checkAdminAuth = async () => {
  const session = await auth();

  if (!session?.user) {
    return {
      authorized: false,
      error: "Not authenticated",
      status: 401 as const,
    };
  }

  if (session.user.role !== "ADMIN") {
    return {
      authorized: false,
      error: "Not authorized - Admin access required",
      status: 403 as const,
    };
  }

  return { authorized: true };
};

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
    const search = searchParams.get("search")?.trim() ?? "";

    const limit = Math.min(
      Math.max(1, parseInt(limitParam ?? String(PAGE_SIZE), 10) || PAGE_SIZE),
      100,
    );

    // Build Drizzle where conditions
    const conditions: SQL[] = [isNull(products.deletedAt)];

    if (cursor) {
      const cursorDate = new Date(cursor);
      if (!isNaN(cursorDate.getTime())) {
        conditions.push(lt(products.createdAt, cursorDate));
      }
    }

    if (search) {
      const pattern = `%${search}%`;
      conditions.push(ilike(products.name, pattern));
    }

    const whereClause =
      conditions.length === 1 ? conditions[0] : and(...conditions);

    const rows = await drizzleDb.query.products.findMany({
      where: whereClause as SQL | undefined,
      orderBy: [desc(products.createdAt)],
      limit: limit + 1,
      with: { variations: true },
    });

    const hasMore = rows.length > limit;
    const pageItems = hasMore ? rows.slice(0, limit) : rows;
    const nextCursor = hasMore
      ? pageItems[pageItems.length - 1].createdAt.toISOString()
      : null;

    const serialized = pageItems.map((p) => ({
      ...p,
      deletedAt: null,
      createdAt: p.createdAt.toISOString(),
      updatedAt: p.updatedAt.toISOString(),
      variations: p.variations.map((v) => ({
        ...v,
        image: v.image ?? null,
        images: (v.images as string[]) ?? [],
        createdAt: v.createdAt.toISOString(),
        updatedAt: v.updatedAt.toISOString(),
      })),
    }));

    return apiSuccess({ products: serialized, nextCursor, hasMore });
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

    // Validate input with Zod
    const validated = ProductInputSchema.parse(body);

    // Cache invalidation is handled automatically in db.products.create
    const product = await db.products.create(validated);

    // Revalidate Next.js cache tags (with empty config for immediate revalidation)
    revalidateTag("products", {});

    // Invalidate Redis caches (public + admin)
    await invalidateProductCaches();

    // Index in Upstash Search (fire-and-forget)
    void indexProduct(product);

    return apiSuccess({ product }, 201);
  } catch (error) {
    return handleApiError(error);
  }
};
