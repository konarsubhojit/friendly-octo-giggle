import { describe, it, expect, vi, beforeEach } from "vitest";

const { mockAuth, mockDrizzleDb } = vi.hoisted(() => ({
  mockAuth: vi.fn(),
  mockDrizzleDb: {
    select: vi.fn(),
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
  ne: vi.fn(),
}));

import { PUT, DELETE } from "@/app/api/admin/categories/[id]/route";

const makeParams = (id: string) => ({ params: Promise.resolve({ id }) });

describe("admin/categories/[id] API", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("PUT", () => {
    it("returns 401 for unauthenticated users", async () => {
      mockAuth.mockResolvedValue(null);

      const request = new Request("http://localhost", {
        method: "PUT",
        body: JSON.stringify({ name: "Updated" }),
      });

      const response = await PUT(request, makeParams("cat1"));

      expect(response.status).toBe(401);
    });

    it("returns 403 for non-admin users", async () => {
      mockAuth.mockResolvedValue({ user: { role: "USER" } });

      const request = new Request("http://localhost", {
        method: "PUT",
        body: JSON.stringify({ name: "Updated" }),
      });

      const response = await PUT(request, makeParams("cat1"));

      expect(response.status).toBe(403);
    });

    it("returns 404 when category not found", async () => {
      mockAuth.mockResolvedValue({ user: { role: "ADMIN" } });

      const selectChain = {
        from: vi.fn().mockReturnThis(),
        where: vi.fn().mockReturnThis(),
        limit: vi.fn().mockResolvedValue([]),
      };
      mockDrizzleDb.select.mockReturnValue(selectChain);

      const request = new Request("http://localhost", {
        method: "PUT",
        body: JSON.stringify({ name: "Updated" }),
      });

      const response = await PUT(request, makeParams("cat1"));
      const body = await response.json();

      expect(response.status).toBe(404);
      expect(body.error).toBe("Category not found");
    });

    it("updates category successfully", async () => {
      mockAuth.mockResolvedValue({ user: { role: "ADMIN" } });

      const selectChain = {
        from: vi.fn().mockReturnThis(),
        where: vi.fn().mockReturnThis(),
        limit: vi.fn().mockResolvedValue([{ id: "cat1", name: "Old Name" }]),
      };
      mockDrizzleDb.select.mockReturnValue(selectChain);

      const duplicateCheck = {
        from: vi.fn().mockReturnThis(),
        where: vi.fn().mockReturnThis(),
        limit: vi.fn().mockResolvedValue([]),
      };
      mockDrizzleDb.select
        .mockReturnValueOnce(selectChain)
        .mockReturnValueOnce(duplicateCheck);

      const updateChain = {
        set: vi.fn().mockReturnThis(),
        where: vi.fn().mockReturnThis(),
        returning: vi.fn().mockResolvedValue([
          {
            id: "cat1",
            name: "New Name",
            sortOrder: 0,
            createdAt: new Date("2024-01-01"),
            updatedAt: new Date("2024-01-02"),
            deletedAt: null,
          },
        ]),
      };
      mockDrizzleDb.update.mockReturnValue(updateChain);

      const request = new Request("http://localhost", {
        method: "PUT",
        body: JSON.stringify({ name: "New Name" }),
      });

      const response = await PUT(request, makeParams("cat1"));

      expect(response.status).toBe(200);
    });

    it("returns 409 for duplicate name", async () => {
      mockAuth.mockResolvedValue({ user: { role: "ADMIN" } });

      const existingChain = {
        from: vi.fn().mockReturnThis(),
        where: vi.fn().mockReturnThis(),
        limit: vi.fn().mockResolvedValue([
          { id: "cat1", name: "Old Name" },
        ]),
      };

      const duplicateChain = {
        from: vi.fn().mockReturnThis(),
        where: vi.fn().mockReturnThis(),
        limit: vi.fn().mockResolvedValue([{ id: "cat2" }]),
      };

      mockDrizzleDb.select
        .mockReturnValueOnce(existingChain)
        .mockReturnValueOnce(duplicateChain);

      const request = new Request("http://localhost", {
        method: "PUT",
        body: JSON.stringify({ name: "Duplicate Name" }),
      });

      const response = await PUT(request, makeParams("cat1"));

      expect(response.status).toBe(409);
    });
  });

  describe("DELETE", () => {
    it("returns 401 for unauthenticated users", async () => {
      mockAuth.mockResolvedValue(null);

      const request = new Request("http://localhost", { method: "DELETE" });
      const response = await DELETE(request, makeParams("cat1"));

      expect(response.status).toBe(401);
    });

    it("returns 404 when category not found", async () => {
      mockAuth.mockResolvedValue({ user: { role: "ADMIN" } });

      const selectChain = {
        from: vi.fn().mockReturnThis(),
        where: vi.fn().mockReturnThis(),
        limit: vi.fn().mockResolvedValue([]),
      };
      mockDrizzleDb.select.mockReturnValue(selectChain);

      const request = new Request("http://localhost", { method: "DELETE" });
      const response = await DELETE(request, makeParams("cat1"));

      expect(response.status).toBe(404);
    });

    it("soft-deletes category", async () => {
      mockAuth.mockResolvedValue({ user: { role: "ADMIN" } });

      const selectChain = {
        from: vi.fn().mockReturnThis(),
        where: vi.fn().mockReturnThis(),
        limit: vi.fn().mockResolvedValue([
          { id: "cat1", name: "To Delete", deletedAt: null },
        ]),
      };
      mockDrizzleDb.select.mockReturnValue(selectChain);

      const updateChain = {
        set: vi.fn().mockReturnThis(),
        where: vi.fn().mockResolvedValue([]),
      };
      mockDrizzleDb.update.mockReturnValue(updateChain);

      const request = new Request("http://localhost", { method: "DELETE" });
      const response = await DELETE(request, makeParams("cat1"));
      const body = await response.json();

      expect(response.status).toBe(200);
      expect(body.data.deleted).toBe(true);
    });
  });
});
