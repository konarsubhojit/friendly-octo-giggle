import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { AddToCartSchema } from "@/features/cart/validations";
import { handleValidationError } from "@/lib/api-utils";
import { logError } from "@/lib/logger";
import {
  addItemToCart,
  buildGuestSessionCookieOptions,
  clearCart,
  getCart,
  getCartIdentity,
  isCartRequestError,
} from "@/features/cart/services/cart-service";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  try {
    const session = await auth();
    const identity = getCartIdentity(
      session,
      request.cookies.get("cart_session")?.value,
    );
    const result = await getCart(identity);

    return NextResponse.json(result);
  } catch (error) {
    logError({ error, context: "cart_fetch" });
    return NextResponse.json(
      { error: "Failed to fetch cart" },
      { status: 500 },
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const [session, rawBody] = await Promise.all([auth(), request.json()]);

    const parseResult = AddToCartSchema.safeParse(rawBody);

    if (!parseResult.success) {
      return handleValidationError(parseResult.error);
    }

    const body = parseResult.data;
    const result = await addItemToCart(
      session,
      body,
      request.cookies.get("cart_session")?.value,
    );

    const responseBody = {
      cart: result.cart,
      ...(result.warning
        ? {
            warning: result.warning,
            adjustedQuantity: result.adjustedQuantity,
          }
        : {}),
    };
    const response = NextResponse.json(responseBody, { status: 201 });

    if (result.sessionId) {
      response.cookies.set(
        "cart_session",
        result.sessionId,
        buildGuestSessionCookieOptions(),
      );
    }

    return response;
  } catch (error) {
    if (isCartRequestError(error)) {
      return NextResponse.json(
        { error: error.message },
        { status: error.status },
      );
    }

    logError({ error, context: "cart_add" });
    return NextResponse.json(
      { error: "Failed to add to cart" },
      { status: 500 },
    );
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const session = await auth();
    const identity = getCartIdentity(
      session,
      request.cookies.get("cart_session")?.value,
    );
    await clearCart(identity);

    const response = NextResponse.json({ success: true });

    if (!identity.userId && identity.sessionId) {
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
