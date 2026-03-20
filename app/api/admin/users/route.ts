import { NextRequest } from "next/server";
import { drizzleDb } from "@/lib/db";
import { users } from "@/lib/schema";
import { desc, lt, ilike, and, or, SQL } from "drizzle-orm";
import { auth } from "@/lib/auth";
import { apiSuccess, apiError, handleApiError } from "@/lib/api-utils";

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

  return { authorized: true, userId: session.user.id };
};

const parseLimit = (param: string | null, defaultSize: number): number =>
  Math.min(
    Math.max(
      1,
      Number.parseInt(param ?? String(defaultSize), 10) || defaultSize,
    ),
    100,
  );

const buildWhereConditions = (cursor: string | null, search: string): SQL[] => {
  const conditions: SQL[] = [];

  if (cursor) {
    const cursorDate = new Date(cursor);
    if (!Number.isNaN(cursorDate.getTime())) {
      conditions.push(lt(users.createdAt, cursorDate));
    }
  }

  if (search) {
    const pattern = `%${search}%`;
    conditions.push(
      or(ilike(users.name, pattern), ilike(users.email, pattern)) as SQL,
    );
  }

  return conditions;
};

const resolveWhereClause = (conditions: SQL[]) => {
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
    const limit = parseLimit(searchParams.get("limit"), PAGE_SIZE);

    const conditions = buildWhereConditions(cursor, search);
    const whereClause = resolveWhereClause(conditions);

    const rows = await drizzleDb.query.users.findMany({
      where: whereClause,
      orderBy: [desc(users.createdAt)],
      limit: limit + 1,
      with: { orders: { columns: { id: true } } },
    });

    const hasMore = rows.length > limit;
    const pageItems = hasMore ? rows.slice(0, limit) : rows;
    const lastItem = pageItems.at(-1);
    const nextCursor =
      hasMore && lastItem ? lastItem.createdAt.toISOString() : null;

    const userList = pageItems.map((user) => ({
      id: user.id,
      name: user.name,
      email: user.email,
      role: user.role,
      emailVerified: user.emailVerified,
      createdAt:
        user.createdAt instanceof Date
          ? user.createdAt.toISOString()
          : user.createdAt,
      updatedAt:
        user.updatedAt instanceof Date
          ? user.updatedAt.toISOString()
          : user.updatedAt,
      image: user.image,
      _count: { orders: user.orders.length },
    }));

    return apiSuccess({ users: userList, nextCursor, hasMore });
  } catch (error) {
    return handleApiError(error);
  }
};
