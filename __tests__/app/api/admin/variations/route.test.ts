import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

const mockFindFirst = vi.fn();
const mockFindMany = vi.fn();
const mockReturning = vi.fn();
const mockWhere = vi.fn();
const mockSet = vi.fn();
const mockValues = vi.fn();

const createInsertMock = () => ({
  values: (...args: unknown[]) => {
    mockValues(...args);
    return { returning: () => mockReturning() };
  },
});

const createUpdateMock = () => ({
  set: (...args: unknown[]) => {
    mockSet(...args);
    return {
      where: (...wArgs: unknown[]) => {
        mockWhere(...wArgs);
        return { returning: () => mockReturning() };
      },
    };
  },
});

vi.mock("@/lib/db", () => ({
  drizzleDb: {
    query: {
      products: { findFirst: (...args: unknown[]) => mockFindFirst(...args) },
      productVariations: {
        findFirst: (...args: unknown[]) => mockFindFirst(...args),
        findMany: (...args: unknown[]) => mockFindMany(...args),
      },
    },
    insert: createInsertMock,
    update: createUpdateMock,
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

const mockProduct = {
  id: "abc1234",
  name: "Test Product",
  price: 29.99,
  deletedAt: null,
};

const mockVariation = {
  id: "var1234",
  productId: "abc1234",
  name: "Blue",
  designName: "Modern",
  image: null,
  images: [],
  price: 150,
  variationType: "styling",
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

describe("POST /api/admin/variations", () => {
  let POST: typeof import("@/app/api/admin/variations/route").POST;

  beforeEach(async () => {
    vi.resetAllMocks();
    const mod = await import("@/app/api/admin/variations/route");
    POST = mod.POST;
  });

  it("creates a variation for the provided product", async () => {
    mockAuth.mockResolvedValue(adminSession);
    mockFindFirst
      .mockResolvedValueOnce(mockProduct)
      .mockResolvedValueOnce(null);
    mockFindMany.mockResolvedValueOnce([]);
    mockReturning.mockResolvedValueOnce([mockVariation]);

    const res = await POST(
      makeRequest("http://localhost/api/admin/variations", "POST", {
        productId: "abc1234",
        name: "Blue",
        designName: "Modern",
        price: 150,
        variationType: "styling",
        stock: 10,
      }),
    );

    expect(res.status).toBe(201);
    const json = await res.json();
    expect(json.success).toBe(true);
    expect(json.data.variation.productId).toBe("abc1234");
  });
});

describe("PUT /api/admin/variations/[variationId]", () => {
  let PUT: typeof import("@/app/api/admin/variations/[variationId]/route").PUT;

  beforeEach(async () => {
    vi.resetAllMocks();
    const mod = await import("@/app/api/admin/variations/[variationId]/route");
    PUT = mod.PUT;
  });

  it("updates a variation without productId in the path", async () => {
    mockAuth.mockResolvedValue(adminSession);
    mockFindFirst
      .mockResolvedValueOnce(mockVariation)
      .mockResolvedValueOnce(mockProduct);
    mockReturning.mockResolvedValueOnce([
      { ...mockVariation, stock: 12, updatedAt: new Date("2025-01-02") },
    ]);

    const res = await PUT(
      makeRequest("http://localhost/api/admin/variations/var1234", "PUT", {
        stock: 12,
      }),
      { params: Promise.resolve({ variationId: "var1234" }) },
    );

    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.data.variation.stock).toBe(12);
  });
});

describe("DELETE /api/admin/variations/[variationId]", () => {
  let DELETE: typeof import("@/app/api/admin/variations/[variationId]/route").DELETE;

  beforeEach(async () => {
    vi.resetAllMocks();
    const mod = await import("@/app/api/admin/variations/[variationId]/route");
    DELETE = mod.DELETE;
  });

  it("soft-deletes a variation without productId in the path", async () => {
    mockAuth.mockResolvedValue(adminSession);
    mockFindFirst
      .mockResolvedValueOnce(mockVariation)
      .mockResolvedValueOnce(mockProduct);

    const res = await DELETE(
      makeRequest("http://localhost/api/admin/variations/var1234", "DELETE"),
      { params: Promise.resolve({ variationId: "var1234" }) },
    );

    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.data.id).toBe("var1234");
  });
});
