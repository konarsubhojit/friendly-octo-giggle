import { waitUntil } from "@vercel/functions";
import { desc, eq } from "drizzle-orm";
import { drizzleDb, primaryDrizzleDb } from "@/lib/db";
import { createOrderForUser, isOrderRequestError } from "@/features/orders/services/order-service";
import { send } from "@/lib/queue";
import { logBusinessEvent, logError } from "@/lib/logger";
import { checkoutRequests, orders } from "@/lib/schema";
import type {
  CheckoutEnqueueResponse,
  CheckoutRequestStatusResponse,
  CheckoutRequestStatus,
} from "@/lib/types";
import {
  CheckoutQueueMessageSchema,
  SubmitCheckoutSchema,
  type SubmitCheckoutInput,
} from "@/lib/validations";

export const CHECKOUT_QUEUE_TOPIC = "checkout-orders";

export interface CheckoutSessionUser {
  readonly id: string;
  readonly name?: string | null;
  readonly email?: string | null;
}

export interface AdminCheckoutRequestRecord {
  readonly id: string;
  readonly userId: string;
  readonly customerName: string;
  readonly customerEmail: string;
  readonly customerAddress: string;
  readonly itemCount: number;
  readonly status: CheckoutRequestStatus;
  readonly errorMessage: string | null;
  readonly orderId: string | null;
  readonly createdAt: string;
  readonly updatedAt: string;
}

interface RecentCheckoutRequestFilters {
  readonly limit?: number;
  readonly search?: string;
  readonly status?: CheckoutRequestStatus;
}

class CheckoutRequestError extends Error {
  readonly status: number;

  constructor(message: string, status: number) {
    super(message);
    this.name = "CheckoutRequestError";
    this.status = status;
  }
}

export const isCheckoutRequestError = (
  error: unknown,
): error is CheckoutRequestError => error instanceof CheckoutRequestError;

const getNormalizedCheckoutInput = (
  body: unknown,
  user: CheckoutSessionUser,
): SubmitCheckoutInput => {
  const rawBody =
    typeof body === "object" && body !== null
      ? (body as Record<string, unknown>)
      : {};

  const parseResult = SubmitCheckoutSchema.safeParse({
    customerName:
      typeof rawBody.customerName === "string" && rawBody.customerName.trim()
        ? rawBody.customerName
        : (user.name ?? "Customer"),
    customerEmail:
      typeof rawBody.customerEmail === "string" && rawBody.customerEmail.trim()
        ? rawBody.customerEmail
        : (user.email ?? ""),
    customerAddress:
      typeof rawBody.customerAddress === "string"
        ? rawBody.customerAddress
        : "",
    items: rawBody.items,
  });

  if (!parseResult.success) {
    throw new CheckoutRequestError(
      parseResult.error.issues[0]?.message ?? "Invalid checkout request",
      400,
    );
  }

  return parseResult.data;
};

const buildCheckoutStatusResponse = (
  checkoutRequestId: string,
  status: CheckoutRequestStatus,
  orderId: string | null,
  error: string | null,
): CheckoutRequestStatusResponse => ({
  checkoutRequestId,
  status,
  orderId,
  error,
});

const buildRetryExhaustedMessage = (
  deliveryCount: number,
  error: unknown,
): string => {
  const reason =
    error instanceof Error ? error.message : "Unknown consumer error";
  return `Automatic recovery stopped after ${deliveryCount} attempts: ${reason}`;
};

const updateCheckoutRequestStatus = async (
  checkoutRequestId: string,
  status: CheckoutRequestStatus,
  errorMessage: string | null,
) => {
  await primaryDrizzleDb
    .update(checkoutRequests)
    .set({
      status,
      errorMessage,
      updatedAt: new Date(),
    })
    .where(eq(checkoutRequests.id, checkoutRequestId));
};

const findCheckoutRequestById = async (checkoutRequestId: string) => {
  const [checkoutRequest] = await drizzleDb
    .select()
    .from(checkoutRequests)
    .where(eq(checkoutRequests.id, checkoutRequestId))
    .limit(1);

  return checkoutRequest ?? null;
};

const findCreatedOrderForCheckout = async (checkoutRequestId: string) =>
  drizzleDb
    .select({ id: orders.id })
    .from(orders)
    .where(eq(orders.checkoutRequestId, checkoutRequestId))
    .limit(1)
    .then(([order]) => order ?? null);

export const getRecentCheckoutRequests = async (
  filters: RecentCheckoutRequestFilters = {},
): Promise<AdminCheckoutRequestRecord[]> => {
  const { limit = 50, search, status } = filters;
  const rows = await drizzleDb
    .select({
      id: checkoutRequests.id,
      userId: checkoutRequests.userId,
      customerName: checkoutRequests.customerName,
      customerEmail: checkoutRequests.customerEmail,
      customerAddress: checkoutRequests.customerAddress,
      items: checkoutRequests.items,
      status: checkoutRequests.status,
      errorMessage: checkoutRequests.errorMessage,
      orderId: orders.id,
      createdAt: checkoutRequests.createdAt,
      updatedAt: checkoutRequests.updatedAt,
    })
    .from(checkoutRequests)
    .leftJoin(orders, eq(orders.checkoutRequestId, checkoutRequests.id))
    .orderBy(desc(checkoutRequests.createdAt))
    .limit(Math.max(limit * 4, 50));

  const normalizedSearch = search?.trim().toLowerCase() ?? "";

  return rows
    .map((row) => ({
      id: row.id,
      userId: row.userId,
      customerName: row.customerName,
      customerEmail: row.customerEmail,
      customerAddress: row.customerAddress,
      itemCount: row.items.length,
      status: row.status,
      errorMessage: row.errorMessage,
      orderId: row.orderId,
      createdAt: row.createdAt.toISOString(),
      updatedAt: row.updatedAt.toISOString(),
    }))
    .filter((record) => {
      if (status && record.status !== status) {
        return false;
      }

      if (!normalizedSearch) {
        return true;
      }

      const searchableValues = [
        record.id,
        record.userId,
        record.customerName,
        record.customerEmail,
        record.customerAddress,
        record.orderId ?? "",
        record.errorMessage ?? "",
      ];

      return searchableValues.some((value) =>
        value.toLowerCase().includes(normalizedSearch),
      );
    })
    .slice(0, limit);
};

export const recoverCheckoutRequestAfterRetryExhaustion = async ({
  checkoutRequestId,
  deliveryCount,
  error,
}: {
  checkoutRequestId: string;
  deliveryCount: number;
  error: unknown;
}): Promise<void> => {
  const existingOrder = await findCreatedOrderForCheckout(checkoutRequestId);

  if (existingOrder) {
    await updateCheckoutRequestStatus(checkoutRequestId, "COMPLETED", null);
    return;
  }

  const errorMessage = buildRetryExhaustedMessage(deliveryCount, error);
  await updateCheckoutRequestStatus(checkoutRequestId, "FAILED", errorMessage);

  logBusinessEvent({
    event: "checkout_request_retry_exhausted",
    details: {
      checkoutRequestId,
      deliveryCount,
      reason: errorMessage,
    },
    success: false,
  });
};

export const enqueueCheckoutForUser = async ({
  body,
  user,
}: {
  body: unknown;
  user: CheckoutSessionUser;
}): Promise<CheckoutEnqueueResponse> => {
  const normalized = getNormalizedCheckoutInput(body, user);

  const [checkoutRequest] = await primaryDrizzleDb
    .insert(checkoutRequests)
    .values({
      userId: user.id,
      customerName: normalized.customerName,
      customerEmail: normalized.customerEmail,
      customerAddress: normalized.customerAddress,
      items: normalized.items,
      status: "PENDING",
      updatedAt: new Date(),
    })
    .returning({ id: checkoutRequests.id, status: checkoutRequests.status });

  try {
    await send(
      CHECKOUT_QUEUE_TOPIC,
      { checkoutRequestId: checkoutRequest.id },
      { idempotencyKey: `checkout-request:${checkoutRequest.id}` },
    );
  } catch (error) {
    logError({
      error,
      context: "checkout_queue_publish_failed_using_inline_fallback",
      additionalInfo: {
        checkoutRequestId: checkoutRequest.id,
        userId: user.id,
      },
    });
    waitUntil(processCheckoutRequestById(checkoutRequest.id));
  }

  logBusinessEvent({
    event: "checkout_request_queued",
    details: {
      checkoutRequestId: checkoutRequest.id,
      userId: user.id,
      itemCount: normalized.items.length,
    },
    success: true,
  });

  return {
    checkoutRequestId: checkoutRequest.id,
    status: checkoutRequest.status,
  };
};

export const getCheckoutRequestStatusForUser = async ({
  checkoutRequestId,
  userId,
}: {
  checkoutRequestId: string;
  userId: string;
}): Promise<CheckoutRequestStatusResponse> => {
  const checkoutRequest = await findCheckoutRequestById(checkoutRequestId);

  if (checkoutRequest?.userId !== userId) {
    throw new CheckoutRequestError("Checkout request not found", 404);
  }

  const existingOrder = await findCreatedOrderForCheckout(checkoutRequestId);

  if (existingOrder && checkoutRequest.status !== "COMPLETED") {
    await updateCheckoutRequestStatus(checkoutRequestId, "COMPLETED", null);
  }

  return buildCheckoutStatusResponse(
    checkoutRequest.id,
    existingOrder ? "COMPLETED" : checkoutRequest.status,
    existingOrder?.id ?? null,
    existingOrder ? null : (checkoutRequest.errorMessage ?? null),
  );
};

export const processCheckoutRequestById = async (
  checkoutRequestId: string,
): Promise<void> => {
  const parseResult = CheckoutQueueMessageSchema.safeParse({
    checkoutRequestId,
  });
  if (!parseResult.success) {
    throw new CheckoutRequestError("Invalid checkout queue message", 400);
  }

  const checkoutRequest = await findCheckoutRequestById(checkoutRequestId);

  if (!checkoutRequest) {
    logBusinessEvent({
      event: "checkout_request_missing",
      details: { checkoutRequestId },
      success: false,
    });
    return;
  }

  const existingOrder = await findCreatedOrderForCheckout(checkoutRequestId);
  if (existingOrder) {
    if (checkoutRequest.status !== "COMPLETED") {
      await updateCheckoutRequestStatus(checkoutRequestId, "COMPLETED", null);
    }
    return;
  }

  if (
    checkoutRequest.status === "COMPLETED" ||
    checkoutRequest.status === "FAILED"
  ) {
    return;
  }

  await updateCheckoutRequestStatus(checkoutRequestId, "PROCESSING", null);

  try {
    const result = await createOrderForUser({
      body: {
        customerName: checkoutRequest.customerName,
        customerEmail: checkoutRequest.customerEmail,
        customerAddress: checkoutRequest.customerAddress,
        items: checkoutRequest.items.map((item) => ({
          productId: item.productId,
          variationId: item.variationId ?? undefined,
          quantity: item.quantity,
          customizationNote: item.customizationNote ?? undefined,
        })),
      },
      user: {
        id: checkoutRequest.userId,
        name: checkoutRequest.customerName,
        email: checkoutRequest.customerEmail,
      },
      checkoutRequestId,
    });

    await updateCheckoutRequestStatus(checkoutRequestId, "COMPLETED", null);

    logBusinessEvent({
      event: "checkout_request_completed",
      details: {
        checkoutRequestId,
        orderId: result.order.id,
        userId: checkoutRequest.userId,
      },
      success: true,
    });
  } catch (error) {
    if (isOrderRequestError(error) && error.status < 500) {
      await updateCheckoutRequestStatus(
        checkoutRequestId,
        "FAILED",
        error.message,
      );
      logBusinessEvent({
        event: "checkout_request_failed",
        details: {
          checkoutRequestId,
          reason: error.message,
          status: error.status,
        },
        success: false,
      });
      return;
    }

    await updateCheckoutRequestStatus(
      checkoutRequestId,
      "PENDING",
      error instanceof Error
        ? error.message
        : "Temporary checkout processing failure",
    );
    throw error;
  }
};
