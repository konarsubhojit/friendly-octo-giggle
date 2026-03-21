import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

const mockEncode = vi.hoisted(() => vi.fn());

vi.mock("next-auth/jwt", () => ({
  encode: mockEncode,
}));

describe("GET /api/dev/copilot-auth", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.resetModules();
    vi.unstubAllEnvs();
    mockEncode.mockResolvedValue("encoded-session-token");
  });

  const loadHandler = async () => {
    const routeModule = await import("@/app/api/dev/copilot-auth/route");
    return routeModule.GET;
  };

  it("returns 404 outside development", async () => {
    vi.stubEnv("NODE_ENV", "test");
    const GET = await loadHandler();

    const response = await GET(
      new NextRequest("http://localhost/api/dev/copilot-auth"),
    );

    expect(response.status).toBe(404);
    await expect(response.json()).resolves.toEqual({ error: "Not Found" });
  });

  it("returns 401 when the dev key is missing", async () => {
    vi.stubEnv("NODE_ENV", "development");
    const GET = await loadHandler();

    const response = await GET(
      new NextRequest("http://localhost/api/dev/copilot-auth", {
        headers: { "x-copilot-dev-key": "provided-key" },
      }),
    );

    expect(response.status).toBe(401);
    await expect(response.json()).resolves.toEqual({ error: "Unauthorized" });
  });

  it("returns 500 when NEXTAUTH_SECRET is missing", async () => {
    vi.stubEnv("NODE_ENV", "development");
    vi.stubEnv("COPILOT_DEV_KEY", "expected-key");
    const GET = await loadHandler();

    const response = await GET(
      new NextRequest("http://localhost/api/dev/copilot-auth", {
        headers: { "x-copilot-dev-key": "expected-key" },
      }),
    );

    expect(response.status).toBe(500);
    await expect(response.json()).resolves.toEqual({
      error: "NEXTAUTH_SECRET not configured",
    });
  });

  it("returns 200 and sets the session cookie when configured", async () => {
    vi.stubEnv("NODE_ENV", "development");
    vi.stubEnv("COPILOT_DEV_KEY", "expected-key");
    vi.stubEnv("NEXTAUTH_SECRET", "test-secret");
    const GET = await loadHandler();

    const response = await GET(
      new NextRequest("http://localhost/api/dev/copilot-auth", {
        headers: { "x-copilot-dev-key": "expected-key" },
      }),
    );

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({ ok: true });
    expect(mockEncode).toHaveBeenCalledWith(
      expect.objectContaining({
        secret: "test-secret",
        salt: "next-auth.session-token",
      }),
    );
    expect(response.headers.get("set-cookie")).toContain(
      "next-auth.session-token=encoded-session-token",
    );
  });
});
