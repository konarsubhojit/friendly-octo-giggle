import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { ProductUpdateSchema } from "@/lib/validations";
import { apiSuccess, apiError, handleApiError } from "@/lib/api-utils";
import { checkAdminAuth } from "@/lib/admin-auth";
import { revalidateTag } from "next/cache";
import { invalidateProductCaches } from "@/lib/cache";
import { indexProduct, removeProduct } from "@/lib/search";

export const dynamic = "force-dynamic";

export const PUT = async (
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) => {
  const authCheck = await checkAdminAuth();
  if (!authCheck.authorized) {
    return apiError(authCheck.error, authCheck.status);
  }

  try {
    const { id } = await params;
    const body = await request.json();

    const validated = ProductUpdateSchema.parse(body);

    // Cache invalidation is handled automatically in db.products.update
    const product = await db.products.update(id, validated);

    if (!product) {
      return apiError("Product not found", 404);
    }

    // Revalidate Next.js cache tags (with empty config for immediate revalidation)
    revalidateTag("products", {});

    // Invalidate Redis caches (public + admin)
    await invalidateProductCaches(id);

    // Update search index (fire-and-forget)
    void indexProduct(product);

    return apiSuccess({ product });
  } catch (error) {
    return handleApiError(error);
  }
};

export const DELETE = async (
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) => {
  const authCheck = await checkAdminAuth();
  if (!authCheck.authorized) {
    return apiError(authCheck.error, authCheck.status);
  }

  try {
    const { id } = await params;

    // Cache invalidation is handled automatically in db.products.delete
    const deleted = await db.products.delete(id);

    if (!deleted) {
      return apiError("Product not found", 404);
    }

    // Revalidate Next.js cache tags (with empty config for immediate revalidation)
    revalidateTag("products", {});

    // Invalidate Redis caches (public + admin)
    await invalidateProductCaches(id);

    // Remove from search index (fire-and-forget)
    void removeProduct(id);

    return apiSuccess({ message: "Product deleted", id });
  } catch (error) {
    return handleApiError(error);
  }
};
