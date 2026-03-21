import { NextRequest, NextResponse } from "next/server";
import { drizzleDb } from "@/lib/db";
import { products, carts, cartItems, users } from "@/lib/schema";
import { eq, and, isNull } from "drizzle-orm";
import { auth } from "@/lib/auth";
import { AddToCartSchema, type AddToCartInput } from "@/lib/validations";
import { handleValidationError } from "@/lib/api-utils";
import { logError } from "@/lib/logger";
import { getCachedData } from "@/lib/redis";
import { CACHE_KEYS, CACHE_TTL, invalidateCartCache } from "@/lib/cache";
import type { Session } from "next-auth";

export const dynamic = "force-dynamic";

// Types for cart operations
interface ProductWithVariations {
  id: string;
  stock: number;
  variations: Array<{ id: string; stock: number }>;
}

interface CartWithItems {
  id: string;
  createdAt: Date | string;
  updatedAt: Date | string;
  items: Array<{
    id: string;
    quantity: number;
    createdAt: Date | string;
    updatedAt: Date | string;
    product: {
      id: string;
      createdAt: Date | string;
      updatedAt: Date | string;
      variations: Array<{ createdAt: Date | string; updatedAt: Date | string }>;
    };
    variation: { createdAt: Date | string; updatedAt: Date | string } | null;
  }>;
}

// Helper: Verify product exists and return available stock
const verifyProductStock = async (
  body: AddToCartInput,
): Promise<
  | { product: ProductWithVariations; availableStock: number }
  | { error: string; status: number }
> => {
  const product = await drizzleDb.query.products.findFirst({
    where: and(eq(products.id, body.productId), isNull(products.deletedAt)),
    with: {
      variations: {
        where: (v, { isNull }) => isNull(v.deletedAt),
      },
    },
  });

  if (!product) {
    return { error: "Product not found", status: 404 };
  }

  let availableStock = product.stock;
  if (body.variationId) {
    const variation = product.variations.find((v) => v.id === body.variationId);
    if (!variation) {
      return { error: "Variation not found", status: 404 };
    }
    availableStock = variation.stock;
  }

  if (availableStock <= 0) {
    return { error: "This product is currently out of stock", status: 400 };
  }

  return { product, availableStock };
};

// Helper: Get or create cart for user/guest
const getOrCreateCart = async (
  session: Session | null,
  sessionId: string | undefined,
): Promise<{ cart: { id: string }; sessionId: string | undefined }> => {
  const createGuestCart = async (providedSessionId?: string) => {
    const guestSessionId =
      providedSessionId ?? `guest_${Date.now()}_${crypto.randomUUID()}`;
    let cart = await drizzleDb.query.carts.findFirst({
      where: eq(carts.sessionId, guestSessionId),
    });
    if (!cart) {
      [cart] = await drizzleDb
        .insert(carts)
        .values({ sessionId: guestSessionId, updatedAt: new Date() })
        .returning();
    }
    return { cart, sessionId: guestSessionId };
  };

  if (session?.user?.id) {
    let cart = await drizzleDb.query.carts.findFirst({
      where: eq(carts.userId, session.user.id),
    });
    if (!cart) {
      const userRecord = await drizzleDb.query.users.findFirst({
        where: eq(users.id, session.user.id),
        columns: { id: true },
      });

      if (!userRecord) {
        logError({
          error: new Error("Authenticated session user not found in database"),
          context: "cart_invalid_session_user",
          additionalInfo: { userId: session.user.id },
        });

        return createGuestCart(sessionId);
      }

      [cart] = await drizzleDb
        .insert(carts)
        .values({ userId: session.user.id, updatedAt: new Date() })
        .returning();
    }
    return { cart, sessionId: undefined };
  }

  // Guest user
  return createGuestCart(sessionId);
};

// Helper: Add or update cart item, auto-capping to available stock
const addOrUpdateCartItem = async (
  cartId: string,
  body: AddToCartInput,
  availableStock: number,
): Promise<
  | { error: string; status: number }
  | { warning: string; adjustedQuantity: number }
  | null
> => {
  const existingItem = await drizzleDb.query.cartItems.findFirst({
    where: and(
      eq(cartItems.cartId, cartId),
      eq(cartItems.productId, body.productId),
      body.variationId
        ? eq(cartItems.variationId, body.variationId)
        : isNull(cartItems.variationId),
    ),
  });

  let warning: string | null = null;
  let adjustedQuantity: number | null = null;

  if (existingItem) {
    let newQuantity = existingItem.quantity + body.quantity;
    if (newQuantity > availableStock) {
      if (existingItem.quantity >= availableStock) {
        return {
          error: `You already have the maximum available quantity (${availableStock}) in your cart`,
          status: 400,
        };
      }
      const canAdd = availableStock - existingItem.quantity;
      newQuantity = availableStock;
      adjustedQuantity = newQuantity;
      warning = `Only ${availableStock} items available. Added ${canAdd} instead of ${body.quantity} (you already had ${existingItem.quantity} in your cart).`;
    }
    await drizzleDb
      .update(cartItems)
      .set({ quantity: newQuantity, updatedAt: new Date() })
      .where(eq(cartItems.id, existingItem.id));
  } else {
    let qty = body.quantity;
    if (qty > availableStock) {
      qty = availableStock;
      adjustedQuantity = qty;
      warning = `Only ${availableStock} items available. Added ${availableStock} to your cart.`;
    }
    await drizzleDb.insert(cartItems).values({
      cartId,
      productId: body.productId,
      variationId: body.variationId ?? null,
      quantity: qty,
      updatedAt: new Date(),
    });
  }

  if (warning && adjustedQuantity !== null) {
    return { warning, adjustedQuantity };
  }

  return null;
};

// Safely convert Date or string to ISO string (handles DB Date and Redis cached string)
const toISOString = (value: Date | string): string => {
  if (typeof value === "string") return value;
  return value.toISOString();
};

// Helper: Serialize cart for JSON response
const serializeCart = (cart: CartWithItems) => {
  return {
    ...cart,
    createdAt: toISOString(cart.createdAt),
    updatedAt: toISOString(cart.updatedAt),
    items: cart.items.map((item) => ({
      ...item,
      createdAt: toISOString(item.createdAt),
      updatedAt: toISOString(item.updatedAt),
      product: {
        ...item.product,
        createdAt: toISOString(item.product.createdAt),
        updatedAt: toISOString(item.product.updatedAt),
        variations: item.product.variations.map((v) => ({
          ...v,
          createdAt: toISOString(v.createdAt),
          updatedAt: toISOString(v.updatedAt),
        })),
      },
      variation: item.variation
        ? {
            ...item.variation,
            createdAt: toISOString(item.variation.createdAt),
            updatedAt: toISOString(item.variation.updatedAt),
          }
        : null,
    })),
  };
};

// Helper: Fetch cart from DB
const fetchCartFromDB = (userId?: string, sessionId?: string) => {
  if (userId) {
    return drizzleDb.query.carts.findFirst({
      where: eq(carts.userId, userId),
      with: {
        items: {
          with: {
            product: {
              with: {
                variations: {
                  where: (v, { isNull }) => isNull(v.deletedAt),
                },
              },
            },
            variation: true,
          },
        },
      },
    });
  }
  if (sessionId) {
    return drizzleDb.query.carts.findFirst({
      where: eq(carts.sessionId, sessionId),
      with: {
        items: {
          with: {
            product: {
              with: {
                variations: {
                  where: (v, { isNull }) => isNull(v.deletedAt),
                },
              },
            },
            variation: true,
          },
        },
      },
    });
  }
  return Promise.resolve(undefined);
};

// Helper: Resolve cart identity from request
const getCartIdentity = (
  request: NextRequest,
  session: { user?: { id?: string } } | null,
) => {
  const userId = session?.user?.id;
  const sessionId = request.cookies.get("cart_session")?.value;
  return { userId, sessionId };
};

// Helper: Build cache key for cart
const getCartCacheKey = (
  userId?: string,
  sessionId?: string,
): string | null => {
  if (userId) return CACHE_KEYS.CART_BY_USER(userId);
  if (sessionId) return CACHE_KEYS.CART_BY_SESSION(sessionId);
  return null;
};

// Helper: Find cart for deletion
const findCartForDeletion = (userId?: string, sessionId?: string) => {
  if (userId) {
    return drizzleDb.query.carts.findFirst({ where: eq(carts.userId, userId) });
  }
  if (sessionId) {
    return drizzleDb.query.carts.findFirst({
      where: eq(carts.sessionId, sessionId),
    });
  }
  return Promise.resolve(undefined);
};

// Helper: Set guest session cookie on response
const setGuestSessionCookie = (response: NextResponse, sessionId: string) => {
  response.cookies.set("cart_session", sessionId, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge: 60 * 60 * 24 * 30,
  });
};

// Get cart for current user/session
export const GET = async (request: NextRequest) => {
  try {
    const session = await auth();
    const { userId, sessionId } = getCartIdentity(request, session);
    const cacheKey = getCartCacheKey(userId, sessionId);

    if (!cacheKey) {
      return NextResponse.json({ cart: null });
    }

    const cart = await getCachedData(
      cacheKey,
      CACHE_TTL.CART,
      () => fetchCartFromDB(userId, sessionId),
      CACHE_TTL.CART_STALE,
    );

    if (!cart) {
      return NextResponse.json({ cart: null });
    }

    return NextResponse.json({
      cart: serializeCart(cart as unknown as CartWithItems),
    });
  } catch (error) {
    logError({ error, context: "cart_fetch" });
    return NextResponse.json(
      { error: "Failed to fetch cart" },
      { status: 500 },
    );
  }
};

// Add item to cart
export const POST = async (request: NextRequest) => {
  try {
    // Parallelize auth and body parsing (independent I/O)
    const [session, rawBody] = await Promise.all([auth(), request.json()]);

    // Validate input
    const parseResult = AddToCartSchema.safeParse(rawBody);

    if (!parseResult.success) {
      return handleValidationError(parseResult.error);
    }

    const body = parseResult.data;
    const cookieSessionId = request.cookies.get("cart_session")?.value;

    // Parallelize stock verification and cart lookup (independent DB queries)
    // Use allSettled so a cart lookup failure doesn't mask a stock error
    const [stockSettled, cartSettled] = await Promise.allSettled([
      verifyProductStock(body),
      getOrCreateCart(session, cookieSessionId),
    ]);

    // Check stock result first (most common early-exit path)
    if (stockSettled.status === "rejected") {
      throw stockSettled.reason;
    }
    const stockResult = stockSettled.value;
    if ("error" in stockResult) {
      return NextResponse.json(
        { error: stockResult.error },
        { status: stockResult.status },
      );
    }
    const { availableStock } = stockResult;

    // Now check cart result
    if (cartSettled.status === "rejected") {
      throw cartSettled.reason;
    }
    const { cart, sessionId } = cartSettled.value;

    // Add or update item (auto-caps to available stock)
    const itemResult = await addOrUpdateCartItem(cart.id, body, availableStock);
    if (itemResult && "error" in itemResult) {
      return NextResponse.json(
        { error: itemResult.error },
        { status: itemResult.status },
      );
    }
    const stockWarning =
      itemResult && "warning" in itemResult ? itemResult : null;

    // Fetch updated cart and invalidate cache in parallel
    const [updatedCart] = await Promise.all([
      drizzleDb.query.carts.findFirst({
        where: eq(carts.id, cart.id),
        with: {
          items: {
            with: {
              product: {
                with: {
                  variations: {
                    where: (v, { isNull }) => isNull(v.deletedAt),
                  },
                },
              },
              variation: true,
            },
          },
        },
      }),
      invalidateCartCache(session?.user?.id, sessionId),
    ]);

    if (!updatedCart) {
      return NextResponse.json({ error: "Cart not found" }, { status: 404 });
    }

    // Build response with session cookie for guests
    const responseBody: {
      cart: ReturnType<typeof serializeCart>;
      warning?: string;
      adjustedQuantity?: number;
    } = {
      cart: serializeCart(updatedCart as unknown as CartWithItems),
    };
    if (stockWarning) {
      responseBody.warning = stockWarning.warning;
      responseBody.adjustedQuantity = stockWarning.adjustedQuantity;
    }
    const response = NextResponse.json(responseBody, { status: 201 });

    if (sessionId) {
      setGuestSessionCookie(response, sessionId);
    }

    return response;
  } catch (error) {
    logError({ error, context: "cart_add" });
    return NextResponse.json(
      { error: "Failed to add to cart" },
      { status: 500 },
    );
  }
};

// Clear cart (for after order is placed)
export const DELETE = async (request: NextRequest) => {
  try {
    const session = await auth();
    const { userId, sessionId } = getCartIdentity(request, session);

    if (!userId && !sessionId) {
      return NextResponse.json({ success: true });
    }

    const cart = await findCartForDeletion(userId, sessionId);
    if (cart) {
      // Parallelize cart deletion and cache invalidation
      await Promise.all([
        drizzleDb.delete(carts).where(eq(carts.id, cart.id)),
        invalidateCartCache(userId, sessionId),
      ]);
    } else {
      await invalidateCartCache(userId, sessionId);
    }

    const response = NextResponse.json({ success: true });

    // Clear session cookie for guest users
    if (!userId && sessionId) {
      response.cookies.delete("cart_session");
    }

    return response;
  } catch (error) {
    logError({ error, context: "cart_clear" });
    return NextResponse.json(
      { error: "Failed to clear cart" },
      { status: 500 },
    );
  }
};
