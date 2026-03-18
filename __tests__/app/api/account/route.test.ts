import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

const mockAuth = vi.hoisted(() => vi.fn());
const mockFindFirst = vi.hoisted(() => vi.fn());
const mockUpdateSet = vi.hoisted(() => vi.fn());
const mockUpdateWhere = vi.hoisted(() => vi.fn());

vi.mock("@/lib/auth", () => ({
  auth: mockAuth,
}));

vi.mock("@/lib/db", () => ({
  drizzleDb: {
    query: {
      users: {
        findFirst: mockFindFirst,
      },
    },
    update: vi.fn(() => ({
      set: mockUpdateSet.mockReturnValue({
        where: mockUpdateWhere.mockResolvedValue(undefined),
      }),
    })),
  },
}));

vi.mock("@/lib/schema", () => ({
  users: {
    id: "id",
    email: "email",
    phoneNumber: "phoneNumber",
    name: "name",
  },
}));

vi.mock("@/lib/logger", () => ({
  logError: vi.fn(),
}));

vi.mock("drizzle-orm", () => ({
  eq: vi.fn((...args: unknown[]) => ({ op: "eq", args })),
  and: vi.fn((...args: unknown[]) => ({ op: "and", args })),
  ne: vi.fn((...args: unknown[]) => ({ op: "ne", args })),
}));

describe("GET /api/account", () => {
  let GET: () => Promise<Response>;

  beforeEach(async () => {
    vi.clearAllMocks();
    const mod = await import("@/app/api/account/route");
    GET = mod.GET;
  });

  it("returns 401 when not authenticated", async () => {
    mockAuth.mockResolvedValue(null);
    const res = await GET();
    expect(res.status).toBe(401);
  });

  it("returns user profile when authenticated", async () => {
    mockAuth.mockResolvedValue({ user: { id: "user-1" } });
    mockFindFirst.mockResolvedValue({
      id: "user-1",
      name: "Test User",
      email: "test@example.com",
      phoneNumber: "+1234567890",
      image: null,
      role: "CUSTOMER",
      passwordHash: "hashed",
      createdAt: new Date("2025-01-01"),
    });

    const res = await GET();
    const data = await res.json();

    expect(res.status).toBe(200);
    expect(data.success).toBe(true);
    expect(data.data.name).toBe("Test User");
    expect(data.data.email).toBe("test@example.com");
    expect(data.data.hasPassword).toBe(true);
  });

  it("returns hasPassword false for OAuth-only users", async () => {
    mockAuth.mockResolvedValue({ user: { id: "user-1" } });
    mockFindFirst.mockResolvedValue({
      id: "user-1",
      name: "OAuth User",
      email: "oauth@example.com",
      phoneNumber: null,
      image: null,
      role: "CUSTOMER",
      passwordHash: null,
      createdAt: new Date("2025-01-01"),
    });

    const res = await GET();
    const data = await res.json();

    expect(data.data.hasPassword).toBe(false);
  });

  it("returns 404 when user not found", async () => {
    mockAuth.mockResolvedValue({ user: { id: "user-not-exist" } });
    mockFindFirst.mockResolvedValue(null);

    const res = await GET();
    const data = await res.json();

    expect(res.status).toBe(404);
    expect(data.error).toContain("not found");
  });
});

describe("PATCH /api/account", () => {
  let PATCH: (req: NextRequest) => Promise<Response>;

  beforeEach(async () => {
    vi.clearAllMocks();
    const mod = await import("@/app/api/account/route");
    PATCH = mod.PATCH;
  });

  it("returns 401 when not authenticated", async () => {
    mockAuth.mockResolvedValue(null);
    const req = new NextRequest("http://localhost/api/account", {
      method: "PATCH",
      body: JSON.stringify({ name: "New Name" }),
    });
    const res = await PATCH(req);
    expect(res.status).toBe(401);
  });

  it("updates profile successfully", async () => {
    mockAuth.mockResolvedValue({ user: { id: "user-1" } });
    mockFindFirst.mockResolvedValue(null); // no duplicate

    const req = new NextRequest("http://localhost/api/account", {
      method: "PATCH",
      body: JSON.stringify({ name: "Updated Name" }),
    });

    const res = await PATCH(req);
    const data = await res.json();

    expect(res.status).toBe(200);
    expect(data.success).toBe(true);
  });

  it("returns 409 when email is already taken", async () => {
    mockAuth.mockResolvedValue({ user: { id: "user-1" } });
    mockFindFirst.mockResolvedValue({ id: "user-2", email: "taken@example.com" });

    const req = new NextRequest("http://localhost/api/account", {
      method: "PATCH",
      body: JSON.stringify({ email: "taken@example.com" }),
    });

    const res = await PATCH(req);
    const data = await res.json();

    expect(res.status).toBe(409);
    expect(data.error).toContain("email");
  });

  it("returns 400 on validation error", async () => {
    mockAuth.mockResolvedValue({ user: { id: "user-1" } });

    const req = new NextRequest("http://localhost/api/account", {
      method: "PATCH",
      body: JSON.stringify({ email: "not-an-email" }),
    });

    const res = await PATCH(req);
    expect(res.status).toBe(400);
  });

  it("returns 409 when phone number is already taken", async () => {
    mockAuth.mockResolvedValue({ user: { id: "user-1" } });
    mockFindFirst
      .mockResolvedValueOnce(null) // no email duplicate
      .mockResolvedValueOnce({ id: "user-3", phoneNumber: "+9999999999" }); // phone duplicate

    const req = new NextRequest("http://localhost/api/account", {
      method: "PATCH",
      body: JSON.stringify({
        email: "new@example.com",
        phoneNumber: "+9999999999",
      }),
    });

    const res = await PATCH(req);
    const data = await res.json();

    expect(res.status).toBe(409);
    expect(data.error).toContain("phone");
  });

  it("updates phone number only", async () => {
    mockAuth.mockResolvedValue({ user: { id: "user-1" } });
    mockFindFirst.mockResolvedValue(null); // no duplicate

    const req = new NextRequest("http://localhost/api/account", {
      method: "PATCH",
      body: JSON.stringify({ phoneNumber: "+1111111111" }),
    });

    const res = await PATCH(req);
    expect(res.status).toBe(200);
  });
});
