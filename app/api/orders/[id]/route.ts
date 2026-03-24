import { NextRequest } from "next/server";
import { z } from "zod";
import { primaryDrizzleDb as drizzleDb } from "@/lib/db";
import { orders } from "@/lib/schema";
import { eq } from "drizzle-orm";
import {
  apiSuccess,
  apiError,
  handleApiError,
  handleValidationError,
} from "@/lib/api-utils";
import { auth } from "@/lib/auth";
import { serializeOrder } from "@/lib/serializers";
import { getCachedData, invalidateCache, getRedisClient } from "@/lib/redis";
import { CACHE_KEYS, CACHE_TTL, invalidateUserOrderCaches } from "@/lib/cache";
import { logError } from "@/lib/logger";
import { waitUntil } from "@vercel/functions";

export const dynamic = "force-dynamic";

const OrderActionSchema = z.object({
  action: z.literal("cancel"),
});

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return apiError("Authentication required", 401);
    }

    const { id } = await params;

    const order = await getCachedData(
      CACHE_KEYS.ORDER_BY_ID(session.user.id, id),
      CACHE_TTL.ORDER_DETAIL,
      async () => {
        return drizzleDb.query.orders.findFirst({
          where: eq(orders.id, id),
          with: {
            items: {
              with: {
                product: true,
                variation: true,
              },
            },
          },
        });
      },
      CACHE_TTL.ORDER_DETAIL_STALE,
    );

    if (order?.userId !== session.user.id) {
      return apiError("Order not found", 404);
    }

    return apiSuccess({ order: serializeOrder(order) });
  } catch (error) {
    return handleApiError(error);
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return apiError("Authentication required", 401);
    }

    const body = await request.json();
    const parseResult = OrderActionSchema.safeParse(body);
    if (!parseResult.success) {
      return handleValidationError(parseResult.error);
    }

    const { id } = await params;

    const order = await drizzleDb.query.orders.findFirst({
      where: eq(orders.id, id),
    });

    if (order?.userId !== session.user.id) {
      return apiError("Order not found", 404);
    }

    if (order.status !== "PENDING") {
      return apiError("Only pending orders can be cancelled", 400);
    }

    await drizzleDb
      .update(orders)
      .set({ status: "CANCELLED", updatedAt: new Date() })
      .where(eq(orders.id, id));

    const redis = getRedisClient();
    if (redis) {
      waitUntil(
        redis
          .hset(`order:${id}`, { status: "CANCELLED" })
          .catch((err) =>
            logError({ error: err, context: "order_cancel_redis_update" }),
          ),
      );
    }

    await Promise.allSettled([
      invalidateUserOrderCaches(session.user.id),
      invalidateCache("admin:orders:*"),
      invalidateCache(`admin:order:${id}`),
      invalidateCache(CACHE_KEYS.PRODUCTS_BESTSELLERS_PATTERN),
    ]);

    const updatedOrder = await drizzleDb.query.orders.findFirst({
      where: eq(orders.id, id),
      with: {
        items: {
          with: {
            product: true,
            variation: true,
          },
        },
      },
    });

    if (!updatedOrder) {
      return apiError("Order not found after update", 500);
    }

    return apiSuccess({ order: serializeOrder(updatedOrder) });
  } catch (error) {
    return handleApiError(error);
  }
}
