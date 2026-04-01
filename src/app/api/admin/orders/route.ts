import { NextRequest } from "next/server";
import { desc, lt, and, eq, inArray, SQL, count } from "drizzle-orm";
import { drizzleDb } from "@/lib/db";
import { orders } from "@/lib/schema";
import {
  apiSuccess,
  apiError,
  handleApiError,
  parseOffsetParam,
} from "@/lib/api-utils";
import { checkAdminAuth } from "@/features/admin/services/admin-auth";
import { searchOrderIds } from "@/features/orders/services/order-search";
import { serializeOrders } from "@/lib/serializers";
import { OrderStatus } from "@/lib/types";
import { cacheAdminOrdersList } from "@/lib/cache";

export const dynamic = "force-dynamic";

const PAGE_SIZE = 20;

const parseLimit = (limitParam: string | null): number =>
  Math.min(
    Math.max(
      1,
      Number.parseInt(limitParam ?? String(PAGE_SIZE), 10) || PAGE_SIZE,
    ),
    100,
  );

const buildCursorCondition = (cursor: string | null): SQL | null => {
  if (!cursor) return null;

  const cursorDate = new Date(cursor);
  return Number.isNaN(cursorDate.getTime())
    ? null
    : lt(orders.createdAt, cursorDate);
};

const buildStatusCondition = (
  statusFilter: string,
): {
  condition: SQL | null;
  error: string | null;
  status: OrderStatus | null;
} => {
  if (!statusFilter || statusFilter === "ALL") {
    return { condition: null, error: null, status: null };
  }

  const validStatuses = Object.values(OrderStatus) as string[];
  if (!validStatuses.includes(statusFilter)) {
    return {
      condition: null,
      error: `Invalid status filter. Must be one of: ${validStatuses.join(", ")}`,
      status: null,
    };
  }

  const status = statusFilter as OrderStatus;
  return {
    condition: eq(orders.status, status),
    error: null,
    status,
  };
};

const resolveWhereClause = (conditions: SQL[]): SQL | undefined => {
  if (conditions.length === 0) return undefined;
  if (conditions.length === 1) return conditions[0];
  return and(...conditions);
};

const getOrdersTotalCount = async (
  countConditions: SQL[],
  totalCountFromSearch: number | null,
): Promise<number> => {
  if (totalCountFromSearch !== null) {
    return totalCountFromSearch;
  }

  const countRows = await drizzleDb
    .select({ value: count() })
    .from(orders)
    .where(resolveWhereClause(countConditions));

  return Number(countRows[0]?.value ?? 0);
};

const applySearchFilter = async ({
  search,
  status,
  conditions,
}: {
  search: string;
  status: OrderStatus | null;
  conditions: SQL[];
}): Promise<{ totalCountFromSearch: number | null; empty: boolean }> => {
  if (!search) {
    return { totalCountFromSearch: null, empty: false };
  }

  const matchedIds = await searchOrderIds(search, {
    status: status ?? undefined,
    limit: 1000,
  });

  if (matchedIds?.length === 0) {
    return { totalCountFromSearch: 0, empty: true };
  }

  if (matchedIds && matchedIds.length > 0) {
    conditions.push(inArray(orders.id, matchedIds));
    return { totalCountFromSearch: matchedIds.length, empty: false };
  }

  return { totalCountFromSearch: null, empty: false };
};

export const GET = async (request: NextRequest) => {
  const authCheck = await checkAdminAuth();
  if (!authCheck.authorized) {
    return apiError(authCheck.error ?? "Unknown error", authCheck.status);
  }

  try {
    const { searchParams } = new URL(request.url);
    const cursor = searchParams.get("cursor");
    const offsetParam = searchParams.get("offset");
    const useOffset = offsetParam !== null;
    const offset = useOffset ? parseOffsetParam(offsetParam) : 0;
    const search = searchParams.get("search")?.trim() ?? "";
    const statusFilter = searchParams.get("status") ?? "";
    const limit = parseLimit(searchParams.get("limit"));

    const conditions: SQL[] = [];
    if (!useOffset) {
      const cursorCondition = buildCursorCondition(cursor);
      if (cursorCondition) {
        conditions.push(cursorCondition);
      }
    }

    const countConditions: SQL[] = [];
    const {
      condition: statusCondition,
      error: statusError,
      status,
    } = buildStatusCondition(statusFilter);
    if (statusError) {
      return apiError(statusError, 400);
    }
    if (statusCondition) {
      conditions.push(statusCondition);
      countConditions.push(statusCondition);
    }

    const { totalCountFromSearch, empty } = await applySearchFilter({
      search,
      status,
      conditions,
    });
    if (empty) {
      return apiSuccess({
        orders: [],
        nextCursor: null,
        hasMore: false,
        totalCount: 0,
      });
    }

    const fetcher = async () => {
      const rows = await drizzleDb.query.orders.findMany({
        where: resolveWhereClause(conditions),
        orderBy: [desc(orders.createdAt)],
        limit: limit + 1,
        offset: useOffset ? offset : undefined,
        with: { items: { with: { product: true, variation: true } } },
      });

      const hasMore = rows.length > limit;
      const pageItems = hasMore ? rows.slice(0, limit) : rows;
      const nextCursor = hasMore
        ? pageItems.at(-1)!.createdAt.toISOString()
        : null;

      return {
        orders: serializeOrders(pageItems),
        nextCursor,
        hasMore,
        totalCount: await getOrdersTotalCount(
          countConditions,
          totalCountFromSearch,
        ),
      };
    };

    const result = await cacheAdminOrdersList(fetcher, {
      search,
      status: statusFilter,
      cursor,
      offset,
      limit,
    });

    return apiSuccess(result);
  } catch (error) {
    return handleApiError(error);
  }
};
