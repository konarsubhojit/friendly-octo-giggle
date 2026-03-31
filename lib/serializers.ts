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

export const serializeProduct = <T extends DbProduct>(product: T) => ({
  ...product,
  createdAt: toISOString(product.createdAt),
  updatedAt: toISOString(product.updatedAt),
  deletedAt: product.deletedAt ? toISOString(product.deletedAt) : null,
});

export const serializeVariation = <T extends DbProductVariation>(
  variation: T,
) => ({
  ...variation,
  styleId: variation.styleId ?? null,
  image: variation.image ?? null,
  images: variation.images ?? [],
  createdAt: toISOString(variation.createdAt),
  updatedAt: toISOString(variation.updatedAt),
  deletedAt: variation.deletedAt ? toISOString(variation.deletedAt) : null,
});

export const serializeProductWithVariations = <
  T extends DbProduct & { variations: DbProductVariation[] },
>(
  product: T,
) => ({
  ...serializeProduct(product),
  variations: product.variations.map(serializeVariation),
});

export const serializeOrder = (order: OrderWithItems) => ({
  ...order,
  createdAt: toISOString(order.createdAt),
  updatedAt: toISOString(order.updatedAt),
  items: order.items.map((item) => ({
    ...item,
    product: serializeProduct(item.product),
    variation: item.variation ? serializeVariation(item.variation) : null,
  })),
});

export const serializeOrders = (orders: OrderWithItems[]) =>
  orders.map(serializeOrder);
