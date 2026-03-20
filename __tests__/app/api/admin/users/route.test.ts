import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

const mockAuth = vi.hoisted(() => vi.fn());
const mockFindMany = vi.hoisted(() => vi.fn());

vi.mock("@/lib/auth", () => ({ auth: mockAuth }));
vi.mock("@/lib/db", () => ({
  drizzleDb: { query: { users: { findMany: mockFindMany } } },
}));
vi.mock("@/lib/schema", () => ({
  users: { createdAt: "createdAt", name: "name", email: "email" },
}));
vi.mock("drizzle-orm", () => ({
  desc: vi.fn((col: string) => col),
  lt: vi.fn(),
  ilike: vi.fn(),
  and: vi.fn(),
  or: vi.fn(),
}));

import { GET } from "@/app/api/admin/users/route";

const makeAdminUser = (overrides = {}) => ({
  id: "u1",
  name: "Alice",
  email: "alice@example.com",
  role: "USER",
  emailVerified: null,
  createdAt: new Date("2024-01-01"),
  updatedAt: new Date("2024-01-02"),
  image: null,
  orders: [{ id: "o1" }],
  ...overrides,
});

describe("GET /api/admin/users", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns 401 when not authenticated", async () => {
    mockAuth.mockResolvedValue(null);

    const response = await GET(
      new NextRequest("http://localhost/api/admin/users"),
    );
    const body = await response.json();

    expect(response.status).toBe(401);
    expect(body.success).toBe(false);
    expect(body.error).toBe("Not authenticated");
  });

  it("returns 403 when user is not admin", async () => {
    mockAuth.mockResolvedValue({
      user: { id: "user-1", role: "USER" },
    });

    const response = await GET(
      new NextRequest("http://localhost/api/admin/users"),
    );
    const body = await response.json();

    expect(response.status).toBe(403);
    expect(body.success).toBe(false);
    expect(body.error).toBe("Not authorized - Admin access required");
  });

  it("returns user list for admin users", async () => {
    mockAuth.mockResolvedValue({
      user: { id: "admin-1", role: "ADMIN" },
    });

    const mockUsers = [
      makeAdminUser({ orders: [{ id: "o1" }, { id: "o2" }] }),
      makeAdminUser({
        id: "u2",
        name: "Bob",
        email: "bob@example.com",
        role: "ADMIN",
        orders: [],
      }),
    ];

    mockFindMany.mockResolvedValue(mockUsers);

    const response = await GET(
      new NextRequest("http://localhost/api/admin/users"),
    );
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.success).toBe(true);
    expect(body.data.users).toHaveLength(2);
    expect(body.data.users[0].id).toBe("u1");
    expect(body.data.users[0]._count.orders).toBe(2);
    expect(body.data.users[1]._count.orders).toBe(0);
    expect(body.data.nextCursor).toBeNull();
    expect(body.data.hasMore).toBe(false);
  });

  it("returns hasMore=true and nextCursor when results exceed limit", async () => {
    mockAuth.mockResolvedValue({ user: { id: "admin-1", role: "ADMIN" } });

    const manyUsers = Array.from({ length: 21 }, (_, index) =>
      makeAdminUser({
        id: `u${index}`,
        email: `user${index}@test.com`,
        orders: [],
      }),
    );
    mockFindMany.mockResolvedValue(manyUsers);

    const response = await GET(
      new NextRequest("http://localhost/api/admin/users?limit=20"),
    );
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.data.hasMore).toBe(true);
    expect(body.data.nextCursor).not.toBeNull();
    expect(body.data.users).toHaveLength(20);
  });

  it("passes cursor param to where clause builder", async () => {
    mockAuth.mockResolvedValue({ user: { id: "admin-1", role: "ADMIN" } });
    mockFindMany.mockResolvedValue([makeAdminUser()]);

    const response = await GET(
      new NextRequest(
        "http://localhost/api/admin/users?cursor=2024-01-01T00:00:00.000Z",
      ),
    );
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(mockFindMany).toHaveBeenCalled();
    expect(body.data.users).toHaveLength(1);
  });

  it("passes search param to where clause builder", async () => {
    mockAuth.mockResolvedValue({ user: { id: "admin-1", role: "ADMIN" } });
    mockFindMany.mockResolvedValue([makeAdminUser({ name: "Alice" })]);

    const response = await GET(
      new NextRequest("http://localhost/api/admin/users?search=alice"),
    );
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.data.users[0].name).toBe("Alice");
  });

  it("serializes Date createdAt/updatedAt to ISO strings", async () => {
    mockAuth.mockResolvedValue({ user: { id: "admin-1", role: "ADMIN" } });
    mockFindMany.mockResolvedValue([makeAdminUser()]);

    const response = await GET(
      new NextRequest("http://localhost/api/admin/users"),
    );
    const body = await response.json();

    expect(typeof body.data.users[0].createdAt).toBe("string");
    expect(typeof body.data.users[0].updatedAt).toBe("string");
  });

  it("calls handleApiError on exception", async () => {
    mockAuth.mockResolvedValue({
      user: { id: "admin-1", role: "ADMIN" },
    });
    mockFindMany.mockRejectedValue(new Error("DB connection failed"));

    const response = await GET(
      new NextRequest("http://localhost/api/admin/users"),
    );
    const body = await response.json();

    expect(response.status).toBe(500);
    expect(body.success).toBe(false);
  });
});
