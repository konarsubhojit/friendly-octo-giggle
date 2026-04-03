import { describe, it, expect, vi, beforeEach } from "vitest";

const { mockAuth, mockDrizzleDb } = vi.hoisted(() => ({
  mockAuth: vi.fn(),
  mockDrizzleDb: {
    select: vi.fn(),
    insert: vi.fn(),
    update: vi.fn(),
  },
}));

vi.mock("@/lib/auth", () => ({ auth: mockAuth }));
vi.mock("@/lib/db", () => ({ drizzleDb: mockDrizzleDb }));
vi.mock("@/lib/schema", () => ({
  categories: {
    id: "id",
    name: "name",
    sortOrder: "sortOrder",
    deletedAt: "deletedAt",
    createdAt: "createdAt",
    updatedAt: "updatedAt",
  },
}));

vi.mock("drizzle-orm", () => ({
  eq: vi.fn(),
  and: vi.fn(),
  isNull: vi.fn(),
  asc: vi.fn(),
  ne: vi.fn(),
}));

import { GET, POST } from "@/app/api/admin/categories/route";

describe("admin/categories API", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("GET", () => {
    it("returns 401 for unauthenticated users", async () => {
      mockAuth.mockResolvedValue(null);

      const response = await GET();
      const body = await response.json();

      expect(response.status).toBe(401);
      expect(body.error).toBe("Not authenticated");
    });

    it("returns 403 for non-admin users", async () => {
      mockAuth.mockResolvedValue({ user: { role: "USER" } });

      const response = await GET();
      const body = await response.json();

      expect(response.status).toBe(403);
      expect(body.error).toBe("Not authorized");
    });

    it("returns categories for admin users", async () => {
      mockAuth.mockResolvedValue({ user: { role: "ADMIN" } });

      const selectChain = {
        from: vi.fn().mockReturnThis(),
        where: vi.fn().mockReturnThis(),
        orderBy: vi.fn().mockResolvedValue([
          {
            id: "1",
            name: "Clothing",
            sortOrder: 0,
            createdAt: new Date("2024-01-01"),
            updatedAt: new Date("2024-01-01"),
          },
        ]),
      };
      mockDrizzleDb.select.mockReturnValue(selectChain);

      const response = await GET();
      const body = await response.json();

      expect(response.status).toBe(200);
      expect(body.data.categories).toHaveLength(1);
      expect(body.data.categories[0].name).toBe("Clothing");
    });

    it("handles database errors", async () => {
      mockAuth.mockResolvedValue({ user: { role: "ADMIN" } });

      const selectChain = {
        from: vi.fn().mockReturnThis(),
        where: vi.fn().mockReturnThis(),
        orderBy: vi.fn().mockRejectedValue(new Error("DB error")),
      };
      mockDrizzleDb.select.mockReturnValue(selectChain);

      const response = await GET();

      expect(response.status).toBe(500);
    });
  });

  describe("POST", () => {
    it("returns 401 for unauthenticated users", async () => {
      mockAuth.mockResolvedValue(null);

      const request = new Request("http://localhost/api/admin/categories", {
        method: "POST",
        body: JSON.stringify({ name: "Test" }),
      });

      const response = await POST(request);

      expect(response.status).toBe(401);
    });

    it("returns 400 for invalid input", async () => {
      mockAuth.mockResolvedValue({ user: { role: "ADMIN" } });

      const request = new Request("http://localhost/api/admin/categories", {
        method: "POST",
        body: JSON.stringify({ name: "" }),
      });

      const response = await POST(request);

      expect(response.status).toBe(400);
    });

    it("creates a new category", async () => {
      mockAuth.mockResolvedValue({ user: { role: "ADMIN" } });

      const selectChain = {
        from: vi.fn().mockReturnThis(),
        where: vi.fn().mockReturnThis(),
        limit: vi.fn().mockResolvedValue([]),
      };
      mockDrizzleDb.select.mockReturnValue(selectChain);

      const insertChain = {
        values: vi.fn().mockReturnThis(),
        returning: vi.fn().mockResolvedValue([
          {
            id: "1",
            name: "New Category",
            sortOrder: 0,
            createdAt: new Date("2024-01-01"),
            updatedAt: new Date("2024-01-01"),
            deletedAt: null,
          },
        ]),
      };
      mockDrizzleDb.insert.mockReturnValue(insertChain);

      const request = new Request("http://localhost/api/admin/categories", {
        method: "POST",
        body: JSON.stringify({ name: "New Category" }),
      });

      const response = await POST(request);
      const body = await response.json();

      expect(response.status).toBe(201);
      expect(body.data.category.name).toBe("New Category");
    });

    it("returns 409 for duplicate active category", async () => {
      mockAuth.mockResolvedValue({ user: { role: "ADMIN" } });

      const selectChain = {
        from: vi.fn().mockReturnThis(),
        where: vi.fn().mockReturnThis(),
        limit: vi
          .fn()
          .mockResolvedValue([{ id: "1", name: "Existing", deletedAt: null }]),
      };
      mockDrizzleDb.select.mockReturnValue(selectChain);

      const request = new Request("http://localhost/api/admin/categories", {
        method: "POST",
        body: JSON.stringify({ name: "Existing" }),
      });

      const response = await POST(request);
      const body = await response.json();

      expect(response.status).toBe(409);
      expect(body.error).toContain("already exists");
    });

    it("reactivates a soft-deleted category", async () => {
      mockAuth.mockResolvedValue({ user: { role: "ADMIN" } });

      const selectChain = {
        from: vi.fn().mockReturnThis(),
        where: vi.fn().mockReturnThis(),
        limit: vi.fn().mockResolvedValue([
          {
            id: "1",
            name: "Deleted Cat",
            deletedAt: new Date(),
            sortOrder: 0,
          },
        ]),
      };
      mockDrizzleDb.select.mockReturnValue(selectChain);

      const updateChain = {
        set: vi.fn().mockReturnThis(),
        where: vi.fn().mockReturnThis(),
        returning: vi.fn().mockResolvedValue([
          {
            id: "1",
            name: "Deleted Cat",
            sortOrder: 0,
            createdAt: new Date("2024-01-01"),
            updatedAt: new Date("2024-01-01"),
            deletedAt: null,
          },
        ]),
      };
      mockDrizzleDb.update.mockReturnValue(updateChain);

      const request = new Request("http://localhost/api/admin/categories", {
        method: "POST",
        body: JSON.stringify({ name: "Deleted Cat" }),
      });

      const response = await POST(request);

      expect(response.status).toBe(201);
    });
  });
});
