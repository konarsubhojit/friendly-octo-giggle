import { describe, it, expect } from "vitest";
import { z } from "zod";
import {
  CreateVariationSchema,
  UpdateVariationSchema,
  CreateReviewSchema,
  CreateShareSchema,
  ProductSchema,
  ProductInputSchema,
  ProductUpdateSchema,
} from "@/features/product/validations";

describe("product/validations", () => {
  describe("CreateVariationSchema", () => {
    it("validates a valid colour variation", () => {
      const result = CreateVariationSchema.safeParse({
        name: "Red",
        designName: "Crimson Red",
        variationType: "colour",
        price: 150,
        stock: 10,
      });
      expect(result.success).toBe(true);
    });

    it("validates a valid styling variation with zero price/stock", () => {
      const result = CreateVariationSchema.safeParse({
        name: "Summer Style",
        designName: "Summer Collection",
        variationType: "styling",
        price: 0,
        stock: 0,
      });
      expect(result.success).toBe(true);
    });

    it("rejects styling variation with non-zero price", () => {
      const result = CreateVariationSchema.safeParse({
        name: "Summer Style",
        designName: "Summer Collection",
        variationType: "styling",
        price: 100,
        stock: 0,
      });
      expect(result.success).toBe(false);
      if (!result.success) {
        const messages = result.error.issues.map((i: z.ZodIssue) => i.message);
        expect(messages).toContain("Styles are grouping-only; price must be 0");
      }
    });

    it("rejects styling variation with non-zero stock", () => {
      const result = CreateVariationSchema.safeParse({
        name: "Summer Style",
        designName: "Summer Collection",
        variationType: "styling",
        price: 0,
        stock: 5,
      });
      expect(result.success).toBe(false);
      if (!result.success) {
        const messages = result.error.issues.map((i: z.ZodIssue) => i.message);
        expect(messages).toContain("Styles are grouping-only; stock must be 0");
      }
    });

    it("rejects styling variation with styleId (no nesting)", () => {
      const result = CreateVariationSchema.safeParse({
        name: "Summer Style",
        designName: "Summer Collection",
        variationType: "styling",
        price: 0,
        stock: 0,
        styleId: "abc1234",
      });
      expect(result.success).toBe(false);
      if (!result.success) {
        const messages = result.error.issues.map((i: z.ZodIssue) => i.message);
        expect(messages).toContain(
          "Styles cannot be nested under another style",
        );
      }
    });

    it("rejects colour variation with price <= 0", () => {
      const result = CreateVariationSchema.safeParse({
        name: "Blue",
        designName: "Ocean Blue",
        variationType: "colour",
        price: 0,
        stock: 10,
      });
      expect(result.success).toBe(false);
      if (!result.success) {
        const messages = result.error.issues.map((i: z.ZodIssue) => i.message);
        expect(messages).toContain(
          "Colour price must be greater than zero",
        );
      }
    });

    it("rejects missing name", () => {
      const result = CreateVariationSchema.safeParse({
        designName: "Test",
        price: 100,
        stock: 10,
      });
      expect(result.success).toBe(false);
    });

    it("rejects negative price", () => {
      const result = CreateVariationSchema.safeParse({
        name: "Test",
        designName: "Test Design",
        price: -10,
        stock: 10,
      });
      expect(result.success).toBe(false);
    });

    it("defaults variationType to styling", () => {
      const result = CreateVariationSchema.safeParse({
        name: "Test",
        designName: "Test Design",
        price: 0,
        stock: 0,
      });
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.variationType).toBe("styling");
      }
    });
  });

  describe("UpdateVariationSchema", () => {
    it("allows partial updates", () => {
      const result = UpdateVariationSchema.safeParse({ name: "Updated Name" });
      expect(result.success).toBe(true);
    });

    it("allows empty object", () => {
      const result = UpdateVariationSchema.safeParse({});
      expect(result.success).toBe(true);
    });

    it("validates updated price", () => {
      const result = UpdateVariationSchema.safeParse({ price: -5 });
      expect(result.success).toBe(false);
    });
  });

  describe("CreateReviewSchema", () => {
    it("validates a valid review", () => {
      const result = CreateReviewSchema.safeParse({
        productId: "abc1234",
        rating: 5,
        comment: "This is a great product with wonderful quality",
      });
      expect(result.success).toBe(true);
    });

    it("rejects rating below 1", () => {
      const result = CreateReviewSchema.safeParse({
        productId: "abc1234",
        rating: 0,
        comment: "This is a test review comment",
      });
      expect(result.success).toBe(false);
    });

    it("rejects rating above 5", () => {
      const result = CreateReviewSchema.safeParse({
        productId: "abc1234",
        rating: 6,
        comment: "This is a test review comment",
      });
      expect(result.success).toBe(false);
    });

    it("rejects comment shorter than 10 chars", () => {
      const result = CreateReviewSchema.safeParse({
        productId: "abc1234",
        rating: 3,
        comment: "Short",
      });
      expect(result.success).toBe(false);
    });

    it("rejects comment longer than 1000 chars", () => {
      const result = CreateReviewSchema.safeParse({
        productId: "abc1234",
        rating: 3,
        comment: "a".repeat(1001),
      });
      expect(result.success).toBe(false);
    });

    it("defaults isAnonymous to false", () => {
      const result = CreateReviewSchema.safeParse({
        productId: "abc1234",
        rating: 4,
        comment: "A perfectly fine review with enough chars",
      });
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.isAnonymous).toBe(false);
      }
    });
  });

  describe("CreateShareSchema", () => {
    it("validates with productId only", () => {
      const result = CreateShareSchema.safeParse({
        productId: "abc1234",
      });
      expect(result.success).toBe(true);
    });

    it("validates with productId and variationId", () => {
      const result = CreateShareSchema.safeParse({
        productId: "abc1234",
        variationId: "def5678",
      });
      expect(result.success).toBe(true);
    });

    it("rejects invalid productId format", () => {
      const result = CreateShareSchema.safeParse({
        productId: "invalid-id-too-long",
      });
      expect(result.success).toBe(false);
    });
  });

  describe("ProductSchema", () => {
    it("validates a complete product", () => {
      const result = ProductSchema.safeParse({
        id: "abc1234",
        name: "Test Product",
        description: "A test product description",
        price: 99.99,
        image: "https://example.com/image.jpg",
        images: [],
        stock: 10,
        category: "Electronics",
        createdAt: "2024-01-01T00:00:00.000Z",
        updatedAt: "2024-01-01T00:00:00.000Z",
      });
      expect(result.success).toBe(true);
    });

    it("rejects invalid ID format", () => {
      const result = ProductSchema.safeParse({
        id: "toolongid",
        name: "Test",
        description: "A description",
        price: 10,
        image: "https://example.com/img.jpg",
        stock: 5,
        category: "Test",
        createdAt: "2024-01-01T00:00:00.000Z",
        updatedAt: "2024-01-01T00:00:00.000Z",
      });
      expect(result.success).toBe(false);
    });
  });

  describe("ProductInputSchema", () => {
    it("validates product input without id/timestamps", () => {
      const result = ProductInputSchema.safeParse({
        name: "New Product",
        description: "A new product",
        price: 50,
        image: "https://example.com/img.jpg",
        stock: 20,
        category: "Clothing",
      });
      expect(result.success).toBe(true);
    });
  });

  describe("ProductUpdateSchema", () => {
    it("allows partial product updates", () => {
      const result = ProductUpdateSchema.safeParse({
        name: "Updated Name",
        price: 75,
      });
      expect(result.success).toBe(true);
    });

    it("allows empty update", () => {
      const result = ProductUpdateSchema.safeParse({});
      expect(result.success).toBe(true);
    });
  });
});
