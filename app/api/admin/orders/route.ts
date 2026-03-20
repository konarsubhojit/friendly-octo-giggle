import { NextRequest } from "next/server";
import { drizzleDb } from "@/lib/db";
import { orders } from "@/lib/schema";
import { desc, lt, ilike, or, and, eq, inArray, SQL } from "drizzle-orm";
import { apiSuccess, apiError, handleApiError } from "@/lib/api-utils";
import { auth } from "@/lib/auth";
import { serializeOrders } from "@/lib/serializers";
import { OrderStatus } from "@/lib/types";
import { searchOrderIds } from "@/lib/search-service";

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
 * GET /api/admin/orders
 * Supports cursor-based pagination + search.
 * Query params:
 *   cursor   — ISO timestamp of the last item (for next page)
 *   limit    — page size (default 20, max 100)
 *   search   — text filter (matches customer name, email, or order ID)
 *   status   — filter by order status
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
    const statusFilter = searchParams.get("status") ?? "";

    const limit = Math.min(
      Math.max(1, parseInt(limitParam ?? String(PAGE_SIZE), 10) || PAGE_SIZE),
      100,
    );

    // Build Drizzle where conditions
    const conditions: SQL[] = [];

    if (cursor) {
      const cursorDate = new Date(cursor);
      if (!isNaN(cursorDate.getTime())) {
        conditions.push(lt(orders.createdAt, cursorDate));
      }
    }

    const VALID_STATUSES = Object.values(OrderStatus) as string[];

    if (statusFilter && statusFilter !== "ALL") {
      if (!VALID_STATUSES.includes(statusFilter)) {
        return apiError(
          `Invalid status filter. Must be one of: ${VALID_STATUSES.join(", ")}`,
          400,
        );
      }
      conditions.push(
        eq(
          orders.status,
          statusFilter as
            | "PENDING"
            | "PROCESSING"
            | "SHIPPED"
            | "DELIVERED"
            | "CANCELLED",
        ),
      );
    }

    if (search) {
      const matchedIds = await searchOrderIds(search, {
        limit: limit * 5,
        status:
          statusFilter && statusFilter !== "ALL" ? statusFilter : undefined,
      });

      if (matchedIds === null) {
        const pattern = `%${search}%`;
        conditions.push(
          or(
            ilike(orders.customerName, pattern),
            ilike(orders.customerEmail, pattern),
            ilike(orders.id, pattern),
          ) as SQL,
        );
      } else if (matchedIds.length === 0) {
        return apiSuccess({ orders: [], nextCursor: null, hasMore: false });
      } else {
        conditions.push(inArray(orders.id, matchedIds));
      }
    }

    const whereClause =
      conditions.length === 0
        ? undefined
        : conditions.length === 1
          ? conditions[0]
          : and(...conditions);

    const rows = await drizzleDb.query.orders.findMany({
      where: whereClause as SQL | undefined,
      orderBy: [desc(orders.createdAt)],
      limit: limit + 1,
      with: { items: { with: { product: true, variation: true } } },
    });

    const hasMore = rows.length > limit;
    const pageItems = hasMore ? rows.slice(0, limit) : rows;
    const nextCursor = hasMore
      ? pageItems[pageItems.length - 1].createdAt.toISOString()
      : null;

    return apiSuccess({
      orders: serializeOrders(pageItems),
      nextCursor,
      hasMore,
    });
  } catch (error) {
    return handleApiError(error);
  }
};
