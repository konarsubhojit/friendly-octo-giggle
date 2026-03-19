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

    const conditions: SQL[] = [];

    if (cursor) {
      const cursorDate = new Date(cursor);
      if (!isNaN(cursorDate.getTime())) {
        conditions.push(lt(users.createdAt, cursorDate));
      }
    }

    if (search) {
      const pattern = `%${search}%`;
      conditions.push(
        or(ilike(users.name, pattern), ilike(users.email, pattern)) as SQL,
      );
    }

    const whereClause =
      conditions.length === 0
        ? undefined
        : conditions.length === 1
          ? conditions[0]
          : and(...conditions);

    const rows = await drizzleDb.query.users.findMany({
      where: whereClause,
      orderBy: [desc(users.createdAt)],
      limit: limit + 1,
      with: { orders: { columns: { id: true } } },
    });

    const hasMore = rows.length > limit;
    const pageItems = hasMore ? rows.slice(0, limit) : rows;
    const nextCursor = hasMore
      ? pageItems[pageItems.length - 1].createdAt.toISOString()
      : null;

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
