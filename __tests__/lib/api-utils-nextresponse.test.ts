/**
 * Supplementary tests for api-utils.ts NextResponse-dependent functions.
 */
import { describe, it, expect, vi } from "vitest";
import { ZodError } from "zod";

// Mock NextResponse
vi.mock("next/server", () => ({
  NextResponse: {
    json: vi.fn((body, init) => ({
      body,
      status: init?.status ?? 200,
      headers: new Map(),
    })),
  },
}));

vi.mock("@/lib/logger", () => ({
  logError: vi.fn(),
}));

describe("apiSuccess", () => {
  it("returns success response with data", async () => {
    const { apiSuccess } = await import("@/lib/api-utils");
    const response = apiSuccess({ id: 1 });
    expect(response.body).toEqual({ success: true, data: { id: 1 } });
    expect(response.status).toBe(200);
  });

  it("accepts custom status code", async () => {
    const { apiSuccess } = await import("@/lib/api-utils");
    const response = apiSuccess({ created: true }, 201);
    expect(response.status).toBe(201);
  });
});

describe("apiError", () => {
  it("returns error response with message", async () => {
    const { apiError } = await import("@/lib/api-utils");
    const response = apiError("Not found", 404);
    expect(response.body).toMatchObject({ success: false, error: "Not found" });
    expect(response.status).toBe(404);
  });

  it("defaults to 500 status", async () => {
    const { apiError } = await import("@/lib/api-utils");
    const response = apiError("Server error");
    expect(response.status).toBe(500);
  });

  it("includes details when provided", async () => {
    const { apiError } = await import("@/lib/api-utils");
    const response = apiError("Validation failed", 400, { name: "required" });
    expect(response.body).toMatchObject({
      details: { name: "required" },
    });
  });
});

describe("handleValidationError", () => {
  it("returns 400 with field errors from ZodError", async () => {
    const { handleValidationError } = await import("@/lib/api-utils");
    // Create a ZodError manually
    const zodError = new ZodError([
      {
        code: "too_small",
        minimum: 1,
        inclusive: true,
        exact: false,
        message: "String must contain at least 1 character(s)",
        path: ["name"],
      } as never,
    ]);
    const response = handleValidationError(zodError);
    expect(response.status).toBe(400);
    expect(response.body).toMatchObject({
      success: false,
      error: "Validation failed",
    });
  });
});

describe("handleApiError", () => {
  it("handles ZodError", async () => {
    const { handleApiError } = await import("@/lib/api-utils");
    const zodError = new ZodError([
      {
        code: "invalid_type",
        expected: "string",
        path: ["email"],
        message: "Expected string, received number",
      } as never,
    ]);
    const response = handleApiError(zodError);
    expect(response.status).toBe(400);
  });

  it("handles regular Error", async () => {
    const { handleApiError } = await import("@/lib/api-utils");
    const response = handleApiError(new Error("Something failed"));
    expect(response.body).toMatchObject({ error: "Something failed" });
  });

  it("handles unknown error type", async () => {
    const { handleApiError } = await import("@/lib/api-utils");
    const response = handleApiError("string error");
    expect(response.body).toMatchObject({
      error: "An unexpected error occurred",
    });
  });

  it("calls logError", async () => {
    const { handleApiError } = await import("@/lib/api-utils");
    const { logError } = await import("@/lib/logger");
    handleApiError(new Error("test"));
    expect(logError).toHaveBeenCalled();
  });
});

describe("asyncHandler", () => {
  it("calls wrapped handler and returns result", async () => {
    const { asyncHandler } = await import("@/lib/api-utils");
    const handler = vi.fn().mockResolvedValue("result");
    const wrapped = asyncHandler(handler);
    const result = await wrapped("arg1");
    expect(result).toBe("result");
    expect(handler).toHaveBeenCalledWith("arg1");
  });

  it("catches handler errors and returns error response", async () => {
    const { asyncHandler } = await import("@/lib/api-utils");
    const handler = vi.fn().mockRejectedValue(new Error("Handler failed"));
    const wrapped = asyncHandler(handler);
    const result = await wrapped();
    expect((result as { body: { error: string } }).body.error).toBe(
      "Handler failed",
    );
  });
});
