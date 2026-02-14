import type { Order as PrismaOrder, OrderItem as PrismaOrderItem, Product as PrismaProduct, ProductVariation as PrismaProductVariation } from '@prisma/client';

type OrderWithItems = PrismaOrder & {
  items: (PrismaOrderItem & {
    product: PrismaProduct;
    variation: PrismaProductVariation | null;
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
