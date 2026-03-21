import { NextRequest } from "next/server";
import { drizzleDb } from "@/lib/db";
import { reviews } from "@/lib/schema";
import { eq, desc, and } from "drizzle-orm";
import {
  apiSuccess,
  apiError,
  handleApiError,
  handleValidationError,
} from "@/lib/api-utils";
import { auth } from "@/lib/auth";
import { CreateReviewSchema } from "@/lib/validations";
import { withLogging } from "@/lib/api-middleware";

export const dynamic = "force-dynamic";

const handleGet = async (request: NextRequest) => {
  const { searchParams } = new URL(request.url);
  const productId = searchParams.get("productId");

  if (!productId) {
    return apiError("productId query parameter is required", 400);
  }

  try {
    const productReviews = await drizzleDb.query.reviews.findMany({
      where: eq(reviews.productId, productId),
      orderBy: [desc(reviews.createdAt)],
      with: { user: { columns: { name: true, image: true } } },
    });

    const serialized = productReviews.map((r) => ({
      ...r,
      createdAt: r.createdAt.toISOString(),
      updatedAt: r.updatedAt.toISOString(),
      user: r.isAnonymous ? null : r.user,
    }));

    return apiSuccess({ reviews: serialized });
  } catch (error) {
    return handleApiError(error);
  }
};

const handlePost = async (request: NextRequest) => {
  const session = await auth();
  if (!session?.user) {
    return apiError("Authentication required to submit a review", 401);
  }

  try {
    const body = await request.json();
    const parseResult = CreateReviewSchema.safeParse(body);
    if (!parseResult.success) {
      return handleValidationError(parseResult.error);
    }

    const { productId, orderId, rating, comment, isAnonymous } =
      parseResult.data;

    const existing = await drizzleDb.query.reviews.findFirst({
      where: and(
        eq(reviews.userId, session.user.id),
        eq(reviews.productId, productId),
      ),
    });

    if (existing) {
      return apiError("You have already reviewed this product", 409);
    }

    const [review] = await drizzleDb
      .insert(reviews)
      .values({
        productId,
        orderId: orderId ?? null,
        userId: session.user.id,
        rating,
        comment,
        isAnonymous: isAnonymous ?? false,
        updatedAt: new Date(),
      })
      .returning();

    return apiSuccess(
      {
        review: {
          ...review,
          createdAt: review.createdAt.toISOString(),
          updatedAt: review.updatedAt.toISOString(),
        },
      },
      201,
    );
  } catch (error) {
    const dbError = error as Error & { code?: unknown; constraint?: unknown };
    const isUniqueViolation =
      error instanceof Error &&
      ("code" in error || "constraint" in error) &&
      (String(dbError.code) === "23505" ||
        String(
          typeof dbError.constraint === "string" ? dbError.constraint : "",
        ).includes("userId_productId"));
    if (isUniqueViolation) {
      return apiError("You have already reviewed this product", 409);
    }
    return handleApiError(error);
  }
};

export const GET = withLogging(handleGet);
export const POST = withLogging(handlePost);
