import { NextRequest } from "next/server";
import { drizzleDb } from "@/lib/db";
import { products, productVariations } from "@/lib/schema";
import { eq, and, isNull, ne } from "drizzle-orm";
import { UpdateVariationSchema } from "@/lib/validations";
import {
  apiSuccess,
  apiError,
  handleApiError,
  handleValidationError,
} from "@/lib/api-utils";
import { auth } from "@/lib/auth";
import { invalidateProductCaches } from "@/lib/cache";
import { revalidateTag } from "next/cache";

export const dynamic = "force-dynamic";

async function checkAdminAuth() {
  const session = await auth();
  if (!session?.user) {
    return {
      authorized: false,
      error: "Authentication required",
      status: 401 as const,
    };
  }
  if (session.user.role !== "ADMIN") {
    return {
      authorized: false,
      error: "Admin access required",
      status: 403 as const,
    };
  }
  return { authorized: true };
}

async function findProduct(productId: string) {
  return drizzleDb.query.products.findFirst({
    where: and(eq(products.id, productId), isNull(products.deletedAt)),
  });
}

async function findVariation(variationId: string, productId: string) {
  return drizzleDb.query.productVariations.findFirst({
    where: and(
      eq(productVariations.id, variationId),
      eq(productVariations.productId, productId),
      isNull(productVariations.deletedAt),
    ),
  });
}

/**
 * PUT /api/admin/products/[id]/variations/[variationId]
 * Update an existing variation
 */
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; variationId: string }> },
) {
  const authCheck = await checkAdminAuth();
  if (!authCheck.authorized) {
    return apiError(authCheck.error!, authCheck.status);
  }

  try {
    const { id, variationId } = await params;
    const product = await findProduct(id);
    if (!product) {
      return apiError("Product not found", 404);
    }

    const existing = await findVariation(variationId, id);
    if (!existing) {
      return apiError("Variation not found", 404);
    }

    const body = await request.json();
    const parseResult = UpdateVariationSchema.safeParse(body);
    if (!parseResult.success) {
      return handleValidationError(parseResult.error);
    }
    const validated = parseResult.data;

    // Check if there are any actual fields to update
    if (Object.keys(validated).length === 0) {
      return apiError("No fields to update", 400);
    }

    // Effective price check if priceModifier changed
    if (validated.priceModifier !== undefined) {
      const effectivePrice = product.price + validated.priceModifier;
      if (effectivePrice <= 0) {
        return apiError(
          "Effective price (base + modifier) must be greater than zero",
          400,
        );
      }
    }

    // Name uniqueness check if name changed
    if (validated.name !== undefined && validated.name !== existing.name) {
      const duplicateName = await drizzleDb.query.productVariations.findFirst({
        where: and(
          eq(productVariations.productId, id),
          eq(productVariations.name, validated.name),
          ne(productVariations.id, variationId),
        ),
      });
      if (duplicateName) {
        if (duplicateName.deletedAt) {
          return apiError(
            "A variation with this name was previously archived. Please use a different name.",
            409,
          );
        }
        return apiError(
          "A variation with this name already exists for this product",
          409,
        );
      }
    }

    // Update
    const [updated] = await drizzleDb
      .update(productVariations)
      .set({
        ...validated,
        updatedAt: new Date(),
      })
      .where(eq(productVariations.id, variationId))
      .returning();

    // Invalidate caches
    revalidateTag("products", {});
    await invalidateProductCaches(id);

    return apiSuccess({
      variation: {
        ...updated,
        image: updated.image ?? null,
        images: updated.images ?? [],
        deletedAt: null,
        createdAt: updated.createdAt.toISOString(),
        updatedAt: updated.updatedAt.toISOString(),
      },
    });
  } catch (error) {
    return handleApiError(error);
  }
}

/**
 * DELETE /api/admin/products/[id]/variations/[variationId]
 * Soft-delete a variation
 */
export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string; variationId: string }> },
) {
  const authCheck = await checkAdminAuth();
  if (!authCheck.authorized) {
    return apiError(authCheck.error!, authCheck.status);
  }

  try {
    const { id, variationId } = await params;
    const product = await findProduct(id);
    if (!product) {
      return apiError("Product not found", 404);
    }

    const existing = await findVariation(variationId, id);
    if (!existing) {
      return apiError("Variation not found", 404);
    }

    // Soft-delete
    await drizzleDb
      .update(productVariations)
      .set({ deletedAt: new Date(), updatedAt: new Date() })
      .where(eq(productVariations.id, variationId));

    // Invalidate caches
    revalidateTag("products", {});
    await invalidateProductCaches(id);

    return apiSuccess({
      message: "Variation soft-deleted successfully",
      id: variationId,
    });
  } catch (error) {
    return handleApiError(error);
  }
}
