import type { InferSelectModel } from "drizzle-orm";
import { orders, orderItems, products, productVariations } from "./schema";

type DbOrder = InferSelectModel<typeof orders>;
type DbOrderItem = InferSelectModel<typeof orderItems>;
type DbProduct = InferSelectModel<typeof products>;
type DbProductVariation = InferSelectModel<typeof productVariations>;

type OrderWithItems = DbOrder & {
  items: (DbOrderItem & {
    product: DbProduct;
    variation: DbProductVariation | null;
  })[];
};

/**
 * Safely convert Date or string to ISO string
 * Handles data from both DB (Date) and Redis cache (string)
 */
function toISOString(value: Date | string): string {
  if (typeof value === "string") return value;
  return value.toISOString();
}

/**
 * Serialize order with items for API response
 * Converts Date objects to ISO strings
 */
export function serializeOrder(order: OrderWithItems) {
  return {
    ...order,
    createdAt: toISOString(order.createdAt),
    updatedAt: toISOString(order.updatedAt),
    items: order.items.map((item) => ({
      ...item,
      product: {
        ...item.product,
        createdAt: toISOString(item.product.createdAt),
        updatedAt: toISOString(item.product.updatedAt),
      },
      variation: item.variation
        ? {
            ...item.variation,
            createdAt: toISOString(item.variation.createdAt),
            updatedAt: toISOString(item.variation.updatedAt),
          }
        : null,
    })),
  };
}

/**
 * Serialize multiple orders
 */
export function serializeOrders(orders: OrderWithItems[]) {
  return orders.map(serializeOrder);
}
