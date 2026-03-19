import { z } from "zod";

// UUID regex pattern for validation (accepts any UUID format, not just specific versions)
const UUID_REGEX =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
// Short ID regex pattern for Base62 7-character IDs used by products, variations, carts, orders
const SHORT_ID_REGEX = /^[0-9A-Za-z]{7}$/;
// URL regex pattern for validation
const URL_REGEX = /^https?:\/\/.+/;
// ISO datetime regex pattern
const ISO_DATETIME_REGEX = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d{3})?Z$/;
// Email regex pattern - ReDoS-safe using atomic groups via possessive quantifiers simulation
// Uses a simple, linear-time pattern that validates common email formats
const EMAIL_REGEX =
  /^[a-zA-Z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(?:\.[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)*$/;

// Product validation schemas
// Note: ProductSchema with datetime strings is for API responses (already converted from Date)
// Use ProductInputSchema for validating user input
export const ProductSchema = z.object({
  id: z.string().regex(UUID_REGEX, "Invalid UUID format"),
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
  createdAt: z.string().regex(ISO_DATETIME_REGEX, "Invalid datetime format"), // ISO string after conversion from Drizzle Date
  updatedAt: z.string().regex(ISO_DATETIME_REGEX, "Invalid datetime format"), // ISO string after conversion from Drizzle Date
});

export const ProductInputSchema = ProductSchema.omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const ProductUpdateSchema = ProductInputSchema.partial();

// Order validation schemas
export const OrderStatusEnum = z.enum([
  "PENDING",
  "PROCESSING",
  "SHIPPED",
  "DELIVERED",
  "CANCELLED",
]);

export const OrderItemSchema = z.object({
  productId: z.string().regex(SHORT_ID_REGEX, "Invalid product ID"),
  quantity: z.number().int().positive("Quantity must be positive"),
  price: z.number().positive("Price must be positive"),
  customizationNote: z
    .string()
    .max(500, "Customization note must be under 500 characters")
    .nullish(),
});

export const CreateOrderSchema = z.object({
  customerName: z.string().min(1, "Name is required").max(200),
  customerEmail: z.string().regex(EMAIL_REGEX, "Invalid email address"),
  customerAddress: z
    .string()
    .min(10, "Address must be at least 10 characters")
    .max(500),
  items: z.array(OrderItemSchema).min(1, "At least one item is required"),
});

export const UpdateOrderStatusSchema = z.object({
  status: OrderStatusEnum,
  trackingNumber: z
    .string()
    .max(100, "Tracking number must be under 100 characters")
    .nullish(),
  shippingProvider: z
    .string()
    .max(100, "Shipping provider must be under 100 characters")
    .nullish(),
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
  NODE_ENV: z.enum(["development", "production", "test"]).optional(),
  EXCHANGE_RATE_API_KEY: z.string().optional(),
  SENDGRID_API_KEY: z.string().optional(),
  SENDGRID_FROM_EMAIL: z.string().optional(),
  GOOGLE_SMTP_HOST: z.string().optional(),
  GOOGLE_SMTP_PORT: z.string().optional(),
  GOOGLE_SMTP_SECURE: z.enum(["true", "false"]).optional(),
  GOOGLE_SMTP_USER: z.string().optional(),
  GOOGLE_SMTP_APP_PASSWORD: z.string().optional(),
  GOOGLE_SMTP_FROM_EMAIL: z.string().optional(),
});

export type Env = z.infer<typeof EnvSchema>;

// Cart validation schemas
export const AddToCartSchema = z.object({
  productId: z.string().regex(SHORT_ID_REGEX, "Invalid product ID"),
  variationId: z
    .string()
    .regex(SHORT_ID_REGEX, "Invalid variation ID")
    .nullish(),
  quantity: z
    .number()
    .int("Quantity must be an integer")
    .positive("Quantity must be positive"),
});

export const UpdateCartItemSchema = z.object({
  quantity: z
    .number()
    .int("Quantity must be an integer")
    .positive("Quantity must be positive"),
});

export type AddToCartInput = z.infer<typeof AddToCartSchema>;
export type UpdateCartItemInput = z.infer<typeof UpdateCartItemSchema>;

// ─── Auth Validation Schemas ─────────────────────────────

// Phone number regex: optional + prefix, country code (1-9), then 6-14 digits
const PHONE_REGEX = /^\+?[1-9]\d{6,14}$/;

// Password must be min 8 chars, with uppercase, lowercase, number, and special char
const PASSWORD_REGEX =
  /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[!@#$%^&*()_+\-=[\]{};':"\\|,.<>/?]).{8,}$/;

export const registerSchema = z
  .object({
    name: z.string().min(1, "Name is required").max(200),
    email: z.string().regex(EMAIL_REGEX, "Invalid email address"),
    phoneNumber: z
      .string()
      .regex(PHONE_REGEX, "Invalid phone number format")
      .nullish(),
    password: z
      .string()
      .min(8, "Password must be at least 8 characters")
      .regex(
        PASSWORD_REGEX,
        "Password must contain uppercase, lowercase, number, and special character",
      ),
    confirmPassword: z.string(),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: "Passwords don't match",
    path: ["confirmPassword"],
  });

export const credentialsLoginSchema = z.object({
  identifier: z.string().min(1, "Email or phone number is required"),
  password: z.string().min(1, "Password is required"),
});

export const changePasswordSchema = z
  .object({
    currentPassword: z.string().min(1, "Current password is required"),
    newPassword: z
      .string()
      .min(8, "Password must be at least 8 characters")
      .regex(
        PASSWORD_REGEX,
        "Password must contain uppercase, lowercase, number, and special character",
      ),
    confirmNewPassword: z.string(),
  })
  .refine((data) => data.newPassword === data.confirmNewPassword, {
    message: "Passwords don't match",
    path: ["confirmNewPassword"],
  });

export const updateProfileSchema = z.object({
  name: z.string().min(1, "Name cannot be empty").max(200).optional(),
  email: z.string().regex(EMAIL_REGEX, "Invalid email address").optional(),
  phoneNumber: z
    .string()
    .regex(PHONE_REGEX, "Invalid phone number format")
    .nullish(),
});

export type RegisterInput = z.infer<typeof registerSchema>;
export type CredentialsLoginInput = z.infer<typeof credentialsLoginSchema>;
export type ChangePasswordInput = z.infer<typeof changePasswordSchema>;
export type UpdateProfileInput = z.infer<typeof updateProfileSchema>;

// ─── Review Validation Schemas ───────────────────────────

export const CreateReviewSchema = z.object({
  productId: z.string().regex(SHORT_ID_REGEX, "Invalid product ID"),
  orderId: z.string().regex(SHORT_ID_REGEX, "Invalid order ID").nullish(),
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

// ─── Variation Validation Schemas ─────────────────────────

export const CreateVariationSchema = z.object({
  name: z
    .string()
    .min(1, "Name is required")
    .max(100, "Name must be under 100 characters"),
  designName: z
    .string()
    .min(1, "Design name is required")
    .max(100, "Design name must be under 100 characters"),
  priceModifier: z.number({ message: "Price modifier is required" }),
  stock: z
    .number({ message: "Stock is required" })
    .int("Stock must be an integer")
    .nonnegative("Stock must be non-negative"),
  image: z.string().regex(URL_REGEX, "Must be a valid URL").nullish(),
  images: z
    .array(z.string().regex(URL_REGEX, "Each image must be a valid URL"))
    .max(10, "Maximum 10 images allowed")
    .default([]),
});

export const UpdateVariationSchema = CreateVariationSchema.partial();

export type CreateVariationInput = z.infer<typeof CreateVariationSchema>;
export type UpdateVariationInput = z.infer<typeof UpdateVariationSchema>;

// Password requirement descriptions for UI display
export const PASSWORD_REQUIREMENTS = [
  { label: "At least 8 characters", test: (p: string) => p.length >= 8 },
  { label: "One uppercase letter", test: (p: string) => /[A-Z]/.test(p) },
  { label: "One lowercase letter", test: (p: string) => /[a-z]/.test(p) },
  { label: "One number", test: (p: string) => /\d/.test(p) },
  {
    label: "One special character",
    test: (p: string) => /[!@#$%^&*()_+\-=[\]{};':"\\|,.<>/?]/.test(p),
  },
] as const;
