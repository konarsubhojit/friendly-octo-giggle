import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";
import { PATCH, GET } from "@/app/api/admin/users/[id]/route";

vi.mock("@/lib/db", () => ({
  drizzleDb: {
    query: { users: { findFirst: vi.fn() } },
    update: vi.fn(() => ({
      set: vi.fn(() => ({
        where: vi.fn(() => ({
          returning: vi.fn(),
        })),
      })),
    })),
  },
}));
vi.mock("@/lib/schema", () => ({ users: { id: "id", role: "role" } }));
vi.mock("drizzle-orm", () => ({ eq: vi.fn() }));
vi.mock("@/lib/auth", () => ({ auth: vi.fn() }));
vi.mock("@/lib/redis", () => ({
  getCachedData: vi.fn(),
  invalidateCache: vi.fn(),
}));
vi.mock("@/lib/logger", () => ({ logError: vi.fn() }));

import { drizzleDb } from "@/lib/db";
import { auth } from "@/lib/auth";
import { getCachedData, invalidateCache } from "@/lib/redis";

const mockAuth = vi.mocked(auth);
const mockGetCachedData = vi.mocked(getCachedData);
const mockInvalidateCache = vi.mocked(invalidateCache);

const adminSession = { user: { id: "admin1", role: "ADMIN" } };

function makeRequest(body?: Record<string, unknown>) {
  return new NextRequest("http://localhost/api/admin/users/user1", {
    method: body ? "PATCH" : "GET",
    ...(body ? { body: JSON.stringify(body) } : {}),
  });
}

function makeParams(id = "user1") {
  return { params: Promise.resolve({ id }) };
}

describe("PATCH /api/admin/users/[id]", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns 401 when not authenticated", async () => {
    mockAuth.mockResolvedValue(null as never);
    const res = await PATCH(makeRequest({ role: "CUSTOMER" }), makeParams());
    expect(res.status).toBe(401);
  });

  it("returns 403 when not admin", async () => {
    mockAuth.mockResolvedValue({
      user: { id: "u1", role: "CUSTOMER" },
    } as never);
    const res = await PATCH(makeRequest({ role: "ADMIN" }), makeParams());
    expect(res.status).toBe(403);
  });

  it("returns 403 when trying to change own role", async () => {
    mockAuth.mockResolvedValue(adminSession as never);
    const res = await PATCH(
      makeRequest({ role: "CUSTOMER" }),
      makeParams("admin1"),
    );
    const data = await res.json();
    expect(res.status).toBe(403);
    expect(data.error).toBe("Cannot modify your own role");
  });

  it("returns 400 for invalid role", async () => {
    mockAuth.mockResolvedValue(adminSession as never);
    const res = await PATCH(makeRequest({ role: "SUPERADMIN" }), makeParams());
    expect(res.status).toBe(400);
  });

  it("updates user role successfully", async () => {
    mockAuth.mockResolvedValue(adminSession as never);
    const updatedUser = {
      id: "user1",
      name: "Test",
      email: "test@test.com",
      role: "ADMIN",
    };
    const returning = vi.fn().mockResolvedValue([updatedUser]);
    const where = vi.fn(() => ({ returning }));
    const set = vi.fn(() => ({ where }));
    vi.mocked(drizzleDb.update).mockReturnValue({ set } as never);
    mockInvalidateCache.mockResolvedValue(undefined as never);

    const res = await PATCH(makeRequest({ role: "ADMIN" }), makeParams());
    const data = await res.json();

    expect(res.status).toBe(200);
    expect(data.data.user).toEqual(updatedUser);
    expect(drizzleDb.update).toHaveBeenCalled();
    expect(mockInvalidateCache).toHaveBeenCalledWith("admin:users:*");
  });
});

describe("GET /api/admin/users/[id]", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns 401 when not authenticated", async () => {
    mockAuth.mockResolvedValue(null as never);
    const res = await GET(makeRequest(), makeParams());
    expect(res.status).toBe(401);
  });

  it("returns 404 when user not found", async () => {
    mockAuth.mockResolvedValue(adminSession as never);
    mockGetCachedData.mockResolvedValue(null as never);
    const res = await GET(makeRequest(), makeParams());
    expect(res.status).toBe(404);
  });

  it("returns user on success", async () => {
    mockAuth.mockResolvedValue(adminSession as never);
    const user = {
      id: "user1",
      name: "Test User",
      email: "test@test.com",
      role: "CUSTOMER",
      emailVerified: null,
      createdAt: "2024-01-01",
      updatedAt: "2024-01-01",
      image: null,
      _count: { orders: 2, sessions: 1 },
    };
    mockGetCachedData.mockResolvedValue(user as never);

    const res = await GET(makeRequest(), makeParams());
    const data = await res.json();

    expect(res.status).toBe(200);
    expect(data.data.user).toEqual(user);
    expect(mockGetCachedData).toHaveBeenCalledWith(
      "admin:user:user1",
      300,
      expect.any(Function),
      30,
    );
  });

  it("returns 403 when not admin in GET", async () => {
    mockAuth.mockResolvedValue({
      user: { id: "u1", role: "CUSTOMER" },
    } as never);
    const res = await GET(makeRequest(), makeParams());
    expect(res.status).toBe(403);
  });

  it("exercises getCachedData fetcher callback for user with data", async () => {
    mockAuth.mockResolvedValue(adminSession as never);

    const mockUserData = {
      id: "user1",
      name: "Fetched User",
      email: "fetched@test.com",
      role: "CUSTOMER",
      emailVerified: null,
      createdAt: new Date("2024-01-01"),
      updatedAt: new Date("2024-01-01"),
      image: null,
      orders: [{ id: "o1" }, { id: "o2" }],
      sessions: [{ sessionToken: "s1" }],
    };

    mockGetCachedData.mockImplementation(
      async (_key: string, _ttl: number, fetcher: () => Promise<unknown>) => fetcher(),
    );
    (drizzleDb.query.users.findFirst as ReturnType<typeof vi.fn>).mockResolvedValue(
      mockUserData,
    );

    const res = await GET(makeRequest(), makeParams());
    const data = await res.json();

    expect(res.status).toBe(200);
    expect(data.data.user.name).toBe("Fetched User");
    expect(data.data.user._count.orders).toBe(2);
    expect(data.data.user._count.sessions).toBe(1);
  });

  it("exercises getCachedData fetcher callback when user is not found", async () => {
    mockAuth.mockResolvedValue(adminSession as never);

    mockGetCachedData.mockImplementation(
      async (_key: string, _ttl: number, fetcher: () => Promise<unknown>) => fetcher(),
    );
    (drizzleDb.query.users.findFirst as ReturnType<typeof vi.fn>).mockResolvedValue(
      null,
    );

    const res = await GET(makeRequest(), makeParams());
    const data = await res.json();

    expect(res.status).toBe(404);
    expect(data.error).toBe("User not found");
  });

  it("returns 500 on error in PATCH", async () => {
    mockAuth.mockResolvedValue(adminSession as never);
    vi.mocked(drizzleDb.update).mockImplementation(() => {
      throw new Error("DB error");
    });

    const res = await PATCH(makeRequest({ role: "ADMIN" }), makeParams());
    expect(res.status).toBe(500);
  });

  it("returns 500 on error in GET", async () => {
    mockAuth.mockResolvedValue(adminSession as never);
    mockGetCachedData.mockRejectedValue(new Error("Cache error"));

    const res = await GET(makeRequest(), makeParams());
    expect(res.status).toBe(500);
  });
});
