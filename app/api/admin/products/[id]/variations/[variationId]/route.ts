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
import { checkAdminAuth } from "@/lib/admin-auth";
import { invalidateProductCaches } from "@/lib/cache";
import { revalidateTag } from "next/cache";

export const dynamic = "force-dynamic";

const findProduct = (productId: string) =>
  drizzleDb.query.products.findFirst({
    where: and(eq(products.id, productId), isNull(products.deletedAt)),
  });

const findVariation = (variationId: string, productId: string) =>
  drizzleDb.query.productVariations.findFirst({
    where: and(
      eq(productVariations.id, variationId),
      eq(productVariations.productId, productId),
      isNull(productVariations.deletedAt),
    ),
  });

const checkVariationNameUniqueness = async (
  productId: string,
  name: string,
  variationId: string,
  existingName: string,
): Promise<{ error: string; status: 409 } | null> => {
  if (name === existingName) return null;
  const duplicate = await drizzleDb.query.productVariations.findFirst({
    where: and(
      eq(productVariations.productId, productId),
      eq(productVariations.name, name),
      ne(productVariations.id, variationId),
    ),
  });
  if (!duplicate) return null;
  if (duplicate.deletedAt) {
    return {
      error: "A variation with this name was previously archived. Please use a different name.",
      status: 409,
    };
  }
  return {
    error: "A variation with this name already exists for this product",
    status: 409,
  };
};

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

    if (Object.keys(validated).length === 0) {
      return apiError("No fields to update", 400);
    }

    if (validated.priceModifier !== undefined) {
      const effectivePrice = product.price + validated.priceModifier;
      if (effectivePrice <= 0) {
        return apiError(
          "Effective price (base + modifier) must be greater than zero",
          400,
        );
      }
    }

    if (validated.name !== undefined) {
      const nameError = await checkVariationNameUniqueness(id, validated.name, variationId, existing.name);
      if (nameError) return apiError(nameError.error, nameError.status);
    }

    const [updated] = await drizzleDb
      .update(productVariations)
      .set({
        ...validated,
        updatedAt: new Date(),
      })
      .where(eq(productVariations.id, variationId))
      .returning();

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
