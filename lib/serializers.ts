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

const toISOString = (value: Date | string): string => {
  if (typeof value === "string") return value;
  return value.toISOString();
};

export const serializeOrder = (order: OrderWithItems) => ({
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
});

export const serializeOrders = (orders: OrderWithItems[]) =>
  orders.map(serializeOrder);
