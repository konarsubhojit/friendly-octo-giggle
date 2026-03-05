import { NextRequest, NextResponse } from "next/server";
import { drizzleDb } from "@/lib/db";
import { products, carts, cartItems } from "@/lib/schema";
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

// Helper: Verify product exists and has sufficient stock
async function verifyProductStock(
  body: AddToCartInput,
): Promise<
  | { product: ProductWithVariations; availableStock: number }
  | { error: string; status: number }
> {
  const product = await drizzleDb.query.products.findFirst({
    where: eq(products.id, body.productId),
    with: { variations: true },
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

  if (availableStock < body.quantity) {
    return { error: "Insufficient stock", status: 400 };
  }

  return { product, availableStock };
}

// Helper: Get or create cart for user/guest
async function getOrCreateCart(
  session: Session | null,
  sessionId: string | undefined,
): Promise<{ cart: { id: string }; sessionId: string | undefined }> {
  if (session?.user?.id) {
    let cart = await drizzleDb.query.carts.findFirst({
      where: eq(carts.userId, session.user.id),
    });
    if (!cart) {
      [cart] = await drizzleDb
        .insert(carts)
        .values({ userId: session.user.id, updatedAt: new Date() })
        .returning();
    }
    return { cart, sessionId: undefined };
  }

  // Guest user
  const guestSessionId =
    sessionId ?? `guest_${Date.now()}_${crypto.randomUUID()}`;
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
}

// Helper: Add or update cart item
async function addOrUpdateCartItem(
  cartId: string,
  body: AddToCartInput,
  availableStock: number,
): Promise<{ error: string; status: number } | null> {
  const existingItem = await drizzleDb.query.cartItems.findFirst({
    where: and(
      eq(cartItems.cartId, cartId),
      eq(cartItems.productId, body.productId),
      body.variationId
        ? eq(cartItems.variationId, body.variationId)
        : isNull(cartItems.variationId),
    ),
  });

  if (existingItem) {
    const newQuantity = existingItem.quantity + body.quantity;
    if (newQuantity > availableStock) {
      return { error: "Insufficient stock", status: 400 };
    }
    await drizzleDb
      .update(cartItems)
      .set({ quantity: newQuantity, updatedAt: new Date() })
      .where(eq(cartItems.id, existingItem.id));
  } else {
    await drizzleDb.insert(cartItems).values({
      cartId,
      productId: body.productId,
      variationId: body.variationId ?? null,
      quantity: body.quantity,
      updatedAt: new Date(),
    });
  }

  return null;
}

// Safely convert Date or string to ISO string (handles DB Date and Redis cached string)
function toISOString(value: Date | string): string {
  if (typeof value === "string") return value;
  return value.toISOString();
}

// Helper: Serialize cart for JSON response
function serializeCart(cart: CartWithItems) {
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
}

// Helper: Fetch cart from DB
function fetchCartFromDB(userId?: string, sessionId?: string) {
  if (userId) {
    return drizzleDb.query.carts.findFirst({
      where: eq(carts.userId, userId),
      with: {
        items: {
          with: {
            product: { with: { variations: true } },
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
            product: { with: { variations: true } },
            variation: true,
          },
        },
      },
    });
  }
  return Promise.resolve(undefined);
}

// Helper: Resolve cart identity from request
function getCartIdentity(
  request: NextRequest,
  session: { user?: { id?: string } } | null,
) {
  const userId = session?.user?.id;
  const sessionId = request.cookies.get("cart_session")?.value;
  return { userId, sessionId };
}

// Helper: Build cache key for cart
function getCartCacheKey(userId?: string, sessionId?: string): string | null {
  if (userId) return CACHE_KEYS.CART_BY_USER(userId);
  if (sessionId) return CACHE_KEYS.CART_BY_SESSION(sessionId);
  return null;
}

// Helper: Find cart for deletion
function findCartForDeletion(userId?: string, sessionId?: string) {
  if (userId) {
    return drizzleDb.query.carts.findFirst({ where: eq(carts.userId, userId) });
  }
  if (sessionId) {
    return drizzleDb.query.carts.findFirst({
      where: eq(carts.sessionId, sessionId),
    });
  }
  return Promise.resolve(undefined);
}

// Helper: Set guest session cookie on response
function setGuestSessionCookie(response: NextResponse, sessionId: string) {
  response.cookies.set("cart_session", sessionId, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge: 60 * 60 * 24 * 30,
  });
}

// Get cart for current user/session
export async function GET(request: NextRequest) {
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
}

// Add item to cart
export async function POST(request: NextRequest) {
  try {
    const session = await auth();
    const rawBody = await request.json();

    // Validate input
    const parseResult = AddToCartSchema.safeParse(rawBody);

    if (!parseResult.success) {
      return handleValidationError(parseResult.error);
    }

    const body = parseResult.data;

    // Verify product and stock
    const stockResult = await verifyProductStock(body);
    if ("error" in stockResult) {
      return NextResponse.json(
        { error: stockResult.error },
        { status: stockResult.status },
      );
    }
    const { availableStock } = stockResult;

    // Get or create cart
    const cookieSessionId = request.cookies.get("cart_session")?.value;
    const { cart, sessionId } = await getOrCreateCart(session, cookieSessionId);

    // Add or update item
    const itemError = await addOrUpdateCartItem(cart.id, body, availableStock);
    if (itemError) {
      return NextResponse.json(
        { error: itemError.error },
        { status: itemError.status },
      );
    }

    // Fetch updated cart
    const updatedCart = await drizzleDb.query.carts.findFirst({
      where: eq(carts.id, cart.id),
      with: {
        items: {
          with: {
            product: { with: { variations: true } },
            variation: true,
          },
        },
      },
    });

    if (!updatedCart) {
      return NextResponse.json({ error: "Cart not found" }, { status: 404 });
    }

    // Invalidate cart cache
    await invalidateCartCache(session?.user?.id, sessionId);

    // Build response with session cookie for guests
    const response = NextResponse.json(
      { cart: serializeCart(updatedCart as unknown as CartWithItems) },
      { status: 201 },
    );

    if (!session?.user?.id && sessionId) {
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
}

// Clear cart (for after order is placed)
export async function DELETE(request: NextRequest) {
  try {
    const session = await auth();
    const { userId, sessionId } = getCartIdentity(request, session);

    if (!userId && !sessionId) {
      return NextResponse.json({ success: true });
    }

    const cart = await findCartForDeletion(userId, sessionId);
    if (cart) {
      await drizzleDb.delete(carts).where(eq(carts.id, cart.id));
    }

    await invalidateCartCache(userId, sessionId);

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
}
