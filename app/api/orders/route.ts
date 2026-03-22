import { NextRequest, NextResponse } from "next/server";
import { withLogging } from "@/lib/api-middleware";
import { logBusinessEvent, logError } from "@/lib/logger";
import { auth } from "@/lib/auth";
import {
  createOrderForUser,
  getUserOrders,
  isOrderRequestError,
} from "@/lib/order-service";

export const dynamic = "force-dynamic";

const handleGet = async (request: NextRequest) => {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json(
        { error: "Authentication required" },
        { status: 401 },
      );
    }

    const result = await getUserOrders({
      requestUrl: request.url,
      userId: session.user.id,
    });

    return NextResponse.json(result);
  } catch (error) {
    logError({
      error,
      context: "fetch_user_orders",
    });
    return NextResponse.json(
      { error: "Failed to fetch orders" },
      { status: 500 },
    );
  }
};

const handlePost = async (request: NextRequest) => {
  try {
    const session = await auth();

    if (!session?.user?.id) {
      logBusinessEvent({
        event: "order_create_failed",
        details: { reason: "not_authenticated" },
        success: false,
      });
      return NextResponse.json(
        { error: "Authentication required. Please sign in to place orders." },
        { status: 401 },
      );
    }

    const body = await request.json();
    const result = await createOrderForUser({
      body,
      user: {
        id: session.user.id,
        name: session.user.name,
        email: session.user.email,
      },
    });

    return NextResponse.json(result, { status: 201 });
  } catch (error) {
    if (isOrderRequestError(error)) {
      return NextResponse.json(
        { error: error.message },
        { status: error.status },
      );
    }

    logError({
      error,
      context: "order_creation",
      additionalInfo: {
        path: request.nextUrl.pathname,
      },
    });
    return NextResponse.json(
      { error: "Failed to create order" },
      { status: 500 },
    );
  }
};

export const GET = withLogging(handleGet);
export const POST = withLogging(handlePost);
