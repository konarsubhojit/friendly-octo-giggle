/* eslint-disable no-console */
import { config } from "dotenv";
config({ path: ".env.local" });
config({ path: ".env", override: false });

import { randomBytes, randomInt as cryptoRandomInt } from "node:crypto";
import { Pool } from "@neondatabase/serverless";

type QueryableClient = Pick<Pool, "query">;

type ProductRow = {
  id: string;
  name: string;
  price: number;
  variations: Array<{
    id: string;
    name: string;
    priceModifier: number;
  }>;
};

type UserRow = {
  id: string;
  name: string | null;
  email: string;
};

type OrderInsertRow = {
  id: string;
  userId: string;
  customerName: string;
  customerEmail: string;
  customerAddress: string;
  totalAmount: number;
  status: string;
  createdAt: Date;
  updatedAt: Date;
};

type OrderItemInsertRow = {
  id: string;
  orderId: string;
  productId: string;
  variationId: string | null;
  quantity: number;
  price: number;
  customizationNote: string | null;
};

const BASE62_CHARS =
  "0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz";
const DEFAULT_ORDER_COUNT = 10000;
const ORDER_BATCH_SIZE = 200;
const ORDER_ITEM_BATCH_SIZE = 500;

const parseCount = (): number => {
  const rawCount = process.argv[2] ?? String(DEFAULT_ORDER_COUNT);
  const parsed = Number.parseInt(rawCount, 10);

  if (Number.isNaN(parsed) || parsed < 1 || parsed > 10000) {
    throw new Error("Order count must be an integer between 1 and 10000");
  }

  return parsed;
};

const createBase62Id = (length: number): string => {
  const limit = 248;
  let result = "";

  while (result.length < length) {
    const bytes = randomBytes(length - result.length);
    for (
      let index = 0;
      index < bytes.length && result.length < length;
      index++
    ) {
      if (bytes[index] < limit) {
        result += BASE62_CHARS[bytes[index] % 62];
      }
    }
  }

  return result;
};

const createOrderId = (): string => `ORD${createBase62Id(7)}`;

const createWord = (minLength: number, maxLength: number): string => {
  const length = randomInt(minLength, maxLength);
  let word = "";

  for (let index = 0; index < length; index++) {
    word += String.fromCodePoint(randomInt(97, 122));
  }

  return word;
};

const randomInt = (min: number, max: number): number =>
  cryptoRandomInt(min, max + 1);

const randomDateWithinLast180Days = (): Date => {
  const now = Date.now();
  const oldest = now - 180 * 24 * 60 * 60 * 1000;
  return new Date(randomInt(oldest, now));
};

const weightedStatus = (): string => {
  const roll = cryptoRandomInt(0, 100);

  if (roll < 35) return "DELIVERED";
  if (roll < 60) return "SHIPPED";
  if (roll < 80) return "PROCESSING";
  if (roll < 97) return "PENDING";
  return "CANCELLED";
};

const shuffle = <T>(items: readonly T[]): T[] => {
  const copy = [...items];

  for (let index = copy.length - 1; index > 0; index--) {
    const swapIndex = randomInt(0, index);
    [copy[index], copy[swapIndex]] = [copy[swapIndex], copy[index]];
  }

  return copy;
};

const pickRandom = <T>(items: readonly T[]): T =>
  items[randomInt(0, items.length - 1)];

const createRandomAddress = (): string =>
  `${createWord(4, 8)}, ${createWord(3, 7)}`;

const pickVariation = (
  product: ProductRow,
): { id: string; name: string; priceModifier: number } | null => {
  if (product.variations.length === 0 || cryptoRandomInt(0, 100) >= 65) {
    return null;
  }

  return product.variations[randomInt(0, product.variations.length - 1)];
};

const insertOrderBatch = async (
  client: QueryableClient,
  rows: OrderInsertRow[],
): Promise<void> => {
  for (let start = 0; start < rows.length; start += ORDER_BATCH_SIZE) {
    const chunk = rows.slice(start, start + ORDER_BATCH_SIZE);
    const values: string[] = [];
    const params: Array<string | number | Date> = [];
    let paramIndex = 1;

    for (const row of chunk) {
      values.push(
        `($${paramIndex++}, $${paramIndex++}, $${paramIndex++}, $${paramIndex++}, $${paramIndex++}, $${paramIndex++}, $${paramIndex++}, $${paramIndex++}, $${paramIndex++})`,
      );
      params.push(
        row.id,
        row.userId,
        row.customerName,
        row.customerEmail,
        row.customerAddress,
        row.totalAmount,
        row.status,
        row.createdAt,
        row.updatedAt,
      );
    }

    await client.query(
      `INSERT INTO "Order" (id, "userId", "customerName", "customerEmail", "customerAddress", "totalAmount", status, "createdAt", "updatedAt") VALUES ${values.join(", ")}`,
      params,
    );
  }
};

const insertOrderItemBatch = async (
  client: QueryableClient,
  rows: OrderItemInsertRow[],
): Promise<void> => {
  for (let start = 0; start < rows.length; start += ORDER_ITEM_BATCH_SIZE) {
    const chunk = rows.slice(start, start + ORDER_ITEM_BATCH_SIZE);
    const values: string[] = [];
    const params: Array<string | number | null> = [];
    let paramIndex = 1;

    for (const row of chunk) {
      values.push(
        `($${paramIndex++}, $${paramIndex++}, $${paramIndex++}, $${paramIndex++}, $${paramIndex++}, $${paramIndex++}, $${paramIndex++})`,
      );
      params.push(
        row.id,
        row.orderId,
        row.productId,
        row.variationId,
        row.quantity,
        row.price,
        row.customizationNote,
      );
    }

    await client.query(
      `INSERT INTO "OrderItem" (id, "orderId", "productId", "variationId", quantity, price, "customizationNote") VALUES ${values.join(", ")}`,
      params,
    );
  }
};

const main = async () => {
  const databaseUrl = process.env.DATABASE_URL;
  const requestedCount = parseCount();

  if (!databaseUrl) {
    throw new Error("DATABASE_URL is required");
  }

  const pool = new Pool({ connectionString: databaseUrl });

  try {
    const [userResult, countBeforeResult, productResult] = await Promise.all([
      pool.query<UserRow>(
        'SELECT id, name, email FROM "User" ORDER BY email ASC',
      ),
      pool.query<{ count: number }>(
        'SELECT COUNT(*)::int AS count FROM "Order"',
      ),
      pool.query<{
        id: string;
        name: string;
        price: number;
        variations: ProductRow["variations"];
      }>(`
        SELECT p.id,
               p.name,
               p.price,
               COALESCE(
                 json_agg(
                   json_build_object(
                     'id', pv.id,
                     'name', pv.name,
                     'priceModifier', pv."priceModifier"
                   )
                 ) FILTER (WHERE pv.id IS NOT NULL),
                 '[]'::json
               ) AS variations
        FROM "Product" p
        LEFT JOIN "ProductVariation" pv
          ON pv."productId" = p.id
         AND pv."deletedAt" IS NULL
        WHERE p."deletedAt" IS NULL
        GROUP BY p.id, p.name, p.price
        ORDER BY p.id
      `),
    ]);

    const users = userResult.rows;
    if (users.length === 0) {
      throw new Error("No users found");
    }

    const products = productResult.rows.map((row) => ({
      id: row.id,
      name: row.name,
      price: Number(row.price),
      variations: Array.isArray(row.variations)
        ? row.variations.map((variation) => ({
            id: variation.id,
            name: variation.name,
            priceModifier: Number(variation.priceModifier ?? 0),
          }))
        : [],
    }));

    if (products.length === 0) {
      throw new Error("No active products found");
    }

    const orderRows: OrderInsertRow[] = [];
    const itemRows: OrderItemInsertRow[] = [];
    const usedOrderIds = new Set<string>();
    const usedOrderItemIds = new Set<string>();

    for (let orderIndex = 0; orderIndex < requestedCount; orderIndex++) {
      let nextOrderId = createOrderId();
      while (usedOrderIds.has(nextOrderId)) {
        nextOrderId = createOrderId();
      }
      usedOrderIds.add(nextOrderId);
      const user = pickRandom(users);

      const selectedProducts = shuffle(products).slice(
        0,
        randomInt(1, Math.min(5, products.length)),
      );
      const createdAt = randomDateWithinLast180Days();
      const updatedAt = new Date(
        createdAt.getTime() + randomInt(0, 14) * 24 * 60 * 60 * 1000,
      );
      let totalAmount = 0;

      for (const product of selectedProducts) {
        let nextOrderItemId = createBase62Id(7);
        while (usedOrderItemIds.has(nextOrderItemId)) {
          nextOrderItemId = createBase62Id(7);
        }
        usedOrderItemIds.add(nextOrderItemId);

        const variation = pickVariation(product);
        const quantity = randomInt(1, 4);
        const unitPrice = Number(
          (product.price + (variation?.priceModifier ?? 0)).toFixed(2),
        );
        totalAmount += unitPrice * quantity;

        itemRows.push({
          id: nextOrderItemId,
          orderId: nextOrderId,
          productId: product.id,
          variationId: variation?.id ?? null,
          quantity,
          price: unitPrice,
          customizationNote: null,
        });
      }

      orderRows.push({
        id: nextOrderId,
        userId: user.id,
        customerName: user.name ?? `Customer ${createWord(4, 8)}`,
        customerEmail: user.email,
        customerAddress: createRandomAddress(),
        totalAmount: Number(totalAmount.toFixed(2)),
        status: weightedStatus(),
        createdAt,
        updatedAt,
      });
    }

    const client = await pool.connect();
    try {
      await client.query("BEGIN");
      await insertOrderBatch(client, orderRows);
      await insertOrderItemBatch(client, itemRows);
      await client.query("COMMIT");
    } catch (error) {
      await client.query("ROLLBACK");
      throw error;
    } finally {
      client.release();
    }

    const countAfterResult = await pool.query<{ count: number }>(
      'SELECT COUNT(*)::int AS count FROM "Order"',
    );

    console.log(
      JSON.stringify(
        {
          usersConsidered: users.length,
          ordersBefore: countBeforeResult.rows[0].count,
          ordersAfter: countAfterResult.rows[0].count,
          inserted:
            countAfterResult.rows[0].count - countBeforeResult.rows[0].count,
          itemRowsInserted: itemRows.length,
        },
        null,
        2,
      ),
    );
  } finally {
    await pool.end();
  }
};

try {
  await main();
} catch (error) {
  console.error(error);
  process.exit(1);
}
