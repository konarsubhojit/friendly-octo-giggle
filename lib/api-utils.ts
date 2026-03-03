import { NextResponse } from 'next/server';
import { ZodError } from 'zod';

// Type-safe success response
export function apiSuccess<T>(data: T, status = 200) {
  return NextResponse.json(
    { success: true, data },
    { status }
  );
}

// Type-safe error response
export function apiError(
  error: string,
  status = 500,
  details?: Record<string, unknown>
) {
  return NextResponse.json(
    { success: false, error, details },
    { status }
  );
}

// Handle Zod validation errors
export function handleValidationError(error: ZodError<unknown>) {
  const details = error.issues.reduce((acc, err) => {
    const path = err.path.join('.');
    acc[path] = err.message;
    return acc;
  }, {} as Record<string, string>);

  return apiError('Validation failed', 400, details);
}

// Generic error handler
export function handleApiError(error: unknown) {
  console.error('API Error:', error);

  if (error instanceof ZodError) {
    return handleValidationError(error);
  }

  if (error instanceof Error) {
    return apiError(error.message);
  }

  return apiError('An unexpected error occurred');
}

// Type-safe fetch wrapper with error handling
export async function safeFetch<T>(
  url: string,
  options?: RequestInit
): Promise<{ data?: T; error?: string }> {
  try {
    const response = await fetch(url, options);

    const handlers: Record<string, () => Promise<{ data?: T; error?: string }>> = {
      true: async () => {
        const data = await response.json();
        return { data: data.data || data };
      },
      false: async () => {
        const errorData = await response.json().catch(() => ({}));
        return { error: errorData.error || 'Request failed' };
      }
    };

    return handlers[response.ok.toString()]();
  } catch (error) {
    return { error: error instanceof Error ? error.message : 'Network error' };
  }
}

// Type guard for checking if response is successful
export function isApiSuccess<T>(
  response: unknown
): response is { success: true; data: T } {
  return (
    typeof response === 'object' &&
    response !== null &&
    'success' in response &&
    response.success === true &&
    'data' in response
  );
}

// Async handler wrapper with error catching
export function asyncHandler<T extends unknown[], R>(
  handler: (...args: T) => Promise<R>
) {
  return async (...args: T): Promise<R | NextResponse> => {
    try {
      return await handler(...args);
    } catch (error) {
      return handleApiError(error);
    }
  };
}
