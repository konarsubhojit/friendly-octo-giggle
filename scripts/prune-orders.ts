/* eslint-disable no-console */
import { config } from "dotenv";
config({ path: ".env.local" });
config({ path: ".env", override: false });

import { Pool } from "@neondatabase/serverless";
import { Redis } from "@upstash/redis";

const DEFAULT_MAX_ORDERS = 10000;
const REDIS_BATCH_SIZE = 100;

type DeletedOrderRow = {
  id: string;
  userId: string | null;
};

const parseMaxOrders = (): number => {
  const rawValue = process.argv[2] ?? String(DEFAULT_MAX_ORDERS);
  const parsed = Number.parseInt(rawValue, 10);

  if (!Number.isInteger(parsed) || parsed < 1) {
    throw new Error("Max order count must be a positive integer");
  }

  return parsed;
};

const chunk = <T>(items: readonly T[], size: number): T[][] => {
  const chunks: T[][] = [];

  for (let index = 0; index < items.length; index += size) {
    chunks.push(items.slice(index, index + size));
  }

  return chunks;
};

const collectCacheKeys = async (
  redis: Redis,
  patterns: readonly string[],
): Promise<string[]> => {
  const keys = new Set<string>();

  for (const pattern of patterns) {
    let cursor = 0;

    do {
      const [nextCursor, matchedKeys] = await redis.scan(cursor, {
        match: pattern,
        count: 100,
      });

      cursor = Number(nextCursor);
      for (const key of matchedKeys as string[]) {
        keys.add(key);
      }
    } while (cursor !== 0);
  }

  return [...keys];
};

const cleanupRedis = async (deletedOrders: readonly DeletedOrderRow[]) => {
  const redisUrl = process.env.UPSTASH_REDIS_REST_URL;
  const redisToken = process.env.UPSTASH_REDIS_REST_TOKEN;

  if (!redisUrl || !redisToken || deletedOrders.length === 0) {
    return {
      enabled: Boolean(redisUrl && redisToken),
      removedOrderHashes: 0,
      updatedUserSets: 0,
      removedCacheKeys: 0,
    };
  }

  const redis = new Redis({ url: redisUrl, token: redisToken });
  const orderIdsByUser = new Map<string, string[]>();

  for (const order of deletedOrders) {
    if (!order.userId) {
      continue;
    }

    const existing = orderIdsByUser.get(order.userId) ?? [];
    existing.push(order.id);
    orderIdsByUser.set(order.userId, existing);
  }

  let removedOrderHashes = 0;
  for (const batch of chunk(
    deletedOrders.map((order) => `order:${order.id}`),
    REDIS_BATCH_SIZE,
  )) {
    if (batch.length === 0) {
      continue;
    }

    await redis.del(...batch);
    removedOrderHashes += batch.length;
  }

  let updatedUserSets = 0;
  for (const [userId, orderIds] of orderIdsByUser) {
    await redis.srem(`user:orders:${userId}`, ...orderIds);
    const remainingCount = await redis.scard(`user:orders:${userId}`);
    if (remainingCount === 0) {
      await redis.del(`user:orders:${userId}`);
    }
    updatedUserSets += 1;
  }

  const cacheKeys = await collectCacheKeys(redis, [
    ...[...orderIdsByUser.keys()].flatMap((userId) => [
      `orders:user:${userId}`,
      `order:${userId}:*`,
    ]),
    "admin:orders:*",
    "admin:order:*",
    "products:bestsellers",
    "admin:sales:*",
  ]);

  for (const batch of chunk(cacheKeys, REDIS_BATCH_SIZE)) {
    if (batch.length === 0) {
      continue;
    }

    await redis.del(...batch);
  }

  return {
    enabled: true,
    removedOrderHashes,
    updatedUserSets,
    removedCacheKeys: cacheKeys.length,
  };
};

const main = async () => {
  const databaseUrl = process.env.DATABASE_URL;
  const maxOrders = parseMaxOrders();

  if (!databaseUrl) {
    throw new Error("DATABASE_URL is required");
  }

  const pool = new Pool({ connectionString: databaseUrl });

  try {
    const countBeforeResult = await pool.query<{ count: number }>(
      'SELECT COUNT(*)::int AS count FROM "Order"',
    );
    const orderCountBefore = countBeforeResult.rows[0]?.count ?? 0;

    if (orderCountBefore <= maxOrders) {
      console.log(
        JSON.stringify(
          {
            maxOrders,
            ordersBefore: orderCountBefore,
            ordersAfter: orderCountBefore,
            deletedOrders: 0,
            message: "No pruning needed",
          },
          null,
          2,
        ),
      );
      return;
    }

    const deleteResult = await pool.query<DeletedOrderRow>(
      `WITH doomed_orders AS (
         SELECT id, "userId"
         FROM "Order"
         ORDER BY "createdAt" DESC, id DESC
         OFFSET $1
       )
       DELETE FROM "Order" AS orders_to_delete
       USING doomed_orders
       WHERE orders_to_delete.id = doomed_orders.id
       RETURNING orders_to_delete.id, orders_to_delete."userId"`,
      [maxOrders],
    );

    const countAfterResult = await pool.query<{ count: number }>(
      'SELECT COUNT(*)::int AS count FROM "Order"',
    );
    const orderCountAfter = countAfterResult.rows[0]?.count ?? 0;

    const redisCleanup = await cleanupRedis(deleteResult.rows);

    console.log(
      JSON.stringify(
        {
          maxOrders,
          ordersBefore: orderCountBefore,
          ordersAfter: orderCountAfter,
          deletedOrders: deleteResult.rowCount ?? deleteResult.rows.length,
          redisCleanup,
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
