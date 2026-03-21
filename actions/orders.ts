"use server";

import { drizzleDb } from "@/lib/db";
import { orders, orderItems } from "@/lib/schema";
import { eq, desc } from "drizzle-orm";
import { getRedisClient } from "@/lib/redis";
import { generateOrderId } from "@/lib/short-id";
import { logError, logBusinessEvent } from "@/lib/logger";
import { OrderStatusEnum } from "@/lib/validations";
import { z } from "zod";

type ActionResult<T> =
  | { success: true; data: T }
  | { success: false; error: string };

interface OrderItemRecord {
  productId: string;
  variationId?: string | null;
  quantity: number;
  price: number;
  customizationNote?: string | null;
}

export interface OrderSummary {
  id: string;
  userId: string | null;
  customerName: string;
  customerEmail: string;
  customerAddress: string;
  total: number;
  status: string;
  items: OrderItemRecord[];
  createdAt: string;
}

const OrderItemInputSchema = z.object({
  productId: z.string().min(1),
  variationId: z.string().nullish(),
  quantity: z.number().int().positive(),
  price: z.number().positive(),
  customizationNote: z.string().max(500).nullish(),
});

const CreateOrderActionSchema = z.object({
  customerName: z.string().min(1).max(200),
  customerEmail: z.string().email(),
  customerAddress: z.string().min(10).max(500),
  items: z.array(OrderItemInputSchema).min(1),
});

type CreateOrderActionInput = z.infer<typeof CreateOrderActionSchema>;

const redisOrderKey = (orderId: string) => `order:${orderId}`;
const redisUserOrdersKey = (userId: string) => `user:orders:${userId}`;

const writeOrderToRedis = async (order: OrderSummary): Promise<void> => {
  const redis = getRedisClient();
  if (!redis) return;

  try {
    const pipeline = redis.pipeline();
    pipeline.hset(redisOrderKey(order.id), {
      id: order.id,
      userId: order.userId ?? "",
      customerName: order.customerName,
      customerEmail: order.customerEmail,
      customerAddress: order.customerAddress,
      items: JSON.stringify(order.items),
      total: String(order.total),
      status: order.status,
      createdAt: order.createdAt,
    });
    if (order.userId) {
      pipeline.sadd(redisUserOrdersKey(order.userId), order.id);
    }
    await pipeline.exec();
  } catch (error) {
    logError({
      error,
      context: "order_redis_write",
      additionalInfo: { orderId: order.id },
    });
  }
};

const parseRedisHash = (hash: Record<string, unknown>): OrderSummary | null => {
  if (!hash.id || typeof hash.id !== "string") return null;
  return {
    id: hash.id as string,
    userId: (hash.userId as string) || null,
    customerName: (hash.customerName as string) ?? "",
    customerEmail: (hash.customerEmail as string) ?? "",
    customerAddress: (hash.customerAddress as string) ?? "",
    total: Number(hash.total ?? 0),
    status: (hash.status as string) ?? "PENDING",
    items: JSON.parse((hash.items as string) ?? "[]") as OrderItemRecord[],
    createdAt: (hash.createdAt as string) ?? "",
  };
};

const fetchOrdersFromDb = async (userId: string): Promise<OrderSummary[]> => {
  const rows = await drizzleDb.query.orders.findMany({
    where: eq(orders.userId, userId),
    orderBy: [desc(orders.createdAt)],
    with: { items: true },
  });

  return rows.map((row) => ({
    id: row.id,
    userId: row.userId,
    customerName: row.customerName,
    customerEmail: row.customerEmail,
    customerAddress: row.customerAddress,
    total: row.totalAmount,
    status: row.status,
    items: row.items.map((item) => ({
      productId: item.productId,
      variationId: item.variationId ?? null,
      quantity: item.quantity,
      price: item.price,
      customizationNote: item.customizationNote ?? null,
    })),
    createdAt: row.createdAt.toISOString(),
  }));
};

export const createOrder = async (
  userId: string,
  orderData: CreateOrderActionInput,
): Promise<ActionResult<{ orderId: string }>> => {
  const parseResult = CreateOrderActionSchema.safeParse(orderData);
  if (!parseResult.success) {
    return {
      success: false,
      error: parseResult.error.issues[0]?.message ?? "Invalid order data",
    };
  }

  const { customerName, customerEmail, customerAddress, items } =
    parseResult.data;
  const total = items.reduce(
    (sum, item) => sum + item.price * item.quantity,
    0,
  );
  const orderId = generateOrderId();
  const createdAt = new Date().toISOString();

  try {
    await drizzleDb.transaction(async (tx) => {
      await tx.insert(orders).values({
        id: orderId,
        userId,
        customerName,
        customerEmail,
        customerAddress,
        totalAmount: total,
        status: "PENDING",
        updatedAt: new Date(),
      });

      await tx.insert(orderItems).values(
        items.map((item) => ({
          orderId,
          productId: item.productId,
          variationId: item.variationId ?? null,
          quantity: item.quantity,
          price: item.price,
          customizationNote: item.customizationNote ?? null,
        })),
      );
    });
  } catch (error) {
    logError({
      error,
      context: "create_order_pg",
      additionalInfo: { userId },
    });
    return { success: false, error: "Failed to create order" };
  }

  void writeOrderToRedis({
    id: orderId,
    userId,
    customerName,
    customerEmail,
    customerAddress,
    total,
    status: "PENDING",
    items,
    createdAt,
  });

  logBusinessEvent({
    event: "order_created",
    details: { orderId, userId, total },
    success: true,
  });

  return { success: true, data: { orderId } };
};

export const updateOrderStatus = async (
  orderId: string,
  newStatus: string,
): Promise<ActionResult<{ orderId: string }>> => {
  const parseResult = OrderStatusEnum.safeParse(newStatus);
  if (!parseResult.success) {
    return { success: false, error: "Invalid order status" };
  }

  const status = parseResult.data;

  try {
    const updated = await drizzleDb
      .update(orders)
      .set({ status, updatedAt: new Date() })
      .where(eq(orders.id, orderId))
      .returning({ id: orders.id });

    if (updated.length === 0) {
      return { success: false, error: "Order not found" };
    }
  } catch (error) {
    logError({
      error,
      context: "update_order_status_pg",
      additionalInfo: { orderId, status },
    });
    return { success: false, error: "Failed to update order status" };
  }

  const redis = getRedisClient();
  if (redis) {
    try {
      await redis.hset(redisOrderKey(orderId), { status });
    } catch (error) {
      logError({
        error,
        context: "update_order_status_redis",
        additionalInfo: { orderId, status },
      });
    }
  }

  logBusinessEvent({
    event: "order_status_updated",
    details: { orderId, status },
    success: true,
  });

  return { success: true, data: { orderId } };
};

export const getUserOrders = async (
  userId: string,
): Promise<ActionResult<OrderSummary[]>> => {
  const redis = getRedisClient();

  if (redis) {
    try {
      const orderIds = await redis.smembers(redisUserOrdersKey(userId));

      if (orderIds.length > 0) {
        const pipeline = redis.pipeline();
        for (const orderId of orderIds) {
          pipeline.hgetall(redisOrderKey(orderId));
        }
        const results =
          await pipeline.exec<(Record<string, unknown> | null)[]>();

        const validOrders: OrderSummary[] = [];
        const missingIds: string[] = [];

        for (let index = 0; index < results.length; index++) {
          const hash = results[index];
          if (hash) {
            const parsed = parseRedisHash(hash);
            if (parsed) {
              validOrders.push(parsed);
            } else {
              missingIds.push(orderIds[index]);
            }
          } else {
            missingIds.push(orderIds[index]);
          }
        }

        if (missingIds.length > 0) {
          try {
            const dbOrders = await drizzleDb.query.orders.findMany({
              where: (o, { inArray }) => inArray(o.id, missingIds),
              with: { items: true },
            });

            for (const row of dbOrders) {
              const summary: OrderSummary = {
                id: row.id,
                userId: row.userId,
                customerName: row.customerName,
                customerEmail: row.customerEmail,
                customerAddress: row.customerAddress,
                total: row.totalAmount,
                status: row.status,
                items: row.items.map((item) => ({
                  productId: item.productId,
                  variationId: item.variationId ?? null,
                  quantity: item.quantity,
                  price: item.price,
                  customizationNote: item.customizationNote ?? null,
                })),
                createdAt: row.createdAt.toISOString(),
              };
              validOrders.push(summary);
              void writeOrderToRedis(summary);
            }
          } catch (error) {
            logError({
              error,
              context: "get_orders_redis_orphan_pg_fallback",
              additionalInfo: { userId },
            });
          }
        }

        return { success: true, data: validOrders };
      }
    } catch (error) {
      logError({
        error,
        context: "get_orders_redis",
        additionalInfo: { userId },
      });
    }
  }

  try {
    const data = await fetchOrdersFromDb(userId);
    return { success: true, data };
  } catch (error) {
    logError({
      error,
      context: "get_orders_pg",
      additionalInfo: { userId },
    });
    return { success: false, error: "Failed to retrieve orders" };
  }
};
