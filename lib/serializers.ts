import type { InferSelectModel } from 'drizzle-orm';
import { orders, orderItems, products, productVariations } from './schema';

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
 * Serialize order with items for API response
 * Converts Date objects to ISO strings
 */
export function serializeOrder(order: OrderWithItems) {
  return {
    ...order,
    createdAt: order.createdAt.toISOString(),
    updatedAt: order.updatedAt.toISOString(),
    items: order.items.map(item => ({
      ...item,
      product: {
        ...item.product,
        createdAt: item.product.createdAt.toISOString(),
        updatedAt: item.product.updatedAt.toISOString(),
      },
      variation: item.variation ? {
        ...item.variation,
        createdAt: item.variation.createdAt.toISOString(),
        updatedAt: item.variation.updatedAt.toISOString(),
      } : null,
    })),
  };
}

/**
 * Serialize multiple orders
 */
export function serializeOrders(orders: OrderWithItems[]) {
  return orders.map(serializeOrder);
}
