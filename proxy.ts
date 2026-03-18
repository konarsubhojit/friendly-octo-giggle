import { NextRequest, NextResponse } from "next/server";

const isDev = process.env.NODE_ENV === "development";

export function proxy(request: NextRequest) {
  const host = request.headers.get("host") || "";
  const proto = request.headers.get("x-forwarded-proto") || "http";

  if (!isDev && proto === "http") {
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
