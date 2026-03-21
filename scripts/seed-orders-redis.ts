/* eslint-disable no-console */
import { config } from "dotenv";
config({ path: ".env.local" });
config({ path: ".env", override: false });

import { Redis, s } from "@upstash/redis";
import { Pool } from "@neondatabase/serverless";

const BATCH_SIZE = 100;

interface OrderRow {
  id: string;
  userId: string | null;
  customerName: string;
  customerEmail: string;
  customerAddress: string;
  totalAmount: number;
  status: string;
  createdAt: Date;
}

interface OrderItemRow {
  orderId: string;
  productId: string;
  variationId: string | null;
  quantity: number;
  price: number;
  customizationNote: string | null;
}

const seedRedis = async (
  redisClient: Redis,
  allOrders: OrderRow[],
  itemsByOrder: Map<string, OrderItemRow[]>,
) => {
  console.log(`\n--- Seeding Upstash Redis (${allOrders.length} orders) ---`);
  let seeded = 0;

  for (let i = 0; i < allOrders.length; i += BATCH_SIZE) {
    const batch = allOrders.slice(i, i + BATCH_SIZE);
    const pipeline = redisClient.pipeline();

    for (const order of batch) {
      const items = itemsByOrder.get(order.id) ?? [];
      pipeline.hset(`order:${order.id}`, {
        id: order.id,
        userId: order.userId ?? "",
        customerName: order.customerName,
        customerEmail: order.customerEmail,
        customerAddress: order.customerAddress,
        items: JSON.stringify(
          items.map((item) => ({
            productId: item.productId,
            variationId: item.variationId ?? null,
            quantity: item.quantity,
            price: item.price,
            customizationNote: item.customizationNote ?? null,
          })),
        ),
        total: String(order.totalAmount),
        status: order.status,
        createdAt: order.createdAt.toISOString(),
      });

      if (order.userId) {
        pipeline.sadd(`user:orders:${order.userId}`, order.id);
      }
    }

    await pipeline.exec();
    seeded += batch.length;
    console.log(`  Redis: ${seeded}/${allOrders.length} orders written`);
  }

  console.log(`Redis seeding complete: ${seeded} orders`);
};

const main = async () => {
  const databaseUrl = process.env.DATABASE_URL;
  const redisUrl = process.env.UPSTASH_REDIS_REST_URL;
  const redisToken = process.env.UPSTASH_REDIS_REST_TOKEN;

  if (!databaseUrl) {
    console.error("DATABASE_URL is required");
    process.exit(1);
  }

  if (!redisUrl || !redisToken) {
    console.error(
      "UPSTASH_REDIS_REST_URL and UPSTASH_REDIS_REST_TOKEN are required.",
    );
    process.exit(1);
  }

  const pool = new Pool({ connectionString: databaseUrl });

  console.log("Fetching orders from PostgreSQL...");
  const { rows: allOrders } = await pool.query<OrderRow>(
    `SELECT id, "userId", "customerName", "customerEmail", "customerAddress", "totalAmount", status, "createdAt"
     FROM "Order"
     ORDER BY "createdAt" DESC`,
  );
  console.log(`Found ${allOrders.length} orders`);

  if (allOrders.length === 0) {
    console.log("No orders to seed. Exiting.");
    await pool.end();
    return;
  }

  console.log("Fetching order items from PostgreSQL...");
  const { rows: allItems } = await pool.query<OrderItemRow>(
    `SELECT "orderId", "productId", "variationId", quantity, price, "customizationNote"
     FROM "OrderItem"`,
  );
  console.log(`Found ${allItems.length} order items`);

  const itemsByOrder = new Map<string, OrderItemRow[]>();
  for (const item of allItems) {
    const existing = itemsByOrder.get(item.orderId) ?? [];
    existing.push(item);
    itemsByOrder.set(item.orderId, existing);
  }

  await pool.end();

  const redisClient = new Redis({ url: redisUrl, token: redisToken });

  console.log("\n--- Creating orders search index ---");
  try {
    const existingIndex = redisClient.search.index({ name: "orders" });
    const info = await existingIndex.describe();
    if (info) {
      console.log("  Dropping existing 'orders' index...");
      await existingIndex.drop();
    }
  } catch {
    // index doesn't exist, that's fine
  }

  await redisClient.search.createIndex({
    name: "orders",
    dataType: "hash",
    prefix: "order:",
    existsOk: true,
    schema: s.object({
      id: s.string().noTokenize(),
      customerName: s.string(),
      customerEmail: s.string().noTokenize(),
      customerAddress: s.string(),
      status: s.keyword(),
      userId: s.string().noTokenize(),
      total: s.string().noTokenize(),
      createdAt: s.string().noTokenize(),
    }),
  });
  console.log("  Search index 'orders' created (prefix: order:, type: hash)");

  console.log("\n--- Creating cartitems search index ---");
  try {
    const existingCartIndex = redisClient.search.index({ name: "cartitems" });
    const cartInfo = await existingCartIndex.describe();
    if (cartInfo) {
      console.log("  Dropping existing 'cartitems' index...");
      await existingCartIndex.drop();
    }
  } catch {
    // index doesn't exist
  }

  await redisClient.search.createIndex({
    name: "cartitems",
    dataType: "hash",
    prefix: "cartitem:",
    existsOk: true,
    schema: s.object({
      itemId: s.string().noTokenize(),
      cartId: s.string().noTokenize(),
      userId: s.string().noTokenize(),
      sessionId: s.string().noTokenize(),
      productId: s.string().noTokenize(),
      productName: s.string(),
      productDescription: s.string(),
      productPrice: s.string().noTokenize(),
      productImage: s.string().noTokenize(),
      productCategory: s.string().noTokenize(),
      productStock: s.string().noTokenize(),
      variationId: s.string().noTokenize(),
      variationName: s.string().noTokenize(),
      variationPriceModifier: s.string().noTokenize(),
      variationStock: s.string().noTokenize(),
      quantity: s.string().noTokenize(),
      createdAt: s.string().noTokenize(),
      updatedAt: s.string().noTokenize(),
    }),
  });
  console.log(
    "  Search index 'cartitems' created (prefix: cartitem:, type: hash)",
  );

  await seedRedis(redisClient, allOrders, itemsByOrder);

  console.log("\nDone.");
};

main().catch((error) => {
  console.error("Seed failed:", error);
  process.exit(1);
});
