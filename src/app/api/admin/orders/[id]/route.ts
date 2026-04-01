import { NextRequest } from "next/server";
import { drizzleDb, primaryDrizzleDb } from "@/lib/db";
import { orders } from "@/lib/schema";
import { eq } from "drizzle-orm";
import {
  apiSuccess,
  apiError,
  handleApiError,
  handleValidationError,
} from "@/lib/api-utils";
import { checkAdminAuth } from "@/features/admin/services/admin-auth";
import { cacheAdminOrderById, invalidateAdminOrderCaches } from "@/lib/cache";
import { serializeOrder } from "@/lib/serializers";
import { UpdateOrderStatusSchema } from "@/lib/validations";
import { sendOrderStatusUpdateEmail } from "@/lib/email";
import { getQStashClient } from "@/lib/qstash";
import type { OrderStatusChangedEvent } from "@/lib/qstash-events";
import { env } from "@/lib/env";
import { logBusinessEvent, logError } from "@/lib/logger";
import { getRedisClient } from "@/lib/redis";
import { waitUntil } from "@vercel/functions";

export const dynamic = "force-dynamic";

const buildUpdateData = (data: {
  status: "PENDING" | "PROCESSING" | "SHIPPED" | "DELIVERED" | "CANCELLED";
  trackingNumber?: string | null;
  shippingProvider?: string | null;
}) => {
  const optional = Object.fromEntries(
    Object.entries({
      trackingNumber: data.trackingNumber,
      shippingProvider: data.shippingProvider,
    }).filter(([, v]) => v !== undefined),
  );
  return { status: data.status, updatedAt: new Date(), ...optional };
};

export const PATCH = async (
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) => {
  const authCheck = await checkAdminAuth();
  if (!authCheck.authorized) {
    return apiError(authCheck.error ?? "Unauthorized", authCheck.status);
  }

  try {
    const { id } = await params;
    const rawBody = await request.json();

    const parseResult = UpdateOrderStatusSchema.safeParse(rawBody);
    if (!parseResult.success) {
      return handleValidationError(parseResult.error);
    }

    await primaryDrizzleDb
      .update(orders)
      .set(buildUpdateData(parseResult.data))
      .where(eq(orders.id, id));

    const order = await primaryDrizzleDb.query.orders.findFirst({
      where: eq(orders.id, id),
      with: { items: { with: { product: true, variation: true } } },
    });

    if (!order) {
      return apiError("Order not found", 404);
    }

    await invalidateAdminOrderCaches(id, order.userId);

    const redis = getRedisClient();
    if (redis) {
      waitUntil(
        redis
          .hset(`order:${id}`, { status: parseResult.data.status })
          .catch((err) =>
            logError({ error: err, context: "admin_order_redis_update" }),
          ),
      );
    }

    const notifyStatuses = ["PROCESSING", "SHIPPED", "DELIVERED", "CANCELLED"];
    if (notifyStatuses.includes(parseResult.data.status)) {
      const workerUrl = `${env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000"}/api/services/email`;
      const statusEvent: OrderStatusChangedEvent = {
        type: "order.status_changed",
        data: {
          orderId: order.id,
          customerEmail: order.customerEmail,
          customerName: order.customerName,
          newStatus: parseResult.data.status,
          trackingNumber:
            parseResult.data.trackingNumber ?? order.trackingNumber ?? null,
          shippingProvider:
            parseResult.data.shippingProvider ?? order.shippingProvider ?? null,
        },
      };

      try {
        const publishResult = await getQStashClient().publishJSON({
          url: workerUrl,
          body: statusEvent,
        });
        logBusinessEvent({
          event: "order_status_email_queued",
          details: {
            orderId: order.id,
            eventType: statusEvent.type,
            messageId: publishResult.messageId,
          },
          success: true,
        });
      } catch (publishError) {
        logError({
          error: publishError,
          context: "qstash_publish_failed_using_fallback",
          additionalInfo: {
            orderId: order.id,
            eventType: statusEvent.type,
          },
        });
        sendOrderStatusUpdateEmail({
          to: order.customerEmail,
          customerName: order.customerName,
          orderId: order.id,
          status: parseResult.data.status,
          trackingNumber:
            parseResult.data.trackingNumber ?? order.trackingNumber,
          shippingProvider:
            parseResult.data.shippingProvider ?? order.shippingProvider,
        });
      }
    }

    return apiSuccess({ order: serializeOrder(order) });
  } catch (error) {
    return handleApiError(error);
  }
};

export const GET = async (
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) => {
  const authCheck = await checkAdminAuth();
  if (!authCheck.authorized) {
    return apiError(authCheck.error ?? "Unknown error", authCheck.status);
  }

  try {
    const { id } = await params;

    const order = await cacheAdminOrderById(id, () =>
      drizzleDb.query.orders.findFirst({
        where: eq(orders.id, id),
        with: { items: { with: { product: true, variation: true } } },
      }),
    );

    if (!order) {
      return apiError("Order not found", 404);
    }

    return apiSuccess({
      order: serializeOrder(order),
    });
  } catch (error) {
    return handleApiError(error);
  }
};
