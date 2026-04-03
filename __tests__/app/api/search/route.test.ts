import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

const { mockSearchProducts, mockIsSearchAvailable } = vi.hoisted(() => ({
  mockSearchProducts: vi.fn(),
  mockIsSearchAvailable: vi.fn(),
}));

vi.mock("@/lib/search", () => ({
  searchProducts: mockSearchProducts,
  isSearchAvailable: mockIsSearchAvailable,
}));

import { GET } from "@/app/api/search/route";

describe("search API", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("GET", () => {
    it("returns 503 when search is not configured", async () => {
      mockIsSearchAvailable.mockReturnValue(false);

      const request = new NextRequest("http://localhost/api/search?q=test");

      const response = await GET(request);
      const body = await response.json();

      expect(response.status).toBe(503);
      expect(body.error).toContain("not configured");
    });

    it("returns 400 for missing query", async () => {
      mockIsSearchAvailable.mockReturnValue(true);

      const request = new NextRequest("http://localhost/api/search");

      const response = await GET(request);

      expect(response.status).toBe(400);
    });

    it("returns search results", async () => {
      mockIsSearchAvailable.mockReturnValue(true);
      mockSearchProducts.mockResolvedValue([
        { id: "p1", name: "Cotton Shirt" },
      ]);

      const request = new NextRequest(
        "http://localhost/api/search?q=cotton+shirt",
      );

      const response = await GET(request);
      const body = await response.json();

      expect(response.status).toBe(200);
      expect(body.data.results).toHaveLength(1);
      expect(body.data.query).toBe("cotton shirt");
    });

    it("passes category and limit to search", async () => {
      mockIsSearchAvailable.mockReturnValue(true);
      mockSearchProducts.mockResolvedValue([]);

      const request = new NextRequest(
        "http://localhost/api/search?q=test&category=Clothing&limit=10",
      );

      await GET(request);

      expect(mockSearchProducts).toHaveBeenCalledWith("test", {
        limit: 10,
        category: "Clothing",
      });
    });

    it("includes cache headers", async () => {
      mockIsSearchAvailable.mockReturnValue(true);
      mockSearchProducts.mockResolvedValue([]);

      const request = new NextRequest("http://localhost/api/search?q=test");

      const response = await GET(request);

      expect(response.headers.get("Cache-Control")).toContain("s-maxage=30");
    });

    it("handles search errors", async () => {
      mockIsSearchAvailable.mockReturnValue(true);
      mockSearchProducts.mockRejectedValue(new Error("Search failure"));

      const request = new NextRequest("http://localhost/api/search?q=test");

      const response = await GET(request);

      expect(response.status).toBe(500);
    });
  });
});
