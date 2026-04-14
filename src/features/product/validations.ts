import { z } from 'zod'
import {
  SHORT_ID_REGEX,
  ORDER_ID_REGEX,
  URL_REGEX,
  ISO_DATETIME_REGEX,
} from '@/lib/validations/primitives'

// ─── Product Validation Schemas ───────────────────────────

// Note: ProductSchema with datetime strings is for API responses (already converted from Date).
// Use ProductInputSchema for validating user input.
export const ProductSchema = z.object({
  id: z.string().regex(SHORT_ID_REGEX, 'Invalid product ID format'),
  name: z.string().min(1, 'Name is required').max(200),
  description: z.string().min(1, 'Description is required').max(2000),
  image: z.string().regex(URL_REGEX, 'Must be a valid URL'),
  images: z
    .array(z.string().regex(URL_REGEX, 'Each image must be a valid URL'))
    .max(10, 'Maximum 10 images allowed')
    .default([]),
  category: z.string().min(1, 'Category is required').max(100),
  createdAt: z.string().regex(ISO_DATETIME_REGEX, 'Invalid datetime format'),
  updatedAt: z.string().regex(ISO_DATETIME_REGEX, 'Invalid datetime format'),
})

export const ProductInputSchema = ProductSchema.omit({
  id: true,
  createdAt: true,
  updatedAt: true,
})

export const ProductUpdateSchema = ProductInputSchema.partial()

export type ProductInput = z.infer<typeof ProductInputSchema>
export type ProductUpdate = z.infer<typeof ProductUpdateSchema>

// ─── Product Option Validation Schemas ────────────────────

export const CreateProductOptionSchema = z.object({
  name: z
    .string()
    .min(1, 'Option name is required')
    .max(100, 'Option name must be under 100 characters'),
  sortOrder: z.number().int().nonnegative().default(0),
})

export const CreateOptionValueSchema = z.object({
  value: z
    .string()
    .min(1, 'Option value is required')
    .max(100, 'Option value must be under 100 characters'),
  sortOrder: z.number().int().nonnegative().default(0),
})

export type CreateProductOptionInput = z.infer<typeof CreateProductOptionSchema>
export type CreateOptionValueInput = z.infer<typeof CreateOptionValueSchema>

// ─── Product Variant Validation Schemas ───────────────────

export const CreateVariantSchema = z.object({
  sku: z
    .string()
    .max(100, 'SKU must be under 100 characters')
    .nullish(),
  price: z
    .number({ message: 'Price is required' })
    .positive('Price must be greater than zero'),
  stock: z
    .number({ message: 'Stock is required' })
    .int('Stock must be an integer')
    .nonnegative('Stock must be non-negative'),
  image: z.string().regex(URL_REGEX, 'Must be a valid URL').nullish(),
  images: z
    .array(z.string().regex(URL_REGEX, 'Each image must be a valid URL'))
    .max(10, 'Maximum 10 images allowed')
    .default([]),
  optionValueIds: z
    .array(z.string().regex(SHORT_ID_REGEX, 'Invalid option value ID'))
    .default([]),
})

export const UpdateVariantSchema = z.object({
  sku: z
    .string()
    .max(100, 'SKU must be under 100 characters')
    .nullish(),
  price: z
    .number({ message: 'Price is required' })
    .positive('Price must be greater than zero'),
  stock: z
    .number({ message: 'Stock is required' })
    .int('Stock must be an integer')
    .nonnegative('Stock must be non-negative'),
  image: z.string().regex(URL_REGEX, 'Must be a valid URL').nullish(),
  images: z
    .array(z.string().regex(URL_REGEX, 'Each image must be a valid URL'))
    .max(10, 'Maximum 10 images allowed'),
  optionValueIds: z
    .array(z.string().regex(SHORT_ID_REGEX, 'Invalid option value ID')),
}).partial()

export type CreateVariantInput = z.infer<typeof CreateVariantSchema>
export type UpdateVariantInput = z.infer<typeof UpdateVariantSchema>

// ─── Review Validation Schemas ────────────────────────────

export const CreateReviewSchema = z.object({
  productId: z.string().regex(SHORT_ID_REGEX, 'Invalid product ID'),
  orderId: z.string().regex(ORDER_ID_REGEX, 'Invalid order ID').nullish(),
  rating: z
    .number()
    .int('Rating must be a whole number')
    .min(1, 'Rating must be at least 1')
    .max(5, 'Rating must be at most 5'),
  comment: z
    .string()
    .min(10, 'Review must be at least 10 characters')
    .max(1000, 'Review must be under 1000 characters'),
  isAnonymous: z.boolean().default(false),
})

export type CreateReviewInput = z.infer<typeof CreateReviewSchema>

// ─── Share Validation Schemas ─────────────────────────────

export const CreateShareSchema = z.object({
  productId: z.string().regex(SHORT_ID_REGEX, 'Invalid product ID'),
  variantId: z
    .string()
    .regex(SHORT_ID_REGEX, 'Invalid variant ID')
    .nullish(),
})

export type CreateShareInput = z.infer<typeof CreateShareSchema>
