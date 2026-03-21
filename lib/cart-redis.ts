import { getRedisClient } from "./redis";
import { logError, logCacheOperation } from "./logger";
import { s } from "@upstash/redis";
import { waitUntil } from "@vercel/functions";

const CART_ITEM_PREFIX = "cartitem:";
const CART_INDEX_NAME = "cartitems";
const CART_ITEM_TTL_SECONDS = 86400;

const CART_ITEM_SCHEMA = s.object({
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
});

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
  variationPriceModifier: number | null;
  variationStock: number | null;
  quantity: number;
  createdAt: string;
  updatedAt: string;
}

const redisCartItemKey = (itemId: string) => `${CART_ITEM_PREFIX}${itemId}`;

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
  variationPriceModifier: String(item.variationPriceModifier ?? 0),
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
    variationPriceModifier: hash.variationPriceModifier
      ? Number(hash.variationPriceModifier)
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
    const pipeline = redis.pipeline();
    pipeline.hset(key, toHashFields(item));
    pipeline.expire(key, CART_ITEM_TTL_SECONDS);
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
    for (const item of items) {
      const key = redisCartItemKey(item.itemId);
      pipeline.hset(key, toHashFields(item));
      pipeline.expire(key, CART_ITEM_TTL_SECONDS);
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
    const items = await fetchCartFromRedis(userId, sessionId);
    if (items && items.length > 0) {
      const pipeline = redis.pipeline();
      for (const item of items) {
        if (item.cartId === cartId) {
          pipeline.del(redisCartItemKey(item.itemId));
        }
      }
      await pipeline.exec();
    }
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

  let ownerField: string | null = null;
  if (userId) {
    ownerField = "userId";
  } else if (sessionId) {
    ownerField = "sessionId";
  }
  const ownerValue = userId ?? sessionId;
  if (!ownerField || !ownerValue) return null;

  try {
    const index = redis.search.index({
      name: CART_INDEX_NAME,
      schema: CART_ITEM_SCHEMA,
    });

    const results = await index.query({
      filter: { [ownerField]: ownerValue },
      limit: 50,
    });

    if (results.length === 0) return null;

    const items: CartItemRedis[] = [];
    for (const result of results) {
      const data = result.data as unknown as Record<string, string>;
      const parsed = fromHashFields(data);
      if (parsed) items.push(parsed);
    }

    logCacheOperation({
      operation: "hit",
      key: `cart:${ownerField}:${ownerValue}`,
      hit: true,
      success: true,
    });

    return items.length > 0 ? items : null;
  } catch (error) {
    logError({
      error,
      context: "cart_redis_search",
      additionalInfo: { ownerField, ownerValue },
    });
    return null;
  }
};

export const backfillCartToRedis = (items: CartItemRedis[]): void => {
  waitUntil(writeCartItemsToRedis(items));
};
