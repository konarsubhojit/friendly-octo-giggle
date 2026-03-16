import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";
import { PUT, DELETE } from "@/app/api/admin/products/[id]/route";

vi.mock("@/lib/db", () => ({
  db: {
    products: {
      update: vi.fn(),
      delete: vi.fn(),
    },
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

import { db } from "@/lib/db";
import { auth } from "@/lib/auth";
import { revalidateTag } from "next/cache";
import { invalidateProductCaches } from "@/lib/cache";

const mockAuth = vi.mocked(auth);
const mockProductsUpdate = vi.mocked(db.products.update);
const mockProductsDelete = vi.mocked(db.products.delete);
const mockRevalidateTag = vi.mocked(revalidateTag);
const mockInvalidateProductCaches = vi.mocked(invalidateProductCaches);

describe("PUT /api/admin/products/[id]", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns 401 when not authenticated", async () => {
    mockAuth.mockResolvedValue(null as never);

    const request = new NextRequest("http://localhost/api/admin/products/p1", {
      method: "PUT",
      body: JSON.stringify({ name: "Updated" }),
      headers: { "content-type": "application/json" },
    });

    const response = await PUT(request, {
      params: Promise.resolve({ id: "p1" }),
    });
    const json = await response.json();

    expect(response.status).toBe(401);
    expect(json.error).toBe("Not authenticated");
  });

  it("returns 403 when not admin", async () => {
    mockAuth.mockResolvedValue({
      user: { id: "u1", email: "user@test.com", role: "USER" },
      expires: "2099-01-01",
    } as never);

    const request = new NextRequest("http://localhost/api/admin/products/p1", {
      method: "PUT",
      body: JSON.stringify({ name: "Updated" }),
      headers: { "content-type": "application/json" },
    });

    const response = await PUT(request, {
      params: Promise.resolve({ id: "p1" }),
    });
    const json = await response.json();

    expect(response.status).toBe(403);
    expect(json.error).toBe("Not authorized - Admin access required");
  });

  it("returns 404 when product not found", async () => {
    mockAuth.mockResolvedValue({
      user: { id: "a1", email: "admin@test.com", role: "ADMIN" },
      expires: "2099-01-01",
    } as never);
    mockProductsUpdate.mockResolvedValue(null);

    const request = new NextRequest("http://localhost/api/admin/products/p1", {
      method: "PUT",
      body: JSON.stringify({ name: "Updated" }),
      headers: { "content-type": "application/json" },
    });

    const response = await PUT(request, {
      params: Promise.resolve({ id: "p1" }),
    });
    const json = await response.json();

    expect(response.status).toBe(404);
    expect(json.error).toBe("Product not found");
  });

  it("updates product successfully", async () => {
    mockAuth.mockResolvedValue({
      user: { id: "a1", email: "admin@test.com", role: "ADMIN" },
      expires: "2099-01-01",
    } as never);
    const updatedProduct = {
      id: "p1",
      name: "Updated Product",
      description: "Desc",
      price: 99.99,
      image: "/img.jpg",
      stock: 10,
      category: "Electronics",
      deletedAt: null,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    mockProductsUpdate.mockResolvedValue(updatedProduct as never);

    const request = new NextRequest("http://localhost/api/admin/products/p1", {
      method: "PUT",
      body: JSON.stringify({ name: "Updated Product" }),
      headers: { "content-type": "application/json" },
    });

    const response = await PUT(request, {
      params: Promise.resolve({ id: "p1" }),
    });
    const json = await response.json();

    expect(response.status).toBe(200);
    expect(json.data.product.id).toBe("p1");
    expect(json.data.product.name).toBe("Updated Product");
    expect(mockProductsUpdate).toHaveBeenCalledWith("p1", {
      name: "Updated Product",
      images: [],
    });
    expect(mockRevalidateTag).toHaveBeenCalledWith("products", {});
    expect(mockInvalidateProductCaches).toHaveBeenCalledWith("p1");
  });

  it("returns 400 for invalid input", async () => {
    mockAuth.mockResolvedValue({
      user: { id: "a1", email: "admin@test.com", role: "ADMIN" },
      expires: "2099-01-01",
    } as never);

    const request = new NextRequest("http://localhost/api/admin/products/p1", {
      method: "PUT",
      body: JSON.stringify({ price: "not-a-number" }),
      headers: { "content-type": "application/json" },
    });

    const response = await PUT(request, {
      params: Promise.resolve({ id: "p1" }),
    });
    const json = await response.json();

    expect(response.status).toBe(400);
    expect(json.error).toBeDefined();
  });
});

describe("DELETE /api/admin/products/[id]", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns 401 when not authenticated", async () => {
    mockAuth.mockResolvedValue(null as never);

    const request = new NextRequest("http://localhost/api/admin/products/p1", {
      method: "DELETE",
    });

    const response = await DELETE(request, {
      params: Promise.resolve({ id: "p1" }),
    });
    const json = await response.json();

    expect(response.status).toBe(401);
    expect(json.error).toBe("Not authenticated");
  });

  it("returns 403 when not admin", async () => {
    mockAuth.mockResolvedValue({
      user: { id: "u1", email: "user@test.com", role: "USER" },
      expires: "2099-01-01",
    } as never);

    const request = new NextRequest("http://localhost/api/admin/products/p1", {
      method: "DELETE",
    });

    const response = await DELETE(request, {
      params: Promise.resolve({ id: "p1" }),
    });
    const json = await response.json();

    expect(response.status).toBe(403);
    expect(json.error).toBe("Not authorized - Admin access required");
  });

  it("returns 404 when product not found", async () => {
    mockAuth.mockResolvedValue({
      user: { id: "a1", email: "admin@test.com", role: "ADMIN" },
      expires: "2099-01-01",
    } as never);
    mockProductsDelete.mockResolvedValue(false);

    const request = new NextRequest("http://localhost/api/admin/products/p1", {
      method: "DELETE",
    });

    const response = await DELETE(request, {
      params: Promise.resolve({ id: "p1" }),
    });
    const json = await response.json();

    expect(response.status).toBe(404);
    expect(json.error).toBe("Product not found");
  });

  it("deletes product successfully", async () => {
    mockAuth.mockResolvedValue({
      user: { id: "a1", email: "admin@test.com", role: "ADMIN" },
      expires: "2099-01-01",
    } as never);
    mockProductsDelete.mockResolvedValue(true);

    const request = new NextRequest("http://localhost/api/admin/products/p1", {
      method: "DELETE",
    });

    const response = await DELETE(request, {
      params: Promise.resolve({ id: "p1" }),
    });
    const json = await response.json();

    expect(response.status).toBe(200);
    expect(json.data.message).toBe("Product deleted");
    expect(json.data.id).toBe("p1");
    expect(mockProductsDelete).toHaveBeenCalledWith("p1");
    expect(mockRevalidateTag).toHaveBeenCalledWith("products", {});
    expect(mockInvalidateProductCaches).toHaveBeenCalledWith("p1");
  });
});
