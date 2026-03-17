import { NextRequest } from "next/server";
import { drizzleDb } from "@/lib/db";
import { reviews } from "@/lib/schema";
import { desc } from "drizzle-orm";
import { apiSuccess, apiError, handleApiError } from "@/lib/api-utils";
import { auth } from "@/lib/auth";

export const dynamic = "force-dynamic";

const checkAdminAuth = async () => {
  const session = await auth();
  if (!session?.user) {
    return { authorized: false, error: "Not authenticated", status: 401 as const };
  }
  if (session.user.role !== "ADMIN") {
    return { authorized: false, error: "Not authorized - Admin access required", status: 403 as const };
  }
  return { authorized: true };
};

// GET /api/admin/reviews  — returns all reviews with user + product info
export async function GET(request: NextRequest) {
  const authCheck = await checkAdminAuth();
  if (!authCheck.authorized) {
    return apiError(authCheck.error ?? "Unauthorized", authCheck.status);
  }

  try {
    const { searchParams } = new URL(request.url);
    const productId = searchParams.get("productId");
    const ratingStr = searchParams.get("rating");

    const allReviews = await drizzleDb.query.reviews.findMany({
      orderBy: [desc(reviews.createdAt)],
      with: {
        user: { columns: { id: true, name: true, email: true, image: true } },
        product: { columns: { id: true, name: true, image: true } },
      },
    });

    // Apply optional filters in memory (small dataset expected)
    let filtered = allReviews;
    if (productId) {
      filtered = filtered.filter((r) => r.productId === productId);
    }
    if (ratingStr) {
      const rating = parseInt(ratingStr, 10);
      if (!isNaN(rating)) {
        filtered = filtered.filter((r) => r.rating === rating);
      }
    }

    const serialized = filtered.map((r) => ({
      ...r,
      createdAt: r.createdAt.toISOString(),
      updatedAt: r.updatedAt.toISOString(),
      // Admin always sees the user info regardless of anonymous flag
    }));

    return apiSuccess({ reviews: serialized, total: serialized.length });
  } catch (error) {
    return handleApiError(error);
  }
}
