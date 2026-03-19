import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

// Mock Drizzle DB with chainable query methods
const mockFindFirst = vi.fn();
const mockFindMany = vi.fn();
const _mockInsert = vi.fn();
const _mockUpdate = vi.fn();
const mockReturning = vi.fn();
const mockWhere = vi.fn();
const mockSet = vi.fn();
const mockValues = vi.fn();

vi.mock("@/lib/db", () => ({
  drizzleDb: {
    query: {
      products: { findFirst: (...args: unknown[]) => mockFindFirst(...args) },
      productVariations: {
        findFirst: (...args: unknown[]) => mockFindFirst(...args),
        findMany: (...args: unknown[]) => mockFindMany(...args),
      },
    },
    insert: () => ({
      values: (...args: unknown[]) => {
        mockValues(...args);
        return { returning: () => mockReturning() };
      },
    }),
    update: () => ({
      set: (...args: unknown[]) => {
        mockSet(...args);
        return {
          where: (...wArgs: unknown[]) => {
            mockWhere(...wArgs);
            return { returning: () => mockReturning() };
          },
        };
      },
    }),
  },
}));

vi.mock("@/lib/schema", () => ({
  products: { id: "id", deletedAt: "deletedAt" },
  productVariations: {
    id: "id",
    productId: "productId",
    name: "name",
    deletedAt: "deletedAt",
  },
}));

vi.mock("@/lib/auth", () => ({ auth: vi.fn() }));
vi.mock(
  "@/lib/validations",
  async () => await vi.importActual("@/lib/validations"),
);
vi.mock("@/lib/logger", () => ({ logError: vi.fn() }));
vi.mock("next/cache", () => ({ revalidateTag: vi.fn() }));
vi.mock("@/lib/cache", () => ({ invalidateProductCaches: vi.fn() }));
vi.mock("drizzle-orm", () => ({
  eq: vi.fn((...args: unknown[]) => args),
  and: vi.fn((...args: unknown[]) => args),
  isNull: vi.fn((...args: unknown[]) => args),
  ne: vi.fn((...args: unknown[]) => args),
}));

import { auth } from "@/lib/auth";

const mockAuth = vi.mocked(auth);

const adminSession = {
  user: { id: "a1", email: "admin@test.com", role: "ADMIN" },
  expires: "2099-01-01",
} as never;

const customerSession = {
  user: { id: "u1", email: "user@test.com", role: "CUSTOMER" },
  expires: "2099-01-01",
} as never;

const mockProduct = {
  id: "abc1234",
  name: "Test Product",
  price: 29.99,
  deletedAt: null,
};

const mockVariation = {
  id: "var1234",
  productId: "abc1234",
  name: "Red",
  designName: "Classic",
  image: null,
  images: [],
  priceModifier: 5.0,
  stock: 10,
  deletedAt: null,
  createdAt: new Date("2025-01-01"),
  updatedAt: new Date("2025-01-01"),
};

function makeRequest(url: string, method: string, body?: unknown) {
  return new NextRequest(url, {
    method,
    ...(body
      ? {
          body: JSON.stringify(body),
          headers: { "content-type": "application/json" },
        }
      : {}),
  });
}

describe("GET /api/admin/products/[id]/variations", () => {
  let GET: typeof import("@/app/api/admin/products/[id]/variations/route").GET;

  beforeEach(async () => {
    vi.resetAllMocks();
    const mod = await import("@/app/api/admin/products/[id]/variations/route");
    GET = mod.GET;
  });

  it("returns 401 when unauthenticated", async () => {
    mockAuth.mockResolvedValue(null as never);
    const res = await GET(
      makeRequest(
        "http://localhost/api/admin/products/abc1234/variations",
        "GET",
      ),
      { params: Promise.resolve({ id: "abc1234" }) },
    );
    expect(res.status).toBe(401);
  });

  it("returns 403 when not admin", async () => {
    mockAuth.mockResolvedValue(customerSession);
    const res = await GET(
      makeRequest(
        "http://localhost/api/admin/products/abc1234/variations",
        "GET",
      ),
      { params: Promise.resolve({ id: "abc1234" }) },
    );
    expect(res.status).toBe(403);
  });

  it("returns 404 when product not found", async () => {
    mockAuth.mockResolvedValue(adminSession);
    mockFindFirst.mockResolvedValueOnce(null);
    const res = await GET(
      makeRequest(
        "http://localhost/api/admin/products/abc1234/variations",
        "GET",
      ),
      { params: Promise.resolve({ id: "abc1234" }) },
    );
    expect(res.status).toBe(404);
  });

  it("returns list of variations", async () => {
    mockAuth.mockResolvedValue(adminSession);
    mockFindFirst.mockResolvedValueOnce(mockProduct);
    mockFindMany.mockResolvedValueOnce([mockVariation]);
    const res = await GET(
      makeRequest(
        "http://localhost/api/admin/products/abc1234/variations",
        "GET",
      ),
      { params: Promise.resolve({ id: "abc1234" }) },
    );
    const json = await res.json();
    expect(res.status).toBe(200);
    expect(json.data.count).toBe(1);
    expect(json.data.variations[0].name).toBe("Red");
  });
});

describe("POST /api/admin/products/[id]/variations", () => {
  let POST: typeof import("@/app/api/admin/products/[id]/variations/route").POST;

  beforeEach(async () => {
    vi.resetAllMocks();
    const mod = await import("@/app/api/admin/products/[id]/variations/route");
    POST = mod.POST;
  });

  const validBody = {
    name: "Blue",
    designName: "Modern",
    priceModifier: 3.0,
    stock: 50,
  };

  it("returns 401 when unauthenticated", async () => {
    mockAuth.mockResolvedValue(null as never);
    const res = await POST(
      makeRequest(
        "http://localhost/api/admin/products/abc1234/variations",
        "POST",
        validBody,
      ),
      { params: Promise.resolve({ id: "abc1234" }) },
    );
    expect(res.status).toBe(401);
  });

  it("returns 403 when not admin", async () => {
    mockAuth.mockResolvedValue(customerSession);
    const res = await POST(
      makeRequest(
        "http://localhost/api/admin/products/abc1234/variations",
        "POST",
        validBody,
      ),
      { params: Promise.resolve({ id: "abc1234" }) },
    );
    expect(res.status).toBe(403);
  });

  it("returns 400 for validation errors", async () => {
    mockAuth.mockResolvedValue(adminSession);
    mockFindFirst.mockResolvedValueOnce(mockProduct);
    const res = await POST(
      makeRequest(
        "http://localhost/api/admin/products/abc1234/variations",
        "POST",
        { name: "" },
      ),
      { params: Promise.resolve({ id: "abc1234" }) },
    );
    expect(res.status).toBe(400);
  });

  it("returns 400 when effective price <= 0", async () => {
    mockAuth.mockResolvedValue(adminSession);
    mockFindFirst.mockResolvedValueOnce(mockProduct);
    const res = await POST(
      makeRequest(
        "http://localhost/api/admin/products/abc1234/variations",
        "POST",
        {
          ...validBody,
          priceModifier: -100,
        },
      ),
      { params: Promise.resolve({ id: "abc1234" }) },
    );
    expect(res.status).toBe(400);
    const json = await res.json();
    expect(json.error).toContain("Effective price");
  });

  it("returns 400 when 25-variation limit reached", async () => {
    mockAuth.mockResolvedValue(adminSession);
    mockFindFirst
      .mockResolvedValueOnce(mockProduct) // findProduct
      .mockResolvedValueOnce(null); // name uniqueness (no duplicate)
    mockFindMany.mockResolvedValueOnce(Array(25).fill({ id: "x" })); // activeCount
    const res = await POST(
      makeRequest(
        "http://localhost/api/admin/products/abc1234/variations",
        "POST",
        validBody,
      ),
      { params: Promise.resolve({ id: "abc1234" }) },
    );
    expect(res.status).toBe(400);
    const json = await res.json();
    expect(json.error).toContain("25");
  });

  it("returns 409 for duplicate name", async () => {
    mockAuth.mockResolvedValue(adminSession);
    mockFindFirst.mockResolvedValueOnce(mockProduct); // findProduct
    mockFindMany.mockResolvedValueOnce(Array(5).fill({ id: "x" })); // activeCount < 25
    mockFindFirst.mockResolvedValueOnce({ ...mockVariation, deletedAt: null }); // name check - duplicate active
    const res = await POST(
      makeRequest(
        "http://localhost/api/admin/products/abc1234/variations",
        "POST",
        validBody,
      ),
      { params: Promise.resolve({ id: "abc1234" }) },
    );
    expect(res.status).toBe(409);
  });

  it("returns 409 for archived name conflict", async () => {
    mockAuth.mockResolvedValue(adminSession);
    mockFindFirst.mockResolvedValueOnce(mockProduct);
    mockFindMany.mockResolvedValueOnce(Array(3).fill({ id: "x" }));
    mockFindFirst.mockResolvedValueOnce({
      ...mockVariation,
      deletedAt: new Date(),
    }); // archived
    const res = await POST(
      makeRequest(
        "http://localhost/api/admin/products/abc1234/variations",
        "POST",
        validBody,
      ),
      { params: Promise.resolve({ id: "abc1234" }) },
    );
    expect(res.status).toBe(409);
    const json = await res.json();
    expect(json.error).toContain("archived");
  });

  it("returns 201 on successful creation", async () => {
    mockAuth.mockResolvedValue(adminSession);
    mockFindFirst.mockResolvedValueOnce(mockProduct);
    mockFindMany.mockResolvedValueOnce([]); // no existing variations
    mockFindFirst.mockResolvedValueOnce(null); // no name conflict
    mockReturning.mockResolvedValueOnce([mockVariation]);
    const res = await POST(
      makeRequest(
        "http://localhost/api/admin/products/abc1234/variations",
        "POST",
        validBody,
      ),
      { params: Promise.resolve({ id: "abc1234" }) },
    );
    expect(res.status).toBe(201);
    const json = await res.json();
    expect(json.success).toBe(true);
    expect(json.data.variation).toBeDefined();
  });
});
