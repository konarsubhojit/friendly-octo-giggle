import { NextRequest } from "next/server";
import { drizzleDb } from "@/lib/db";
import { orders } from "@/lib/schema";
import { eq } from "drizzle-orm";
import {
  apiSuccess,
  apiError,
  handleApiError,
  handleValidationError,
} from "@/lib/api-utils";
import { auth } from "@/lib/auth";
import { cacheAdminOrderById, invalidateAdminOrderCaches } from "@/lib/cache";
import { serializeOrder } from "@/lib/serializers";
import { UpdateOrderStatusSchema } from "@/lib/validations";

export const dynamic = "force-dynamic";

// Check if user is admin
const checkAdminAuth = async () => {
  const session = await auth();

  if (!session?.user) {
    return {
      authorized: false,
      error: "Not authenticated",
      status: 401 as const,
    };
  }

  if (session.user.role !== "ADMIN") {
    return {
      authorized: false,
      error: "Not authorized - Admin access required",
      status: 403 as const,
    };
  }

  return { authorized: true };
};

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

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
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

    await drizzleDb
      .update(orders)
      .set(buildUpdateData(parseResult.data))
      .where(eq(orders.id, id));

    const order = await drizzleDb.query.orders.findFirst({
      where: eq(orders.id, id),
      with: { items: { with: { product: true, variation: true } } },
    });

    if (!order) {
      return apiError("Order not found", 404);
    }

    await invalidateAdminOrderCaches(id, order.userId);

    return apiSuccess({ order: serializeOrder(order) });
  } catch (error) {
    return handleApiError(error);
  }
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
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
}
