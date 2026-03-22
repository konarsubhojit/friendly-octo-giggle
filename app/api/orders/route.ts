import { NextRequest, NextResponse } from "next/server";
import { drizzleDb } from "@/lib/db";
import {
  orders,
  orderItems,
  products,
  productVariations,
  users,
} from "@/lib/schema";
import {
  eq,
  inArray,
  sql,
  desc,
  count,
  and,
  isNull,
  lt,
  ilike,
  or,
  SQL,
} from "drizzle-orm";
import { invalidateCache } from "@/lib/redis";
import { invalidateUserOrderCaches } from "@/lib/cache";
import { CreateOrderInput, OrderItemInput } from "@/lib/types";
import { withLogging } from "@/lib/api-middleware";
import { parseOffsetParam } from "@/lib/api-utils";
import { logBusinessEvent, logError } from "@/lib/logger";
import { auth } from "@/lib/auth";
import { sendOrderConfirmationEmail } from "@/lib/email";
import { getQStashClient } from "@/lib/qstash";
import type { OrderCreatedEvent } from "@/lib/qstash-events";
import { env } from "@/lib/env";
import { waitUntil } from "@vercel/functions";

import { searchUserOrdersRedis, writeOrderToRedis } from "@/actions/orders";
import {
  formatPriceForCurrency,
  isValidCurrencyCode,
  type CurrencyCode,
} from "@/lib/currency";

export const dynamic = "force-dynamic";

type ProductWithVariations = Awaited<
  ReturnType<typeof drizzleDb.query.products.findMany>
>[number] & {
  variations: Array<{ id: string; priceModifier: number; stock: number }>;
};

type ValidationResult =
  | {
      valid: true;
      customerName: string;
      customerEmail: string;
      customerAddress: string;
    }
  | { valid: false; error: string; status: number; reason: string };

type StockCheckResult =
  | { valid: true; totalAmount: number }
  | {
      valid: false;
      error: string;
      status: number;
      reason: string;
      details?: Record<string, unknown>;
    };

const validateCustomerInfo = (
  body: CreateOrderInput,
  session: {
    user: { id: string; name?: string | null; email?: string | null };
  },
): ValidationResult => {
  const customerName = body.customerName || session.user.name || "Unknown";
  const customerEmail = body.customerEmail || session.user.email;
  const customerAddress = body.customerAddress || "";

  const errorMap: Record<
    "missing_email" | "missing_address",
    { error: string; status: number; reason: string }
  > = {
    missing_email: {
      error: "Email address is required. Please update your profile.",
      status: 400,
      reason: "missing_email",
    },
    missing_address: {
      error: "Shipping address is required",
      status: 400,
      reason: "missing_address",
    },
  };

  const checks: [boolean, keyof typeof errorMap][] = [
    [!customerEmail, "missing_email"],
    [!customerAddress, "missing_address"],
  ];
  const found = checks.find(([cond]) => cond);
  if (found) {
    const [, reason] = found;
    return { valid: false, ...errorMap[reason] };
  }

  return {
    valid: true,
    customerName,
    customerEmail: customerEmail ?? "",
    customerAddress,
  };
};

const checkStockForItem = (
  item: OrderItemInput,
  product: ProductWithVariations,
): StockCheckResult => {
  let price = product.price;
  let stockToCheck = product.stock;

  if (item.variationId) {
    const variation = product.variations.find((v) => v.id === item.variationId);
    if (!variation) {
      return {
        valid: false,
        error: `Variation not found for ${product.name}`,
        status: 404,
        reason: "variation_not_found",
      };
    }
    price = product.price + variation.priceModifier;
    stockToCheck = variation.stock;
  }

  if (stockToCheck < item.quantity) {
    return {
      valid: false,
      error: `Insufficient stock for ${product.name}`,
      status: 400,
      reason: "insufficient_stock",
      details: {
        productId: product.id,
        productName: product.name,
        requested: item.quantity,
        available: stockToCheck,
      },
    };
  }

  return { valid: true, totalAmount: price * item.quantity };
};

const validateStockAndCalculateTotal = (
  items: OrderItemInput[],
  products: ProductWithVariations[],
): StockCheckResult => {
  let totalAmount = 0;

  for (const item of items) {
    const product = products.find((p) => p.id === item.productId);
    if (!product) {
      return {
        valid: false,
        error: `Product ${item.productId} not found`,
        status: 404,
        reason: "product_not_found",
      };
    }

    const result = checkStockForItem(item, product);
    if (!result.valid) {
      return result;
    }
    totalAmount += result.totalAmount;
  }

  return { valid: true, totalAmount };
};

const PAGE_SIZE = 20;

const parseOrderLimit = (param: string | null): number =>
  Math.min(
    Math.max(1, Number.parseInt(param ?? String(PAGE_SIZE), 10) || PAGE_SIZE),
    100,
  );

const buildOrderConditions = (userId: string, cursor: string | null, useOffset: boolean): SQL[] => {
  const conditions: SQL[] = [eq(orders.userId, userId)];

  if (!useOffset && cursor) {
    const cursorDate = new Date(cursor);
    if (!Number.isNaN(cursorDate.getTime())) {
      conditions.push(lt(orders.createdAt, cursorDate));
    }
  }

  return conditions;
};

const serializeDate = (value: Date | string): string =>
  value instanceof Date ? value.toISOString() : value;

const handleGet = async (request: NextRequest) => {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json(
        { error: "Authentication required" },
        { status: 401 },
      );
    }

    const { searchParams } = new URL(request.url);
    const limit = parseOrderLimit(searchParams.get("limit"));
    const search = searchParams.get("search")?.trim() ?? "";
    const offsetParam = searchParams.get("offset");
    const useOffset = offsetParam !== null;
    const offset = useOffset ? parseOffsetParam(offsetParam) : 0;
    const conditions = buildOrderConditions(
      session.user.id,
      searchParams.get("cursor"),
      useOffset,
    );
    const countConditions = buildOrderConditions(session.user.id, null, false);

    if (search) {
      const redisIds = await searchUserOrdersRedis(
        session.user.id,
        search,
        limit * 5,
      );
      if (redisIds && redisIds.length > 0) {
        conditions.push(inArray(orders.id, redisIds));
        countConditions.push(inArray(orders.id, redisIds));
      } else {
        const pattern = `%${search}%`;
        const searchCondition = or(
          ilike(orders.id, pattern),
          sql`${orders.status}::text ILIKE ${pattern}`,
          ilike(orders.customerName, pattern),
          ilike(orders.customerEmail, pattern),
          sql`EXISTS (
            SELECT 1 FROM "OrderItem" oi
            JOIN "Product" p ON p.id = oi."productId"
            LEFT JOIN "ProductVariation" pv ON pv.id = oi."variationId"
            WHERE oi."orderId" = ${orders.id}
            AND (p.name ILIKE ${pattern} OR pv.name ILIKE ${pattern})
          )`,
        ) as SQL;
        conditions.push(searchCondition);
        countConditions.push(searchCondition);
      }
    }

    const [rows, totalRows] = await Promise.all([
      drizzleDb.query.orders.findMany({
        where: and(...conditions),
        with: { items: { with: { product: true, variation: true } } },
        orderBy: [desc(orders.createdAt)],
        limit: limit + 1,
        offset: useOffset ? offset : undefined,
      }),
      drizzleDb
        .select({ value: count() })
        .from(orders)
        .where(and(...countConditions)),
    ]);

    const hasMore = rows.length > limit;
    const pageItems = hasMore ? rows.slice(0, limit) : rows;
    const lastItem = pageItems.at(-1);
    const nextCursor =
      hasMore && lastItem ? serializeDate(lastItem.createdAt) : null;
    const totalCount = Number(totalRows[0]?.value ?? 0);

    const serialized = pageItems.map((order) => ({
      ...order,
      createdAt: serializeDate(order.createdAt),
      updatedAt: serializeDate(order.updatedAt),
      items: order.items.map((item) => ({
        ...item,
        product: {
          ...item.product,
          createdAt: serializeDate(item.product.createdAt),
          updatedAt: serializeDate(item.product.updatedAt),
        },
      })),
    }));

    return NextResponse.json({
      orders: serialized,
      nextCursor,
      hasMore,
      totalCount,
    });
  } catch (error) {
    logError({
      error,
      context: "fetch_user_orders",
    });
    return NextResponse.json(
      { error: "Failed to fetch orders" },
      { status: 500 },
    );
  }
};

const sanitizeCustomizationNote = (
  raw: string | null | undefined,
): string | null => {
  if (typeof raw !== "string") return null;
  const trimmed = raw.trim();
  if (trimmed.length === 0) return null;
  return trimmed.slice(0, 500);
};

const buildOrderItemValues = (
  items: OrderItemInput[],
  productList: ProductWithVariations[],
  orderId: string,
): Array<{
  orderId: string;
  productId: string;
  variationId: string | null;
  quantity: number;
  price: number;
  customizationNote: string | null;
}> => {
  return items.map((item) => {
    const product = productList.find((p) => p.id === item.productId);
    if (!product)
      throw new Error(`Product with id ${item.productId} not found`);
    const variationMap = new Map(
      product.variations.map((v) => [v.id, v.priceModifier]),
    );
    const price =
      product.price + (variationMap.get(item.variationId ?? "") ?? 0);
    return {
      orderId,
      productId: item.productId,
      variationId: item.variationId ?? null,
      quantity: item.quantity,
      price,
      customizationNote: sanitizeCustomizationNote(item.customizationNote),
    };
  });
};

const handlePost = async (request: NextRequest) => {
  try {
    const session = await auth();

    if (!session?.user?.id) {
      logBusinessEvent({
        event: "order_create_failed",
        details: { reason: "not_authenticated" },
        success: false,
      });
      return NextResponse.json(
        { error: "Authentication required. Please sign in to place orders." },
        { status: 401 },
      );
    }

    const userId = session.user.id;

    const body: CreateOrderInput = await request.json();

    if (!body.items || body.items.length === 0) {
      logBusinessEvent({
        event: "order_create_failed",
        details: { reason: "missing_items" },
        success: false,
      });
      return NextResponse.json(
        { error: "Order must contain at least one item" },
        { status: 400 },
      );
    }

    const customerValidation = validateCustomerInfo(body, session);
    if (!customerValidation.valid) {
      logBusinessEvent({
        event: "order_create_failed",
        details: { reason: customerValidation.reason },
        success: false,
      });
      return NextResponse.json(
        { error: customerValidation.error },
        { status: customerValidation.status },
      );
    }
    const { customerName, customerEmail, customerAddress } = customerValidation;

    const productIds = body.items.map((item) => item.productId);
    const productList = (await drizzleDb.query.products.findMany({
      where: and(inArray(products.id, productIds), isNull(products.deletedAt)),
      with: {
        variations: {
          where: (v, { isNull }) => isNull(v.deletedAt),
        },
      },
    })) as ProductWithVariations[];

    if (productList.length !== body.items.length) {
      logBusinessEvent({
        event: "order_create_failed",
        details: {
          reason: "products_not_found",
          requestedCount: body.items.length,
          foundCount: productList.length,
        },
        success: false,
      });
      return NextResponse.json(
        { error: "Some products not found" },
        { status: 404 },
      );
    }

    const stockResult = validateStockAndCalculateTotal(body.items, productList);
    if (!stockResult.valid) {
      logBusinessEvent({
        event: "order_create_failed",
        details: { reason: stockResult.reason, ...stockResult.details },
        success: false,
      });
      return NextResponse.json(
        { error: stockResult.error },
        { status: stockResult.status },
      );
    }
    const { totalAmount } = stockResult;

    const order = await drizzleDb.transaction(async (tx) => {
      const [newOrder] = await tx
        .insert(orders)
        .values({
          userId,
          customerName,
          customerEmail,
          customerAddress,
          totalAmount,
          status: "PENDING",
          updatedAt: new Date(),
        })
        .returning();

      await tx
        .insert(orderItems)
        .values(buildOrderItemValues(body.items, productList, newOrder.id));

      for (const item of body.items) {
        if (item.variationId) {
          await tx
            .update(productVariations)
            .set({
              stock: sql`${productVariations.stock} - ${item.quantity}`,
              updatedAt: new Date(),
            })
            .where(eq(productVariations.id, item.variationId));
        }
        await tx
          .update(products)
          .set({
            stock: sql`${products.stock} - ${item.quantity}`,
            updatedAt: new Date(),
          })
          .where(eq(products.id, item.productId));
      }

      return newOrder;
    });

    const fullOrder = await drizzleDb.query.orders.findFirst({
      where: eq(orders.id, order.id),
      with: { items: { with: { product: true, variation: true } } },
    });

    if (!fullOrder) {
      return NextResponse.json(
        { error: "Failed to retrieve created order" },
        { status: 500 },
      );
    }

    type OrderItem = (typeof fullOrder.items)[number];

    logBusinessEvent({
      event: "order_created",
      details: {
        orderId: fullOrder.id,
        totalAmount: fullOrder.totalAmount,
        itemCount: fullOrder.items.length,
        customerEmail: fullOrder.customerEmail,
      },
      success: true,
    });

    waitUntil(
      writeOrderToRedis({
        id: fullOrder.id,
        userId,
        customerName: fullOrder.customerName,
        customerEmail: fullOrder.customerEmail,
        customerAddress: fullOrder.customerAddress,
        total: fullOrder.totalAmount,
        status: fullOrder.status,
        items: fullOrder.items.map((item: OrderItem) => ({
          productId: item.productId,
          variationId: item.variationId ?? null,
          quantity: item.quantity,
          price: item.price,
          customizationNote: item.customizationNote ?? null,
        })),
        createdAt: fullOrder.createdAt.toISOString(),
        productNames: [
          ...new Set(
            fullOrder.items.map((item: OrderItem) => {
              const parts = [item.product.name];
              if (item.variation?.name) parts.push(item.variation.name);
              return parts.join(" - ");
            }),
          ),
        ].join(", "),
      }),
    );

    const productCacheKeys = [
      ...new Set(body.items.map((item) => item.productId)),
    ];
    await Promise.all([
      invalidateCache("products:*"),
      invalidateCache("admin:orders:*"),
      invalidateUserOrderCaches(userId),
      ...productCacheKeys.map((productId) =>
        invalidateCache(`product:${productId}`),
      ),
    ]);

    const workerUrl = `${env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000"}/api/services/email`;

    const userRecord = await drizzleDb.query.users.findFirst({
      where: eq(users.id, userId),
      columns: { currencyPreference: true },
    });
    const currencyCode: CurrencyCode =
      userRecord?.currencyPreference &&
      isValidCurrencyCode(userRecord.currencyPreference)
        ? userRecord.currencyPreference
        : "INR";

    const emailEvent: OrderCreatedEvent = {
      type: "order.created",
      data: {
        orderId: fullOrder.id,
        customerEmail: fullOrder.customerEmail,
        customerName: fullOrder.customerName,
        customerAddress: fullOrder.customerAddress,
        totalAmount: fullOrder.totalAmount,
        currencyCode,
        items: fullOrder.items.map((item: OrderItem) => ({
          name: item.product.name,
          quantity: item.quantity,
          price: item.price,
        })),
      },
    };

    try {
      const publishResult = await getQStashClient().publishJSON({
        url: workerUrl,
        body: emailEvent,
      });
      logBusinessEvent({
        event: "order_email_queued",
        details: {
          orderId: fullOrder.id,
          eventType: emailEvent.type,
          messageId: publishResult.messageId,
        },
        success: true,
      });
    } catch (publishError) {
      logError({
        error: publishError,
        context: "qstash_publish_failed_using_fallback",
        additionalInfo: {
          orderId: fullOrder.id,
          eventType: emailEvent.type,
        },
      });
      sendOrderConfirmationEmail({
        to: fullOrder.customerEmail,
        customerName: fullOrder.customerName,
        orderId: fullOrder.id,
        totalAmount: formatPriceForCurrency(
          fullOrder.totalAmount,
          currencyCode,
        ),
        shippingAddress: fullOrder.customerAddress,
        items: fullOrder.items.map((item: OrderItem) => ({
          name: item.product.name,
          quantity: item.quantity,
          price: formatPriceForCurrency(item.price, currencyCode),
          variation: item.variation?.name ?? null,
        })),
      });
    }

    return NextResponse.json(
      {
        order: {
          ...fullOrder,
          createdAt: fullOrder.createdAt.toISOString(),
          updatedAt: fullOrder.updatedAt.toISOString(),
          items: fullOrder.items.map((item: OrderItem) => ({
            ...item,
            product: {
              ...item.product,
              createdAt: item.product.createdAt.toISOString(),
              updatedAt: item.product.updatedAt.toISOString(),
            },
          })),
        },
      },
      { status: 201 },
    );
  } catch (error) {
    logError({
      error,
      context: "order_creation",
      additionalInfo: {
        path: request.nextUrl.pathname,
      },
    });
    return NextResponse.json(
      { error: "Failed to create order" },
      { status: 500 },
    );
  }
};

export const GET = withLogging(handleGet);
export const POST = withLogging(handlePost);
