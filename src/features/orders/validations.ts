import { z } from "zod";
import { SHORT_ID_REGEX, EMAIL_REGEX } from "@/lib/validations/primitives";

// ─── Order Validation Schemas ─────────────────────────────

export const OrderStatusEnum = z.enum([
  "PENDING",
  "PROCESSING",
  "SHIPPED",
  "DELIVERED",
  "CANCELLED",
]);

export const CheckoutRequestStatusEnum = z.enum([
  "PENDING",
  "PROCESSING",
  "COMPLETED",
  "FAILED",
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

export type OrderStatusType = z.infer<typeof OrderStatusEnum>;
export type CreateOrderInput = z.infer<typeof CreateOrderSchema>;
