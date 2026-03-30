import { getRedisClient } from "./redis";
import { logError, logCacheOperation } from "./logger";
import { waitUntil } from "@vercel/functions";

const CART_ITEM_PREFIX = "cartitem:";
const CART_OWNER_PREFIX = "cartowner:";
const CART_ITEM_TTL_SECONDS = 86400;

export interface CartItemRedis {
  itemId: string;
  cartId: string;
  userId: string;
  sessionId: string;
  productId: string;
  productName: string;
  productDescription: string;
  productPrice: number;
  productImage: string;
  productCategory: string;
  productStock: number;
  variationId: string | null;
  variationName: string | null;
  variationPrice: number | null;
  variationStock: number | null;
  quantity: number;
  createdAt: string;
  updatedAt: string;
}

const redisCartItemKey = (itemId: string) => `${CART_ITEM_PREFIX}${itemId}`;

const cartOwnerKey = (userId?: string, sessionId?: string): string | null => {
  if (userId) return `${CART_OWNER_PREFIX}user:${userId}`;
  if (sessionId) return `${CART_OWNER_PREFIX}session:${sessionId}`;
  return null;
};

const toHashFields = (item: CartItemRedis): Record<string, string> => ({
  itemId: item.itemId,
  cartId: item.cartId,
  userId: item.userId,
  sessionId: item.sessionId,
  productId: item.productId,
  productName: item.productName,
  productDescription: item.productDescription,
  productPrice: String(item.productPrice),
  productImage: item.productImage,
  productCategory: item.productCategory,
  productStock: String(item.productStock),
  variationId: item.variationId ?? "",
  variationName: item.variationName ?? "",
  variationPrice: String(item.variationPrice ?? 0),
  variationStock: String(item.variationStock ?? 0),
  quantity: String(item.quantity),
  createdAt: item.createdAt,
  updatedAt: item.updatedAt,
});

const fromHashFields = (hash: Record<string, string>): CartItemRedis | null => {
  if (!hash.itemId) return null;
  return {
    itemId: hash.itemId,
    cartId: hash.cartId ?? "",
    userId: hash.userId ?? "",
    sessionId: hash.sessionId ?? "",
    productId: hash.productId ?? "",
    productName: hash.productName ?? "",
    productDescription: hash.productDescription ?? "",
    productPrice: Number(hash.productPrice ?? 0),
    productImage: hash.productImage ?? "",
    productCategory: hash.productCategory ?? "",
    productStock: Number(hash.productStock ?? 0),
    variationId: hash.variationId || null,
    variationName: hash.variationName || null,
    variationPrice: hash.variationPrice
      ? Number(hash.variationPrice)
      : null,
    variationStock: hash.variationStock ? Number(hash.variationStock) : null,
    quantity: Number(hash.quantity ?? 0),
    createdAt: hash.createdAt ?? "",
    updatedAt: hash.updatedAt ?? "",
  };
};

export const writeCartItemToRedis = async (
  item: CartItemRedis,
): Promise<void> => {
  const redis = getRedisClient();
  if (!redis) return;

  try {
    const key = redisCartItemKey(item.itemId);
    const ownerSetKey = cartOwnerKey(
      item.userId || undefined,
      item.sessionId || undefined,
    );
    const pipeline = redis.pipeline();
    pipeline.hset(key, toHashFields(item));
    pipeline.expire(key, CART_ITEM_TTL_SECONDS);
    if (ownerSetKey) {
      pipeline.sadd(ownerSetKey, item.itemId);
      pipeline.expire(ownerSetKey, CART_ITEM_TTL_SECONDS);
    }
    await pipeline.exec();
  } catch (error) {
    logError({
      error,
      context: "cart_redis_write",
      additionalInfo: { itemId: item.itemId },
    });
  }
};

export const writeCartItemsToRedis = async (
  items: CartItemRedis[],
): Promise<void> => {
  const redis = getRedisClient();
  if (!redis || items.length === 0) return;

  try {
    const pipeline = redis.pipeline();
    const ownerSets = new Map<string, string[]>();

    for (const item of items) {
      const key = redisCartItemKey(item.itemId);
      pipeline.hset(key, toHashFields(item));
      pipeline.expire(key, CART_ITEM_TTL_SECONDS);

      const ownerSetKey = cartOwnerKey(
        item.userId || undefined,
        item.sessionId || undefined,
      );
      if (ownerSetKey) {
        const existing = ownerSets.get(ownerSetKey) ?? [];
        existing.push(item.itemId);
        ownerSets.set(ownerSetKey, existing);
      }
    }

    for (const [ownerSetKey, itemIds] of ownerSets) {
      for (const itemId of itemIds) {
        pipeline.sadd(ownerSetKey, itemId);
      }
      pipeline.expire(ownerSetKey, CART_ITEM_TTL_SECONDS);
    }

    await pipeline.exec();
    logCacheOperation({
      operation: "set",
      key: `cartitems:batch(${items.length})`,
      success: true,
    });
  } catch (error) {
    logError({
      error,
      context: "cart_redis_batch_write",
      additionalInfo: { count: items.length },
    });
  }
};

export const removeCartItemFromRedis = async (
  itemId: string,
): Promise<void> => {
  const redis = getRedisClient();
  if (!redis) return;

  try {
    await redis.del(redisCartItemKey(itemId));
  } catch (error) {
    logError({
      error,
      context: "cart_redis_delete",
      additionalInfo: { itemId },
    });
  }
};

export const removeCartItemsByCartId = async (
  cartId: string,
  userId?: string,
  sessionId?: string,
): Promise<void> => {
  const redis = getRedisClient();
  if (!redis) return;

  try {
    const ownerSetKey = cartOwnerKey(userId, sessionId);
    if (!ownerSetKey) return;

    const itemIds = await redis.smembers(ownerSetKey);
    if (!itemIds || itemIds.length === 0) return;

    const pipeline = redis.pipeline();
    for (const itemId of itemIds) {
      pipeline.del(redisCartItemKey(itemId));
    }
    pipeline.del(ownerSetKey);
    await pipeline.exec();
  } catch (error) {
    logError({
      error,
      context: "cart_redis_clear",
      additionalInfo: { cartId },
    });
  }
};

export const updateCartItemQuantityInRedis = async (
  itemId: string,
  quantity: number,
): Promise<void> => {
  const redis = getRedisClient();
  if (!redis) return;

  try {
    const key = redisCartItemKey(itemId);
    await redis.hset(key, {
      quantity: String(quantity),
      updatedAt: new Date().toISOString(),
    });
    await redis.expire(key, CART_ITEM_TTL_SECONDS);
  } catch (error) {
    logError({
      error,
      context: "cart_redis_update_quantity",
      additionalInfo: { itemId, quantity },
    });
  }
};

export const fetchCartFromRedis = async (
  userId?: string,
  sessionId?: string,
): Promise<CartItemRedis[] | null> => {
  const redis = getRedisClient();
  if (!redis) return null;

  const ownerSetKey = cartOwnerKey(userId, sessionId);
  if (!ownerSetKey) return null;

  try {
    const itemIds = await redis.smembers(ownerSetKey);
    if (!itemIds || itemIds.length === 0) return null;

    const pipeline = redis.pipeline();
    for (const itemId of itemIds) {
      pipeline.hgetall(redisCartItemKey(itemId));
    }
    const results = await pipeline.exec();

    const items: CartItemRedis[] = [];
    const expiredIds: string[] = [];

    for (let index = 0; index < results.length; index++) {
      const hash = results[index] as Record<string, string> | null;
      if (!hash || Object.keys(hash).length === 0) {
        expiredIds.push(itemIds[index]);
        continue;
      }
      const parsed = fromHashFields(hash);
      if (parsed) items.push(parsed);
    }

    if (expiredIds.length > 0) {
      const cleanupPipeline = redis.pipeline();
      for (const expiredId of expiredIds) {
        cleanupPipeline.srem(ownerSetKey, expiredId);
      }
      cleanupPipeline.exec().catch(() => {});
    }

    logCacheOperation({
      operation: "hit",
      key: `cart:${userId ? "user" : "session"}:${userId ?? sessionId}`,
      success: true,
    });

    return items.length > 0 ? items : null;
  } catch (error) {
    logError({
      error,
      context: "cart_redis_fetch",
      additionalInfo: { ownerSetKey },
    });
    return null;
  }
};

export const backfillCartToRedis = (items: CartItemRedis[]): void => {
  waitUntil(writeCartItemsToRedis(items));
};
