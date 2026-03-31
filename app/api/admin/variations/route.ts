import { NextRequest } from "next/server";
import { drizzleDb } from "@/lib/db";
import { products, productVariations } from "@/lib/schema";
import { eq, and, isNull } from "drizzle-orm";
import { CreateVariationSchema } from "@/lib/validations";
import { z } from "zod";
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

const MAX_VARIATIONS_PER_PRODUCT = 25;

const CreateAdminVariationSchema = CreateVariationSchema.extend({
  productId: z.string().min(1, "Product id is required"),
});

const findProduct = (productId: string) =>
  drizzleDb.query.products.findFirst({
    where: and(eq(products.id, productId), isNull(products.deletedAt)),
  });

export async function POST(request: NextRequest) {
  const authCheck = await checkAdminAuth();
  if (!authCheck.authorized) {
    return apiError(authCheck.error ?? "Unauthorized", authCheck.status);
  }

  try {
    const body = await request.json();
    const parseResult = CreateAdminVariationSchema.safeParse(body);
    if (!parseResult.success) {
      return handleValidationError(parseResult.error);
    }

    const { productId, ...validated } = parseResult.data;
    const product = await findProduct(productId);
    if (!product) {
      return apiError("Product not found", 404);
    }

    if (validated.price <= 0) {
      return apiError("Variation price must be greater than zero", 400);
    }

    const activeCount = await drizzleDb.query.productVariations.findMany({
      where: and(
        eq(productVariations.productId, productId),
        isNull(productVariations.deletedAt),
      ),
      columns: { id: true },
    });
    if (activeCount.length >= MAX_VARIATIONS_PER_PRODUCT) {
      return apiError("Maximum of 25 variations per product reached", 400);
    }

    const existingByName = await drizzleDb.query.productVariations.findFirst({
      where: and(
        eq(productVariations.productId, productId),
        eq(productVariations.name, validated.name),
      ),
    });
    if (existingByName) {
      if (existingByName.deletedAt) {
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

    const [variation] = await drizzleDb
      .insert(productVariations)
      .values({
        productId,
        name: validated.name,
        designName: validated.designName,
        variationType: validated.variationType,
        price: validated.price,
        stock: validated.stock,
        image: validated.image ?? null,
        images: validated.images ?? [],
      })
      .returning();

    revalidateTag("products", {});
    await invalidateProductCaches(productId);

    return apiSuccess(
      {
        variation: {
          ...variation,
          image: variation.image ?? null,
          images: variation.images ?? [],
          deletedAt: null,
          createdAt: variation.createdAt.toISOString(),
          updatedAt: variation.updatedAt.toISOString(),
        },
      },
      201,
    );
  } catch (error) {
    return handleApiError(error);
  }
}
