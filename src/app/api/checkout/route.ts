import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import {
  enqueueCheckoutForUser,
  isCheckoutRequestError,
} from "@/features/cart/services/checkout-service";
import { withLogging } from "@/lib/api-middleware";
import { logBusinessEvent, logError } from "@/lib/logger";

export const dynamic = "force-dynamic";

const handlePost = async (request: NextRequest) => {
  try {
    const session = await auth();

    if (!session?.user?.id) {
      logBusinessEvent({
        event: "checkout_request_failed",
        details: { reason: "not_authenticated" },
        success: false,
      });
      return NextResponse.json(
        { error: "Authentication required. Please sign in to place orders." },
        { status: 401 },
      );
    }

    const body = await request.json();
    const result = await enqueueCheckoutForUser({
      body,
      user: {
        id: session.user.id,
        name: session.user.name,
        email: session.user.email,
      },
    });

    return NextResponse.json(result, { status: 202 });
  } catch (error) {
    if (isCheckoutRequestError(error)) {
      return NextResponse.json(
        { error: error.message },
        { status: error.status },
      );
    }

    logError({
      error,
      context: "checkout_request_creation",
      additionalInfo: {
        path: request.nextUrl.pathname,
      },
    });
    return NextResponse.json(
      { error: "Failed to create checkout request" },
      { status: 500 },
    );
  }
};

export const POST = withLogging(handlePost);
