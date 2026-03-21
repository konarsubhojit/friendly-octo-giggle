import { NextRequest, NextResponse } from "next/server";
import { drizzleDb } from "@/lib/db";
import { cartItems } from "@/lib/schema";
import { eq } from "drizzle-orm";
import { auth } from "@/lib/auth";
import { UpdateCartItemSchema } from "@/lib/validations";
import { handleValidationError } from "@/lib/api-utils";
import { logError } from "@/lib/logger";
import { invalidateCartCache } from "@/lib/cache";

export const dynamic = "force-dynamic";

// Update cart item quantity
export const PATCH = async (
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) => {
  try {
    const { id } = await params;
    const session = await auth();
    const sessionId = request.cookies.get("cart_session")?.value;
    const rawBody = await request.json();

    // Validate input with Zod
    const parseResult = UpdateCartItemSchema.safeParse(rawBody);
    if (!parseResult.success) {
      return handleValidationError(parseResult.error);
    }
    const body = parseResult.data;

    // Get cart item
    const cartItem = await drizzleDb.query.cartItems.findFirst({
      where: eq(cartItems.id, id),
      with: {
        cart: true,
        product: {
          with: {
            variations: true,
          },
        },
        variation: true,
      },
    });

    if (!cartItem) {
      return NextResponse.json(
        { error: "Cart item not found" },
        { status: 404 },
      );
    }

    // Verify cart ownership
    const isOwner = session?.user?.id
      ? cartItem.cart.userId === session.user.id
      : cartItem.cart.sessionId === sessionId;

    if (!isOwner) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
    }

    // Check stock
    const availableStock = cartItem.variationId
      ? cartItem.variation?.stock || 0
      : cartItem.product.stock;

    if (body.quantity > availableStock) {
      return NextResponse.json(
        { error: "Insufficient stock" },
        { status: 400 },
      );
    }

    // Update quantity
    await drizzleDb
      .update(cartItems)
      .set({ quantity: body.quantity, updatedAt: new Date() })
      .where(eq(cartItems.id, id));

    // Invalidate cart cache
    await invalidateCartCache(session?.user?.id, sessionId);

    return NextResponse.json({ success: true });
  } catch (error) {
    logError({ error, context: "cart_item_update" });
    return NextResponse.json(
      { error: "Failed to update cart item" },
      { status: 500 },
    );
  }
};

// Delete cart item
export const DELETE = async (
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) => {
  try {
    const { id } = await params;
    const session = await auth();
    const sessionId = request.cookies.get("cart_session")?.value;

    // Get cart item
    const cartItem = await drizzleDb.query.cartItems.findFirst({
      where: eq(cartItems.id, id),
      with: {
        cart: true,
      },
    });

    if (!cartItem) {
      return NextResponse.json(
        { error: "Cart item not found" },
        { status: 404 },
      );
    }

    // Verify cart ownership
    const isOwner = session?.user?.id
      ? cartItem.cart.userId === session.user.id
      : cartItem.cart.sessionId === sessionId;

    if (!isOwner) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
    }

    // Delete item
    await drizzleDb.delete(cartItems).where(eq(cartItems.id, id));

    // Invalidate cart cache
    await invalidateCartCache(session?.user?.id, sessionId);

    return NextResponse.json({ success: true });
  } catch (error) {
    logError({ error, context: "cart_item_delete" });
    return NextResponse.json(
      { error: "Failed to delete cart item" },
      { status: 500 },
    );
  }
};
