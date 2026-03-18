import { NextRequest, NextResponse } from "next/server";
import { logApiRequest, generateRequestId, Timer } from "./logger";
import { auth } from "./auth";

export interface ApiContext {
  requestId: string;
  userId?: string;
  timer: Timer;
}

export type ApiHandler = (
  request: NextRequest,
  context: ApiContext,
) => Promise<NextResponse>;

interface LoggingOptions {
  requireAuth?: boolean;
}

/**
 * Core logging wrapper — shared logic for both authenticated and unauthenticated routes.
 * SRP: single place for request lifecycle (timing, logging, tracing).
 * OCP: new options can be added via LoggingOptions without modifying existing code.
 */
function createLoggingWrapper(options: LoggingOptions = {}) {
  const { requireAuth = false } = options;

  return (
    handler: ApiHandler | ((request: NextRequest) => Promise<NextResponse>),
  ) => {
    return async (request: NextRequest): Promise<NextResponse> => {
      const requestId = generateRequestId();
      const timer = new Timer(
        `api.${request.method}.${request.nextUrl.pathname}`,
      );

      let userId: string | undefined;
      if (requireAuth) {
        const session = await auth();
        userId = session?.user?.id;
      }

      const context: ApiContext = { requestId, userId, timer };

      try {
        const response = requireAuth
          ? await (handler as ApiHandler)(request, context)
          : await (handler as (request: NextRequest) => Promise<NextResponse>)(
              request,
            );

        const duration = timer.end({ statusCode: response.status, userId });

        logApiRequest({
          method: request.method,
          path: request.nextUrl.pathname,
          requestId,
          userId,
          duration,
          statusCode: response.status,
        });

        response.headers.set("X-Request-ID", requestId);
        return response;
      } catch (error) {
        const duration = timer.end({ error: true });

        logApiRequest({
          method: request.method,
          path: request.nextUrl.pathname,
          requestId,
          userId,
          duration,
          statusCode: 500,
        });

        throw error;
      }
    };
  };
}

/**
 * Wrapper for API route handlers that adds logging, context, and auth session
 */
export function withApiLogging(handler: ApiHandler) {
  return createLoggingWrapper({ requireAuth: true })(handler);
}

/**
 * Simple wrapper for API routes without authentication
 */
export function withLogging(
  handler: (request: NextRequest) => Promise<NextResponse>,
) {
  return createLoggingWrapper({ requireAuth: false })(handler);
}
