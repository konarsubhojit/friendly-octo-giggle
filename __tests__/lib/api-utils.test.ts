import { describe, it, expect, vi, beforeEach } from "vitest";
import { isApiSuccess } from "@/lib/api-utils";

// We test the pure functions. NextResponse-dependent functions are tested
// via integration tests or with mocked NextResponse.

describe("isApiSuccess", () => {
  it("returns true for valid success response", () => {
    expect(isApiSuccess({ success: true, data: { id: 1 } })).toBe(true);
  });

  it("returns false for error response", () => {
    expect(isApiSuccess({ success: false, error: "fail" })).toBe(false);
  });

  it("returns false for null", () => {
    expect(isApiSuccess(null)).toBe(false);
  });

  it("returns false for undefined", () => {
    expect(isApiSuccess(undefined)).toBe(false);
  });

  it("returns false for string", () => {
    expect(isApiSuccess("hello")).toBe(false);
  });

  it("returns false for missing data field", () => {
    expect(isApiSuccess({ success: true })).toBe(false);
  });

  it("returns false for missing success field", () => {
    expect(isApiSuccess({ data: "test" })).toBe(false);
  });
});

// Test safeFetch with mocked global fetch
describe("safeFetch", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it("returns data on successful response", async () => {
    const { safeFetch } = await import("@/lib/api-utils");
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ data: { id: 1, name: "Test" } }),
      }),
    );

    const result = await safeFetch<{ id: number }>(
      "https://api.example.com/items",
    );
    expect(result.data).toEqual({ id: 1, name: "Test" });
    expect(result.error).toBeUndefined();
  });

  it("returns raw data when no .data wrapper", async () => {
    const { safeFetch } = await import("@/lib/api-utils");
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ id: 1 }),
      }),
    );

    const result = await safeFetch("https://api.example.com/items");
    expect(result.data).toEqual({ id: 1 });
  });

  it("returns error on failed response", async () => {
    const { safeFetch } = await import("@/lib/api-utils");
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: false,
        json: () => Promise.resolve({ error: "Not found" }),
      }),
    );

    const result = await safeFetch("https://api.example.com/missing");
    expect(result.error).toBe("Not found");
    expect(result.data).toBeUndefined();
  });

  it("returns fallback error when response JSON fails", async () => {
    const { safeFetch } = await import("@/lib/api-utils");
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: false,
        json: () => Promise.reject(new Error("parse error")),
      }),
    );

    const result = await safeFetch("https://api.example.com/fail");
    expect(result.error).toBe("Request failed");
  });

  it("returns network error on fetch failure", async () => {
    const { safeFetch } = await import("@/lib/api-utils");
    vi.stubGlobal(
      "fetch",
      vi.fn().mockRejectedValue(new Error("Network down")),
    );

    const result = await safeFetch("https://api.example.com/timeout");
    expect(result.error).toBe("Network down");
  });

  it("returns generic error on non-Error throw", async () => {
    const { safeFetch } = await import("@/lib/api-utils");
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue("string error"));

    const result = await safeFetch("https://api.example.com/bad");
    expect(result.error).toBe("Network error");
  });
});
