import { NextRequest } from "next/server";
import { drizzleDb } from "@/lib/db";
import { orders } from "@/lib/schema";
import { desc, lt, ilike, or, and, eq, inArray, SQL } from "drizzle-orm";
import { apiSuccess, apiError, handleApiError } from "@/lib/api-utils";
import { checkAdminAuth } from "@/lib/admin-auth";
import { serializeOrders } from "@/lib/serializers";
import { OrderStatus } from "@/lib/types";
import { searchOrderIds } from "@/lib/search-service";

export const dynamic = "force-dynamic";

const PAGE_SIZE = 20;

const parseLimit = (limitParam: string | null): number =>
  Math.min(
    Math.max(1, Number.parseInt(limitParam ?? String(PAGE_SIZE), 10) || PAGE_SIZE),
    100,
  );

const buildCursorCondition = (cursor: string | null): SQL | null => {
  if (!cursor) return null;
  const cursorDate = new Date(cursor);
  return Number.isNaN(cursorDate.getTime()) ? null : lt(orders.createdAt, cursorDate);
};

const buildStatusCondition = (
  statusFilter: string,
): { condition: SQL | null; error: string | null } => {
  if (!statusFilter || statusFilter === "ALL") return { condition: null, error: null };
  const VALID_STATUSES = Object.values(OrderStatus) as string[];
  if (!VALID_STATUSES.includes(statusFilter)) {
    return {
      condition: null,
      error: `Invalid status filter. Must be one of: ${VALID_STATUSES.join(", ")}`,
    };
  }
  return {
    condition: eq(
      orders.status,
      statusFilter as "PENDING" | "PROCESSING" | "SHIPPED" | "DELIVERED" | "CANCELLED",
    ),
    error: null,
  };
};

const buildSearchCondition = async (
  search: string,
  limit: number,
  statusFilter: string,
): Promise<{ condition: SQL | null; empty: boolean }> => {
  const matchedIds = await searchOrderIds(search, {
    limit: limit * 5,
    status: statusFilter && statusFilter !== "ALL" ? statusFilter : undefined,
  });
  if (matchedIds === null) {
    const pattern = `%${search}%`;
    return {
      condition: or(
        ilike(orders.customerName, pattern),
        ilike(orders.customerEmail, pattern),
        ilike(orders.id, pattern),
      ) as SQL,
      empty: false,
    };
  }
  if (matchedIds.length === 0) return { condition: null, empty: true };
  return { condition: inArray(orders.id, matchedIds), empty: false };
};

const resolveWhereClause = (conditions: SQL[]): SQL | undefined => {
  if (conditions.length === 0) return undefined;
  if (conditions.length === 1) return conditions[0];
  return and(...conditions);
};

export const GET = async (request: NextRequest) => {
  const authCheck = await checkAdminAuth();
  if (!authCheck.authorized) {
    return apiError(authCheck.error ?? "Unknown error", authCheck.status);
  }

  try {
    const { searchParams } = new URL(request.url);
    const cursor = searchParams.get("cursor");
    const search = searchParams.get("search")?.trim() ?? "";
    const statusFilter = searchParams.get("status") ?? "";
    const limit = parseLimit(searchParams.get("limit"));

    const conditions: SQL[] = [];

    const cursorCond = buildCursorCondition(cursor);
    if (cursorCond) conditions.push(cursorCond);

    const { condition: statusCond, error: statusError } = buildStatusCondition(statusFilter);
    if (statusError) return apiError(statusError, 400);
    if (statusCond) conditions.push(statusCond);

    if (search) {
      const { condition: searchCond, empty } = await buildSearchCondition(search, limit, statusFilter);
      if (empty) return apiSuccess({ orders: [], nextCursor: null, hasMore: false });
      if (searchCond) conditions.push(searchCond);
    }

    const rows = await drizzleDb.query.orders.findMany({
      where: resolveWhereClause(conditions) as SQL | undefined,
      orderBy: [desc(orders.createdAt)],
      limit: limit + 1,
      with: { items: { with: { product: true, variation: true } } },
    });

    const hasMore = rows.length > limit;
    const pageItems = hasMore ? rows.slice(0, limit) : rows;
    const nextCursor = hasMore
      ? pageItems.at(-1)!.createdAt.toISOString()
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
