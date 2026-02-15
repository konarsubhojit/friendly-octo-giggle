import { NextRequest, NextResponse } from 'next/server';
import { logApiRequest, generateRequestId, Timer } from './logger';
import { auth } from './auth';

export interface ApiContext {
  requestId: string;
  userId?: string;
  timer: Timer;
}

export type ApiHandler = (
  request: NextRequest,
  context: ApiContext
) => Promise<NextResponse>;

/**
 * Wrapper for API route handlers that adds logging and context
 */
export function withApiLogging(handler: ApiHandler) {
  return async (request: NextRequest): Promise<NextResponse> => {
    const requestId = generateRequestId();
    const timer = new Timer(`api.${request.method}.${request.nextUrl.pathname}`);
    
    // Get user session for context
    const session = await auth();
    const userId = session?.user?.id;
    
    const context: ApiContext = {
      requestId,
      userId,
      timer,
    };
    
    try {
      const response = await handler(request, context);
      const duration = timer.end({
        statusCode: response.status,
        userId,
      });
      
      logApiRequest({
        method: request.method,
        path: request.nextUrl.pathname,
        requestId,
        userId,
        duration,
        statusCode: response.status,
      });
      
      // Add request ID to response headers for tracing
      response.headers.set('X-Request-ID', requestId);
      
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
}

/**
 * Simple wrapper for API routes without authentication
 */
export function withLogging(
  handler: (request: NextRequest) => Promise<NextResponse>
) {
  return async (request: NextRequest): Promise<NextResponse> => {
    const requestId = generateRequestId();
    const timer = new Timer(`api.${request.method}.${request.nextUrl.pathname}`);
    
    try {
      const response = await handler(request);
      const duration = timer.end({ statusCode: response.status });
      
      logApiRequest({
        method: request.method,
        path: request.nextUrl.pathname,
        requestId,
        duration,
        statusCode: response.status,
      });
      
      response.headers.set('X-Request-ID', requestId);
      
      return response;
    } catch (error) {
      const duration = timer.end({ error: true });
      
      logApiRequest({
        method: request.method,
        path: request.nextUrl.pathname,
        requestId,
        duration,
        statusCode: 500,
      });
      
      throw error;
    }
  };
}
