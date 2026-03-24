import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { NextRequest } from "next/server";

vi.mock("@/lib/redis", () => ({
  getCachedData: vi.fn(
    async (_key: string, _ttl: number, fetcher: () => Promise<unknown>) =>
      fetcher(),
  ),
  isRedisAvailable: vi.fn(() => false),
}));

vi.mock("@/lib/logger", () => ({
  createLogger: () => ({
    info: vi.fn(),
    error: vi.fn(),
    warn: vi.fn(),
    debug: vi.fn(),
  }),
  logError: vi.fn(),
  logBusinessEvent: vi.fn(),
  logCacheOperation: vi.fn(),
  Timer: class {
    end() {}
  },
}));

import { GET } from "@/app/api/cron/refresh-rates/route";

const buildCronRequest = (hasCronHeader = true): NextRequest => {
  const request = new NextRequest(
    "http://localhost:3000/api/cron/refresh-rates",
  );
  if (hasCronHeader) {
    Object.defineProperty(request, "headers", {
      value: new Headers({ "user-agent": "vercel-cron/1.0" }),
    });
  }
  return request;
};

const mockJsonResponse = (body: unknown, ok = true): Response =>
  ({
    ok,
    status: ok ? 200 : 400,
    json: async () => body,
  }) as unknown as Response;

describe("GET /api/cron/refresh-rates", () => {
  beforeEach(() => {
    vi.stubGlobal("fetch", vi.fn());
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.unstubAllEnvs();
  });

  it("returns 401 for non-cron requests", async () => {
    const request = new NextRequest(
      "http://localhost:3000/api/cron/refresh-rates",
      { headers: { "user-agent": "Mozilla/5.0" } },
    );
    const res = await GET(request);
    expect(res.status).toBe(401);
  });

  it("returns 503 when EXCHANGE_RATE_API_KEY is not configured", async () => {
    const request = buildCronRequest();
    const res = await GET(request);
    expect(res.status).toBe(503);
  });

  it("refreshes exchange rates and returns them", async () => {
    vi.stubEnv("EXCHANGE_RATE_API_KEY", "test-key");
    vi.mocked(global.fetch).mockResolvedValueOnce(
      mockJsonResponse({
        result: "success",
        base_code: "INR",
        conversion_rates: {
          INR: 1,
          USD: 0.01193,
          EUR: 0.01098,
          GBP: 0.00943,
        },
      }),
    );

    const request = buildCronRequest();
    const res = await GET(request);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.data.rates.INR).toBe(1);
    expect(body.data.rates.USD).toBeCloseTo(0.01193, 5);
    expect(body.data.refreshedAt).toBeDefined();
  });

  it("returns 500 when the external API fails", async () => {
    vi.stubEnv("EXCHANGE_RATE_API_KEY", "test-key");
    vi.mocked(global.fetch).mockResolvedValueOnce(mockJsonResponse({}, false));

    const request = buildCronRequest();
    const res = await GET(request);
    expect(res.status).toBe(500);
  });

  it("authenticates via CRON_SECRET when set", async () => {
    vi.stubEnv("CRON_SECRET", "my-secret");
    vi.stubEnv("EXCHANGE_RATE_API_KEY", "test-key");

    const unauthorizedRequest = buildCronRequest();
    const res1 = await GET(unauthorizedRequest);
    expect(res1.status).toBe(401);

    vi.mocked(global.fetch).mockResolvedValueOnce(
      mockJsonResponse({
        result: "success",
        base_code: "INR",
        conversion_rates: { INR: 1, USD: 0.01193, EUR: 0.01098, GBP: 0.00943 },
      }),
    );

    const authorizedRequest = new NextRequest(
      "http://localhost:3000/api/cron/refresh-rates",
      { headers: { authorization: "Bearer my-secret" } },
    );
    const res2 = await GET(authorizedRequest);
    expect(res2.status).toBe(200);
  });
});
