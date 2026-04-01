import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import {
  getCheckoutRequestStatusForUser,
  isCheckoutRequestError,
} from "@/features/cart/services/checkout-service";
import { withLogging } from "@/lib/api-middleware";
import { logError } from "@/lib/logger";

export const dynamic = "force-dynamic";

const handleGet = async (
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) => {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json(
        { error: "Authentication required" },
        { status: 401 },
      );
    }

    const { id } = await params;
    const result = await getCheckoutRequestStatusForUser({
      checkoutRequestId: id,
      userId: session.user.id,
    });

    return NextResponse.json(result);
  } catch (error) {
    if (isCheckoutRequestError(error)) {
      return NextResponse.json(
        { error: error.message },
        { status: error.status },
      );
    }

    logError({
      error,
      context: "checkout_request_status",
      additionalInfo: {
        path: request.nextUrl.pathname,
      },
    });
    return NextResponse.json(
      { error: "Failed to fetch checkout request status" },
      { status: 500 },
    );
  }
};

export const GET = withLogging(handleGet);
