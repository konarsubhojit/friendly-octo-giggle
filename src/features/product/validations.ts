import { z } from "zod";
import {
  SHORT_ID_REGEX,
  ORDER_ID_REGEX,
  URL_REGEX,
  ISO_DATETIME_REGEX,
} from "@/lib/validations/primitives";

// ─── Product Validation Schemas ───────────────────────────

// Note: ProductSchema with datetime strings is for API responses (already converted from Date).
// Use ProductInputSchema for validating user input.
export const ProductSchema = z.object({
  id: z.string().regex(SHORT_ID_REGEX, "Invalid product ID format"),
  name: z.string().min(1, "Name is required").max(200),
  description: z.string().min(1, "Description is required").max(2000),
  price: z.number().positive("Price must be positive"),
  image: z.string().regex(URL_REGEX, "Must be a valid URL"),
  images: z
    .array(z.string().regex(URL_REGEX, "Each image must be a valid URL"))
    .max(10, "Maximum 10 images allowed")
    .default([]),
  stock: z.number().int().nonnegative("Stock must be non-negative"),
  category: z.string().min(1, "Category is required").max(100),
  createdAt: z.string().regex(ISO_DATETIME_REGEX, "Invalid datetime format"),
  updatedAt: z.string().regex(ISO_DATETIME_REGEX, "Invalid datetime format"),
});

export const ProductInputSchema = ProductSchema.omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const ProductUpdateSchema = ProductInputSchema.partial();

export type ProductInput = z.infer<typeof ProductInputSchema>;
export type ProductUpdate = z.infer<typeof ProductUpdateSchema>;

// ─── Variation Validation Schemas ─────────────────────────

// Base schema fields shared between create and update variations.
const BaseVariationFields = {
  name: z
    .string()
    .min(1, "Name is required")
    .max(100, "Name must be under 100 characters"),
  designName: z
    .string()
    .min(1, "Design name is required")
    .max(100, "Design name must be under 100 characters"),
  variationType: z.enum(["styling", "colour"]).default("styling"),
  styleId: z.string().regex(SHORT_ID_REGEX, "Invalid style ID").nullish(),
  image: z.string().regex(URL_REGEX, "Must be a valid URL").nullish(),
  images: z
    .array(z.string().regex(URL_REGEX, "Each image must be a valid URL"))
    .max(10, "Maximum 10 images allowed")
    .default([]),
};

export const CreateVariationSchema = z
  .object({
    ...BaseVariationFields,
    price: z
      .number({ message: "Price is required" })
      .nonnegative("Price must be non-negative"),
    stock: z
      .number({ message: "Stock is required" })
      .int("Stock must be an integer")
      .nonnegative("Stock must be non-negative"),
  })
  .superRefine((data, ctx) => {
    if (data.variationType === "styling") {
      validateStylingVariation(data, ctx);
    }
    if (data.variationType === "colour" && data.price <= 0) {
      ctx.addIssue({
        code: "custom",
        path: ["price"],
        message: "Colour price must be greater than zero",
      });
    }
  });

// Validates that styling variations have zero price/stock and are not nested.
function validateStylingVariation(
  data: { price: number; stock: number; styleId?: string | null },
  ctx: z.RefinementCtx,
) {
  if (data.price !== 0) {
    ctx.addIssue({
      code: "custom",
      path: ["price"],
      message: "Styles are grouping-only; price must be 0",
    });
  }
  if (data.stock !== 0) {
    ctx.addIssue({
      code: "custom",
      path: ["stock"],
      message: "Styles are grouping-only; stock must be 0",
    });
  }
  if (data.styleId) {
    ctx.addIssue({
      code: "custom",
      path: ["styleId"],
      message: "Styles cannot be nested under another style",
    });
  }
}

export const UpdateVariationSchema = z
  .object({
    ...BaseVariationFields,
    price: z
      .number({ message: "Price is required" })
      .nonnegative("Price must be non-negative"),
    stock: z
      .number({ message: "Stock is required" })
      .int("Stock must be an integer")
      .nonnegative("Stock must be non-negative"),
  })
  .partial();

export type CreateVariationInput = z.infer<typeof CreateVariationSchema>;
export type UpdateVariationInput = z.infer<typeof UpdateVariationSchema>;

// ─── Review Validation Schemas ────────────────────────────

export const CreateReviewSchema = z.object({
  productId: z.string().regex(SHORT_ID_REGEX, "Invalid product ID"),
  orderId: z.string().regex(ORDER_ID_REGEX, "Invalid order ID").nullish(),
  rating: z
    .number()
    .int("Rating must be a whole number")
    .min(1, "Rating must be at least 1")
    .max(5, "Rating must be at most 5"),
  comment: z
    .string()
    .min(10, "Review must be at least 10 characters")
    .max(1000, "Review must be under 1000 characters"),
  isAnonymous: z.boolean().default(false),
});

export type CreateReviewInput = z.infer<typeof CreateReviewSchema>;

// ─── Share Validation Schemas ─────────────────────────────

export const CreateShareSchema = z.object({
  productId: z.string().regex(SHORT_ID_REGEX, "Invalid product ID"),
  variationId: z
    .string()
    .regex(SHORT_ID_REGEX, "Invalid variation ID")
    .nullish(),
});

export type CreateShareInput = z.infer<typeof CreateShareSchema>;
