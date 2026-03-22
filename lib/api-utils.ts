import { NextResponse } from "next/server";
import { ZodError } from "zod";
import { logError } from "@/lib/logger";

export const parseOffsetParam = (offsetParam: string | null): number => {
  const parsed = Number.parseInt(offsetParam ?? "0", 10);
  return Number.isNaN(parsed) ? 0 : Math.max(0, parsed);
};

export const apiSuccess = <T>(data: T, status = 200) =>
  NextResponse.json({ success: true, data }, { status });

export const apiError = (
  error: string,
  status = 500,
  details?: Record<string, unknown>,
) => NextResponse.json({ success: false, error, details }, { status });

export const handleValidationError = (error: ZodError<unknown>) => {
  const details = error.issues.reduce(
    (acc, err) => {
      const path = err.path.join(".");
      acc[path] = err.message;
      return acc;
    },
    {} as Record<string, string>,
  );

  return apiError("Validation failed", 400, details);
};

export const handleApiError = (error: unknown) => {
  logError({ error, context: "api_error" });

  if (error instanceof ZodError) {
    return handleValidationError(error);
  }

  if (error instanceof Error) {
    return apiError(error.message);
  }

  return apiError("An unexpected error occurred");
};

export const safeFetch = async <T>(
  url: string,
  options?: RequestInit,
): Promise<{ data?: T; error?: string }> => {
  try {
    const response = await fetch(url, options);

    const handlers: Record<
      string,
      () => Promise<{ data?: T; error?: string }>
    > = {
      true: async () => {
        const data = await response.json();
        return { data: data.data || data };
      },
      false: async () => {
        const errorData = await response.json().catch(() => ({}));
        return { error: errorData.error || "Request failed" };
      },
    };

    return handlers[response.ok.toString()]();
  } catch (error) {
    return { error: error instanceof Error ? error.message : "Network error" };
  }
};

export const isApiSuccess = <T>(
  response: unknown,
): response is { success: true; data: T } =>
  typeof response === "object" &&
  response !== null &&
  "success" in response &&
  response.success === true &&
  "data" in response;

export const asyncHandler =
  <T extends unknown[], R>(handler: (...args: T) => Promise<R>) =>
  async (...args: T): Promise<R | NextResponse> => {
    try {
      return await handler(...args);
    } catch (error) {
      return handleApiError(error);
    }
  };
