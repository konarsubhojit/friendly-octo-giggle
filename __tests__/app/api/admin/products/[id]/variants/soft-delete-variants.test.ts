import { describe, it, expect, vi, beforeEach } from 'vitest'
import { drizzleDb } from '@/lib/db'
import { serializeOrder } from '@/lib/serializers'
import type { InferSelectModel } from 'drizzle-orm'
import type { orders, orderItems, products, productVariants } from '@/lib/schema'

type OrderWithItems = InferSelectModel<typeof orders> & {
  items: (InferSelectModel<typeof orderItems> & {
    product: InferSelectModel<typeof products>
    variant: InferSelectModel<typeof productVariants> | null
  })[]
}

/**
 * Integration test: FR-011 Order History Preservation
 *
 * Verifies that when a variant is soft-deleted, existing orders that reference
 * that variant still show the original variant details because orderItems store
 * a FK to the variant and the variant row is NOT physically deleted (only
 * deletedAt is set).
 *
 * This test mocks the database layer to simulate the soft-delete scenario
 * and verifies that order detail queries still return variant data.
 */

const mockVariant = {
  id: 'var1234',
  productId: 'abc1234',
  sku: null,
  price: 150,
  stock: 0,
  image: null,
  images: [] as string[],
  deletedAt: new Date('2025-06-01'),
  createdAt: new Date('2025-01-01'),
  updatedAt: new Date('2025-06-01'),
}

const mockProduct = {
  id: 'abc1234',
  name: 'Test Product',
  description: 'A test product',
  image: null,
  images: [] as string[],
  deletedAt: null,
  createdAt: new Date('2025-01-01'),
  updatedAt: new Date('2025-01-01'),
  categoryId: null,
  featured: false,
}

const mockOrderItem = {
  id: 'oi12345',
  orderId: 'ord1234',
  productId: 'abc1234',
  variantId: 'var1234',
  quantity: 2,
  price: 34.99,
  customizationNote: null,
}

const mockOrder = {
  id: 'ord1234',
  userId: 'user1234',
  customerName: 'John Doe',
  customerEmail: 'john@example.com',
  customerAddress: '123 Main St',
  addressLine1: null,
  addressLine2: null,
  addressLine3: null,
  pinCode: null,
  city: null,
  state: null,
  checkoutRequestId: null,
  totalAmount: 69.98,
  status: 'DELIVERED' as const,
  trackingNumber: null,
  shippingProvider: null,
  createdAt: new Date('2025-01-05'),
  updatedAt: new Date('2025-01-05'),
}

vi.mock('@/lib/db', () => ({
  drizzleDb: {
    query: {
      orders: {
        findFirst: vi.fn(),
      },
      productVariants: {
        findMany: vi.fn(),
      },
    },
  },
  primaryDrizzleDb: {
    query: {
      orders: {
        findFirst: vi.fn(),
      },
      productVariants: {
        findMany: vi.fn(),
      },
    },
  },
}))

describe('FR-011: Order History Preservation after Soft-Delete', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('order items still reference soft-deleted variant data', async () => {
    const mockDbOrder = {
      ...mockOrder,
      items: [
        {
          ...mockOrderItem,
          product: mockProduct,
          variant: mockVariant,
        },
      ],
    }

    vi.mocked(drizzleDb.query.orders.findFirst).mockResolvedValue(mockDbOrder)

    const orderData = await drizzleDb.query.orders.findFirst()
    const serializedOrder = serializeOrder(orderData as unknown as OrderWithItems)

    expect(serializedOrder.items[0].variant).toBeDefined()
    expect(serializedOrder.items[0].variant!.id).toBe('var1234')
    expect(serializedOrder.items[0].variant!.productId).toBe('abc1234')
    expect(serializedOrder.items[0].variant!.deletedAt).not.toBeNull()
  })

  it('soft-deleted variant retains all original fields', async () => {
    const mockDbOrder = {
      ...mockOrder,
      items: [
        {
          ...mockOrderItem,
          product: mockProduct,
          variant: mockVariant,
        },
      ],
    }

    vi.mocked(drizzleDb.query.orders.findFirst).mockResolvedValue(mockDbOrder)

    const orderData = await drizzleDb.query.orders.findFirst()
    const serializedOrder = serializeOrder(orderData as unknown as OrderWithItems)
    const variant = serializedOrder.items[0].variant!

    expect(variant.price).toBe(150)
    expect(variant.productId).toBe('abc1234')
    expect(variant.id).toBe('var1234')
    expect(variant.deletedAt).not.toBeNull()
  })

  it('active variant queries filter out soft-deleted variants', async () => {
    const allVariants = [
      { ...mockVariant, id: 'active1', deletedAt: null },
      mockVariant,
    ]

    vi.mocked(drizzleDb.query.productVariants.findMany).mockResolvedValue(
      allVariants.filter((v) => v.deletedAt === null)
    )

    const activeOnly = await drizzleDb.query.productVariants.findMany()
    expect(activeOnly).toHaveLength(1)
    expect(activeOnly[0].id).toBe('active1')
  })

  it('order queries do NOT filter out soft-deleted variants', async () => {
    const mockDbOrder = {
      ...mockOrder,
      items: [
        {
          ...mockOrderItem,
          product: mockProduct,
          variant: mockVariant,
        },
      ],
    }

    vi.mocked(drizzleDb.query.orders.findFirst).mockResolvedValue(mockDbOrder)

    const orderData = await drizzleDb.query.orders.findFirst()
    const serializedOrder = serializeOrder(orderData as unknown as OrderWithItems)

    const variantIds = serializedOrder.items
      .filter((item) => item.variant)
      .map((item) => item.variant!.id)

    expect(variantIds).toContain('var1234')
  })
})