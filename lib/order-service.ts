import { drizzleDb, primaryDrizzleDb } from "@/lib/db";
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
  SQL,
} from "drizzle-orm";
import { invalidateCache } from "@/lib/redis";
import { invalidateUserOrderCaches, cacheUserOrdersList } from "@/lib/cache";
import { CreateOrderInput, OrderItemInput } from "@/lib/types";
import { parseOffsetParam } from "@/lib/api-utils";
import { logBusinessEvent, logError } from "@/lib/logger";
import { sendOrderConfirmationEmail } from "@/lib/email";
import { getQStashClient } from "@/lib/qstash";
import type { OrderCreatedEvent } from "@/lib/qstash-events";
import { env } from "@/lib/env";
import { waitUntil } from "@vercel/functions";
import { writeOrderToRedis } from "@/actions/orders";
import { searchOrderIds } from "@/lib/order-search";
import {
  formatPriceForCurrency,
  isValidCurrencyCode,
  type CurrencyCode,
} from "@/lib/currency";

const PAGE_SIZE = 20;

export interface OrderSessionUser {
  readonly id: string;
  readonly name?: string | null;
  readonly email?: string | null;
}

export class OrderRequestError extends Error {
  readonly status: number;

  constructor(message: string, status: number) {
    super(message);
    this.name = "OrderRequestError";
    this.status = status;
  }
}

export const isOrderRequestError = (
  error: unknown,
): error is OrderRequestError => error instanceof OrderRequestError;

type ProductWithVariations = Awaited<
  ReturnType<typeof drizzleDb.query.products.findMany>
>[number] & {
  variations: Array<{ id: string; price: number; stock: number }>;
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

interface HydratedOrderItem {
  productId: string;
  variationId: string | null;
  quantity: number;
  price: number;
  customizationNote: string | null;
  product: {
    name: string;
    createdAt: Date;
    updatedAt: Date;
  };
  variation?: { name: string } | null;
}

interface HydratedOrder {
  id: string;
  customerName: string;
  customerEmail: string;
  customerAddress: string;
  totalAmount: number;
  status: string;
  createdAt: Date;
  updatedAt: Date;
  items: HydratedOrderItem[];
}

const parseOrderLimit = (param: string | null): number =>
  Math.min(
    Math.max(1, Number.parseInt(param ?? String(PAGE_SIZE), 10) || PAGE_SIZE),
    100,
  );

const buildOrderConditions = (
  userId: string,
  cursor: string | null,
  useOffset: boolean,
): SQL[] => {
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

const validateCustomerInfo = (
  body: CreateOrderInput,
  user: OrderSessionUser,
): ValidationResult => {
  const customerName = body.customerName || user.name || "Unknown";
  const customerEmail = body.customerEmail || user.email;
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
  const found = checks.find(([condition]) => condition);
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
    const variation = product.variations.find(
      (value) => value.id === item.variationId,
    );
    if (!variation) {
      return {
        valid: false,
        error: `Variation not found for ${product.name}`,
        status: 404,
        reason: "variation_not_found",
      };
    }
    price = variation.price;
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
  productList: ProductWithVariations[],
): StockCheckResult => {
  let totalAmount = 0;
  const productMap = new Map(
    productList.map((product) => [product.id, product]),
  );

  for (const item of items) {
    const product = productMap.get(item.productId);
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
  const productMap = new Map(
    productList.map((product) => [
      product.id,
      {
        price: product.price,
        variationPriceMap: new Map(
          product.variations.map((variation) => [
            variation.id,
            variation.price,
          ]),
        ),
      },
    ]),
  );

  return items.map((item) => {
    const product = productMap.get(item.productId);
    if (!product) {
      throw new Error(`Product with id ${item.productId} not found`);
    }

    const variationPrice = product.variationPriceMap.get(item.variationId ?? "");
    const price = variationPrice !== undefined ? variationPrice : product.price;

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

const serializeOrderList = <
  T extends {
    createdAt: Date | string;
    updatedAt: Date | string;
    items: Array<{
      product: { createdAt: Date | string; updatedAt: Date | string };
    }>;
  },
>(
  rows: T[],
  limit: number,
) => {
  const hasMore = rows.length > limit;
  const pageItems = hasMore ? rows.slice(0, limit) : rows;
  const lastItem = pageItems.at(-1);
  const nextCursor =
    hasMore && lastItem ? serializeDate(lastItem.createdAt) : null;

  return {
    orders: pageItems.map((order) => ({
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
    })),
    nextCursor,
    hasMore,
  };
};

const serializeCreatedOrder = <
  T extends {
    createdAt: Date;
    updatedAt: Date;
    items: Array<{
      product: { createdAt: Date; updatedAt: Date };
    }>;
  },
>(
  fullOrder: T,
) => ({
  order: {
    ...fullOrder,
    createdAt: fullOrder.createdAt.toISOString(),
    updatedAt: fullOrder.updatedAt.toISOString(),
    items: fullOrder.items.map((item) => ({
      ...item,
      product: {
        ...item.product,
        createdAt: item.product.createdAt.toISOString(),
        updatedAt: item.product.updatedAt.toISOString(),
      },
    })),
  },
});

const logFailedOrderCreation = (
  reason: string,
  status: number,
  message: string,
  details?: Record<string, unknown>,
): never => {
  logBusinessEvent({
    event: "order_create_failed",
    details: { reason, ...details },
    success: false,
  });

  throw new OrderRequestError(message, status);
};

export const getUserOrders = async ({
  requestUrl,
  userId,
}: {
  requestUrl: string;
  userId: string;
}) => {
  const { searchParams } = new URL(requestUrl);
  const limit = parseOrderLimit(searchParams.get("limit"));
  const search = searchParams.get("search")?.trim() ?? "";
  const cursor = searchParams.get("cursor");
  const offsetParam = searchParams.get("offset");
  const useOffset = offsetParam !== null;
  const offset = useOffset ? parseOffsetParam(offsetParam) : 0;

  const fetcher = async () => {
    const conditions = buildOrderConditions(userId, cursor, useOffset);
    const countConditions = buildOrderConditions(userId, null, false);
    let totalCountFromSearch: number | null = null;

    if (search) {
      const matchedIds = await searchOrderIds(search, {
        userId,
        limit: 1000,
      });

      if (matchedIds?.length === 0) {
        return {
          orders: [],
          nextCursor: null,
          hasMore: false,
          totalCount: 0,
        };
      }

      if (matchedIds && matchedIds.length > 0) {
        const searchIds: string[] = matchedIds;
        const searchCondition = inArray(orders.id, searchIds);
        conditions.push(searchCondition);
        totalCountFromSearch = searchIds.length;
      }
    }

    const rows = await drizzleDb.query.orders.findMany({
      where: and(...conditions),
      with: { items: { with: { product: true, variation: true } } },
      orderBy: [desc(orders.createdAt)],
      limit: limit + 1,
      offset: useOffset ? offset : undefined,
    });

    const serialized = serializeOrderList(rows as HydratedOrder[], limit);

    return {
      ...serialized,
      totalCount:
        totalCountFromSearch ??
        Number(
          (
            await drizzleDb
              .select({ value: count() })
              .from(orders)
              .where(and(...countConditions))
          )[0]?.value ?? 0,
        ),
    };
  };

  return cacheUserOrdersList(fetcher, {
    userId,
    search,
    cursor,
    offset,
    limit,
  });
};

export const createOrderForUser = async ({
  body,
  user,
  checkoutRequestId,
}: {
  body: CreateOrderInput;
  user: OrderSessionUser;
  checkoutRequestId?: string;
}) => {
  if (!body.items || body.items.length === 0) {
    logFailedOrderCreation(
      "missing_items",
      400,
      "Order must contain at least one item",
    );
  }

  const customerValidation = validateCustomerInfo(body, user);
  if (!customerValidation.valid) {
    logFailedOrderCreation(
      customerValidation.reason,
      customerValidation.status,
      customerValidation.error,
    );
  }
  const customerDetails = customerValidation as Extract<
    ValidationResult,
    { valid: true }
  >;

  const { customerName, customerEmail, customerAddress } = customerDetails;
  const requestedProductIds = [
    ...new Set(body.items.map((item) => item.productId)),
  ];
  const productList = (await primaryDrizzleDb.query.products.findMany({
    where: and(
      inArray(products.id, requestedProductIds),
      isNull(products.deletedAt),
    ),
    with: {
      variations: {
        where: (variation, operators) => operators.isNull(variation.deletedAt),
      },
    },
  })) as ProductWithVariations[];

  if (productList.length !== requestedProductIds.length) {
    logFailedOrderCreation(
      "products_not_found",
      404,
      "Some products not found",
      {
        requestedCount: requestedProductIds.length,
        foundCount: productList.length,
      },
    );
  }

  const stockResult = validateStockAndCalculateTotal(body.items, productList);
  if (!stockResult.valid) {
    logFailedOrderCreation(
      stockResult.reason,
      stockResult.status,
      stockResult.error,
      stockResult.details,
    );
  }
  const stockDetails = stockResult as Extract<
    StockCheckResult,
    { valid: true }
  >;

  const itemsWithVariation = body.items.filter(
    (item): item is OrderItemInput & { variationId: string } =>
      item.variationId != null,
  );

  const order = await primaryDrizzleDb.transaction(async (tx) => {
    const [newOrder] = await tx
      .insert(orders)
      .values({
        userId: user.id,
        customerName,
        customerEmail,
        customerAddress,
        checkoutRequestId: checkoutRequestId ?? null,
        totalAmount: stockDetails.totalAmount,
        status: "PENDING",
        updatedAt: new Date(),
      })
      .returning();

    await tx
      .insert(orderItems)
      .values(buildOrderItemValues(body.items, productList, newOrder.id));

    await Promise.all([
      ...body.items.map((item) =>
        tx
          .update(products)
          .set({
            stock: sql`${products.stock} - ${item.quantity}`,
            updatedAt: new Date(),
          })
          .where(eq(products.id, item.productId)),
      ),
      ...itemsWithVariation.map((item) =>
        tx
          .update(productVariations)
          .set({
            stock: sql`${productVariations.stock} - ${item.quantity}`,
            updatedAt: new Date(),
          })
          .where(eq(productVariations.id, item.variationId)),
      ),
    ]);

    return newOrder;
  });

  const fullOrder = await primaryDrizzleDb.query.orders.findFirst({
    where: eq(orders.id, order.id),
    with: { items: { with: { product: true, variation: true } } },
  });

  if (!fullOrder) {
    throw new OrderRequestError("Failed to retrieve created order", 500);
  }
  const hydratedOrder = fullOrder as HydratedOrder;

  logBusinessEvent({
    event: "order_created",
    details: {
      orderId: hydratedOrder.id,
      totalAmount: hydratedOrder.totalAmount,
      itemCount: hydratedOrder.items.length,
      customerEmail: hydratedOrder.customerEmail,
    },
    success: true,
  });

  waitUntil(
    writeOrderToRedis({
      id: hydratedOrder.id,
      userId: user.id,
      customerName: hydratedOrder.customerName,
      customerEmail: hydratedOrder.customerEmail,
      customerAddress: hydratedOrder.customerAddress,
      total: hydratedOrder.totalAmount,
      status: hydratedOrder.status,
      items: hydratedOrder.items.map((item) => ({
        productId: item.productId,
        variationId: item.variationId ?? null,
        quantity: item.quantity,
        price: item.price,
        customizationNote: item.customizationNote ?? null,
      })),
      createdAt: hydratedOrder.createdAt.toISOString(),
      productNames: [
        ...new Set(
          hydratedOrder.items.map((item) => {
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
    invalidateUserOrderCaches(user.id),
    ...productCacheKeys.map((productId) =>
      invalidateCache(`product:${productId}`),
    ),
  ]);

  const workerUrl = `${env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000"}/api/services/email`;
  const userRecord = await drizzleDb.query.users.findFirst({
    where: eq(users.id, user.id),
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
      orderId: hydratedOrder.id,
      customerEmail: hydratedOrder.customerEmail,
      customerName: hydratedOrder.customerName,
      customerAddress: hydratedOrder.customerAddress,
      totalAmount: hydratedOrder.totalAmount,
      currencyCode,
      items: hydratedOrder.items.map((item) => ({
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
        orderId: hydratedOrder.id,
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
        orderId: hydratedOrder.id,
        eventType: emailEvent.type,
      },
    });
    sendOrderConfirmationEmail({
      to: hydratedOrder.customerEmail,
      customerName: hydratedOrder.customerName,
      orderId: hydratedOrder.id,
      totalAmount: formatPriceForCurrency(
        hydratedOrder.totalAmount,
        currencyCode,
      ),
      shippingAddress: hydratedOrder.customerAddress,
      items: hydratedOrder.items.map((item) => ({
        name: item.product.name,
        quantity: item.quantity,
        price: formatPriceForCurrency(item.price, currencyCode),
        variation: item.variation?.name ?? null,
      })),
    });
  }

  return serializeCreatedOrder(hydratedOrder);
};
