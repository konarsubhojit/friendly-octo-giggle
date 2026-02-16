import { z } from 'zod';

// UUID regex pattern for validation
const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
// URL regex pattern for validation  
const URL_REGEX = /^https?:\/\/.+/;
// ISO datetime regex pattern
const ISO_DATETIME_REGEX = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d{3})?Z$/;
// Email regex pattern
const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// Product validation schemas
// Note: ProductSchema with datetime strings is for API responses (already converted from Date)
// Use ProductInputSchema for validating user input
export const ProductSchema = z.object({
  id: z.string().regex(UUID_REGEX, 'Invalid UUID format'),
  name: z.string().min(1, 'Name is required').max(200),
  description: z.string().min(1, 'Description is required').max(2000),
  price: z.number().positive('Price must be positive'),
  image: z.string().regex(URL_REGEX, 'Must be a valid URL'),
  stock: z.number().int().nonnegative('Stock must be non-negative'),
  category: z.string().min(1, 'Category is required').max(100),
  createdAt: z.string().regex(ISO_DATETIME_REGEX, 'Invalid datetime format'), // ISO string after conversion from Drizzle Date
  updatedAt: z.string().regex(ISO_DATETIME_REGEX, 'Invalid datetime format'), // ISO string after conversion from Drizzle Date
});

export const ProductInputSchema = ProductSchema.omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const ProductUpdateSchema = ProductInputSchema.partial();

// Order validation schemas
export const OrderStatusEnum = z.enum([
  'PENDING',
  'PROCESSING',
  'SHIPPED',
  'DELIVERED',
  'CANCELLED',
]);

export const OrderItemSchema = z.object({
  productId: z.string().regex(UUID_REGEX, 'Invalid product ID'),
  quantity: z.number().int().positive('Quantity must be positive'),
  price: z.number().positive('Price must be positive'),
});

export const CreateOrderSchema = z.object({
  customerName: z.string().min(1, 'Name is required').max(200),
  customerEmail: z.string().regex(EMAIL_REGEX, 'Invalid email address'),
  customerAddress: z.string().min(10, 'Address must be at least 10 characters').max(500),
  items: z.array(OrderItemSchema).min(1, 'At least one item is required'),
});

export const UpdateOrderStatusSchema = z.object({
  status: OrderStatusEnum,
});

// API Response types with validation
export const ApiSuccessSchema = <T extends z.ZodTypeAny>(dataSchema: T) =>
  z.object({
    data: dataSchema,
    success: z.literal(true),
  });

export const ApiErrorSchema = z.object({
  error: z.string(),
  success: z.literal(false),
  details: z.record(z.string(), z.string()).optional(),
});

// Infer types from schemas
export type ProductInput = z.infer<typeof ProductInputSchema>;
export type ProductUpdate = z.infer<typeof ProductUpdateSchema>;
export type CreateOrderInput = z.infer<typeof CreateOrderSchema>;
export type OrderStatusType = z.infer<typeof OrderStatusEnum>;

// Utility type for async function results
export type AsyncResult<T, E = Error> =
  | { success: true; data: T }
  | { success: false; error: E };

// Generic paginated response type
export interface PaginatedResponse<T> {
  items: T[];
  total: number;
  page: number;
  pageSize: number;
  hasMore: boolean;
}

// Type-safe environment variables
export const EnvSchema = z.object({
  DATABASE_URL: z.string(),
  REDIS_URL: z.string().optional(),
  NODE_ENV: z.enum(['development', 'production', 'test']).optional(),
});

export type Env = z.infer<typeof EnvSchema>;

// Cart validation schemas
export const AddToCartSchema = z.object({
  productId: z.string().regex(UUID_REGEX, 'Invalid product ID'),
  variationId: z.string().regex(UUID_REGEX, 'Invalid variation ID').optional(),
  quantity: z.number().int('Quantity must be an integer').positive('Quantity must be positive'),
});

export const UpdateCartItemSchema = z.object({
  quantity: z.number().int('Quantity must be an integer').positive('Quantity must be positive'),
});

export type AddToCartInput = z.infer<typeof AddToCartSchema>;
export type UpdateCartItemInput = z.infer<typeof UpdateCartItemSchema>;
