import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";

// GET /s/[key] — resolves a share token and redirects to the product page,
// pre-selecting the variation via the ?v= query parameter when present.
export const GET = async (
  request: NextRequest,
  { params }: { params: Promise<{ key: string }> },
): Promise<NextResponse> => {
  const { key } = await params;

  const share = await db.shares.resolve(key);

  if (!share) {
    return NextResponse.redirect(new URL("/", request.url));
  }

  const destination = share.variationId
    ? `/products/${share.productId}?v=${share.variationId}`
    : `/products/${share.productId}`;

  return NextResponse.redirect(new URL(destination, request.url));
};
