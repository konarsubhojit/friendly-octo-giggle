import { describe, it, expect } from 'vitest'
import {
  CreateVariantSchema,
  UpdateVariantSchema,
  CreateReviewSchema,
  CreateShareSchema,
  ProductSchema,
  ProductInputSchema,
  ProductUpdateSchema,
} from '@/features/product/validations'

describe('product/validations', () => {
  describe('CreateVariantSchema', () => {
    it('validates a valid variant', () => {
      const result = CreateVariantSchema.safeParse({
        price: 150,
        stock: 10,
      })
      expect(result.success).toBe(true)
    })

    it('validates a valid variant with sku', () => {
      const result = CreateVariantSchema.safeParse({
        price: 150,
        stock: 10,
        sku: 'SKU-001',
      })
      expect(result.success).toBe(true)
    })

    it('accepts zero stock', () => {
      const result = CreateVariantSchema.safeParse({
        price: 100,
        stock: 0,
      })
      expect(result.success).toBe(true)
    })

    it('rejects price <= 0', () => {
      const result = CreateVariantSchema.safeParse({
        price: 0,
        stock: 10,
      })
      expect(result.success).toBe(false)
    })

    it('rejects missing price', () => {
      const result = CreateVariantSchema.safeParse({
        stock: 10,
      })
      expect(result.success).toBe(false)
    })

    it('rejects negative price', () => {
      const result = CreateVariantSchema.safeParse({
        price: -10,
        stock: 10,
      })
      expect(result.success).toBe(false)
    })

    it('defaults images to empty array', () => {
      const result = CreateVariantSchema.safeParse({
        price: 100,
        stock: 5,
      })
      expect(result.success).toBe(true)
      if (result.success) {
        expect(result.data.images).toEqual([])
      }
    })
  })

  describe('UpdateVariantSchema', () => {
    it('allows partial updates', () => {
      const result = UpdateVariantSchema.safeParse({ price: 200 })
      expect(result.success).toBe(true)
    })

    it('allows empty object', () => {
      const result = UpdateVariantSchema.safeParse({})
      expect(result.success).toBe(true)
    })

    it('validates updated price', () => {
      const result = UpdateVariantSchema.safeParse({ price: -5 })
      expect(result.success).toBe(false)
    })
  })

  describe('CreateReviewSchema', () => {
    it('validates a valid review', () => {
      const result = CreateReviewSchema.safeParse({
        productId: 'abc1234',
        rating: 5,
        comment: 'This is a great product with wonderful quality',
      })
      expect(result.success).toBe(true)
    })

    it('rejects rating below 1', () => {
      const result = CreateReviewSchema.safeParse({
        productId: 'abc1234',
        rating: 0,
        comment: 'This is a test review comment',
      })
      expect(result.success).toBe(false)
    })

    it('rejects rating above 5', () => {
      const result = CreateReviewSchema.safeParse({
        productId: 'abc1234',
        rating: 6,
        comment: 'This is a test review comment',
      })
      expect(result.success).toBe(false)
    })

    it('rejects comment shorter than 10 chars', () => {
      const result = CreateReviewSchema.safeParse({
        productId: 'abc1234',
        rating: 3,
        comment: 'Short',
      })
      expect(result.success).toBe(false)
    })

    it('rejects comment longer than 1000 chars', () => {
      const result = CreateReviewSchema.safeParse({
        productId: 'abc1234',
        rating: 3,
        comment: 'a'.repeat(1001),
      })
      expect(result.success).toBe(false)
    })

    it('defaults isAnonymous to false', () => {
      const result = CreateReviewSchema.safeParse({
        productId: 'abc1234',
        rating: 4,
        comment: 'A perfectly fine review with enough chars',
      })
      expect(result.success).toBe(true)
      if (result.success) {
        expect(result.data.isAnonymous).toBe(false)
      }
    })
  })

  describe('CreateShareSchema', () => {
    it('validates with productId only', () => {
      const result = CreateShareSchema.safeParse({
        productId: 'abc1234',
      })
      expect(result.success).toBe(true)
    })

    it('validates with productId and variantId', () => {
      const result = CreateShareSchema.safeParse({
        productId: 'abc1234',
        variantId: 'def5678',
      })
      expect(result.success).toBe(true)
    })

    it('rejects invalid productId format', () => {
      const result = CreateShareSchema.safeParse({
        productId: 'invalid-id-too-long',
      })
      expect(result.success).toBe(false)
    })
  })

  describe('ProductSchema', () => {
    it('validates a complete product', () => {
      const result = ProductSchema.safeParse({
        id: 'abc1234',
        name: 'Test Product',
        description: 'A test product description',
        image: 'https://example.com/image.jpg',
        images: [],
        category: 'Electronics',
        createdAt: '2024-01-01T00:00:00.000Z',
        updatedAt: '2024-01-01T00:00:00.000Z',
      })
      expect(result.success).toBe(true)
    })

    it('rejects invalid ID format', () => {
      const result = ProductSchema.safeParse({
        id: 'toolongid',
        name: 'Test',
        description: 'A description',
        image: 'https://example.com/img.jpg',
        category: 'Test',
        createdAt: '2024-01-01T00:00:00.000Z',
        updatedAt: '2024-01-01T00:00:00.000Z',
      })
      expect(result.success).toBe(false)
    })
  })

  describe('ProductInputSchema', () => {
    it('validates product input without id/timestamps', () => {
      const result = ProductInputSchema.safeParse({
        name: 'New Product',
        description: 'A new product',
        image: 'https://example.com/img.jpg',
        category: 'Clothing',
      })
      expect(result.success).toBe(true)
    })
  })

  describe('ProductUpdateSchema', () => {
    it('allows partial product updates', () => {
      const result = ProductUpdateSchema.safeParse({
        name: 'Updated Name',
      })
      expect(result.success).toBe(true)
    })

    it('allows empty update', () => {
      const result = ProductUpdateSchema.safeParse({})
      expect(result.success).toBe(true)
    })
  })
})
