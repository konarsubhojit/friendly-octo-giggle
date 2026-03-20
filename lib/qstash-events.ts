import { z } from "zod";

const OrderEmailItemSchema = z.object({
  name: z.string().min(1),
  quantity: z.number().int().positive(),
  price: z.number().positive(),
});

const OrderCreatedEventSchema = z.object({
  type: z.literal("order.created"),
  data: z.object({
    orderId: z.string().min(1),
    customerEmail: z.string().email(),
    customerName: z.string().min(1),
    customerAddress: z.string().min(1),
    totalAmount: z.number().positive(),
    items: z.array(OrderEmailItemSchema),
  }),
});

const OrderStatusChangedEventSchema = z.object({
  type: z.literal("order.status_changed"),
  data: z.object({
    orderId: z.string().min(1),
    customerEmail: z.string().email(),
    customerName: z.string().min(1),
    newStatus: z.enum([
      "PENDING",
      "PROCESSING",
      "SHIPPED",
      "DELIVERED",
      "CANCELLED",
    ]),
    trackingNumber: z.string().nullable(),
    shippingProvider: z.string().nullable(),
  }),
});

export const QStashEmailEventSchema = z.discriminatedUnion("type", [
  OrderCreatedEventSchema,
  OrderStatusChangedEventSchema,
]);

export type QStashEmailEvent = z.infer<typeof QStashEmailEventSchema>;
export type OrderCreatedEvent = z.infer<typeof OrderCreatedEventSchema>;
export type OrderStatusChangedEvent = z.infer<
  typeof OrderStatusChangedEventSchema
>;
export type OrderEmailItem = z.infer<typeof OrderEmailItemSchema>;
