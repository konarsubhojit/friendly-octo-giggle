import { NextRequest, NextResponse } from "next/server";

export function proxy(request: NextRequest) {
  // Enforce HTTPS in both development and production
  const host = request.headers.get("host") || "";
  const proto = request.headers.get("x-forwarded-proto") || "http";

  if (proto === "http") {
    return NextResponse.redirect(
      `https://${host}${request.nextUrl.pathname}${request.nextUrl.search}`,
      {
        status: 301,
      },
    );
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/:path*"],
};
