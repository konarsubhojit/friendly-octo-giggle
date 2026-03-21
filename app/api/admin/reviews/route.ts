import { NextRequest } from "next/server";
import { drizzleDb } from "@/lib/db";
import { reviews } from "@/lib/schema";
import { desc, eq, and, SQL } from "drizzle-orm";
import { apiSuccess, apiError, handleApiError } from "@/lib/api-utils";
import { checkAdminAuth } from "@/lib/admin-auth";

export const dynamic = "force-dynamic";

export const GET = async (request: NextRequest) => {
  const authCheck = await checkAdminAuth();
  if (!authCheck.authorized) {
    return apiError(authCheck.error ?? "Unauthorized", authCheck.status);
  }

  try {
    const { searchParams } = new URL(request.url);
    const productId = searchParams.get("productId");
    const ratingStr = searchParams.get("rating");

    const conditions: SQL[] = [];
    if (productId) {
      conditions.push(eq(reviews.productId, productId));
    }
    if (ratingStr) {
      const rating = Number.parseInt(ratingStr, 10);
      if (!Number.isNaN(rating) && rating >= 1 && rating <= 5) {
        conditions.push(eq(reviews.rating, rating));
      }
    }

    const singleOrCombined =
      conditions.length === 1 ? conditions[0] : and(...conditions);
    const whereClause = conditions.length === 0 ? undefined : singleOrCombined;

    const allReviews = await drizzleDb.query.reviews.findMany({
      where: whereClause,
      orderBy: [desc(reviews.createdAt)],
      with: {
        user: { columns: { id: true, name: true, email: true, image: true } },
        product: { columns: { id: true, name: true, image: true } },
      },
    });

    const serialized = allReviews.map((r) => ({
      ...r,
      createdAt: r.createdAt.toISOString(),
      updatedAt: r.updatedAt.toISOString(),
    }));

    return apiSuccess({ reviews: serialized, total: serialized.length });
  } catch (error) {
    return handleApiError(error);
  }
};
