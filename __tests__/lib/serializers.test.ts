import { describe, it, expect } from 'vitest'
import { serializeOrder, serializeOrders } from '@/lib/serializers'

const mockDate = new Date('2024-06-15T12:00:00.000Z')
const mockISOString = '2024-06-15T12:00:00.000Z'

const makeProduct = (overrides = {}) => ({
  id: '550e8400-e29b-41d4-a716-446655440000',
  name: 'Test Product',
  description: 'A test product',
  price: 29.99,
  image: 'https://example.com/image.jpg',
  stock: 10,
  category: 'Electronics',
  createdAt: mockDate,
  updatedAt: mockDate,
  ...overrides,
})

const makeVariation = (overrides = {}) => ({
  id: '660e8400-e29b-41d4-a716-446655440000',
  productId: '550e8400-e29b-41d4-a716-446655440000',
  sku: null,
  price: 150.0,
  stock: 3,
  image: null,
  images: [],
  createdAt: mockDate,
  updatedAt: mockDate,
  deletedAt: null,
  ...overrides,
})

const makeOrderItem = (overrides = {}) => ({
  id: '770e8400-e29b-41d4-a716-446655440000',
  orderId: '880e8400-e29b-41d4-a716-446655440000',
  productId: '550e8400-e29b-41d4-a716-446655440000',
  variantId: null,
  quantity: 2,
  price: 29.99,
  customizationNote: null,
  product: makeProduct(),
  variant: null,
  ...overrides,
})

const makeOrder = (overrides = {}) => ({
  id: '880e8400-e29b-41d4-a716-446655440000',
  userId: 'user-1',
  customerName: 'John Doe',
  customerEmail: 'john@example.com',
  customerAddress: '123 Main St, Anytown USA 12345',
  totalAmount: 59.98,
  status: 'PENDING',
  trackingNumber: null,
  shippingProvider: null,
  createdAt: mockDate,
  updatedAt: mockDate,
  items: [makeOrderItem()],
  ...overrides,
})

describe('serializeOrder', () => {
  it('converts Date fields to ISO strings at order level', () => {
    const result = serializeOrder(makeOrder() as never)
    expect(result.createdAt).toBe(mockISOString)
    expect(result.updatedAt).toBe(mockISOString)
  })

  it('converts Date fields on nested product', () => {
    const result = serializeOrder(makeOrder() as never)
    expect(result.items[0].product.createdAt).toBe(mockISOString)
    expect(result.items[0].product.updatedAt).toBe(mockISOString)
  })

  it('handles variant = null', () => {
    const result = serializeOrder(makeOrder() as never)
    expect(result.items[0].variant).toBeNull()
  })

  it('converts Date fields on nested variant', () => {
    const order = makeOrder({
      items: [makeOrderItem({ variant: makeVariation() })],
    })
    const result = serializeOrder(order as never)
    expect(result.items[0].variant?.createdAt).toBe(mockISOString)
    expect(result.items[0].variant?.updatedAt).toBe(mockISOString)
  })

  it('handles string dates (from cache) as passthrough', () => {
    const order = makeOrder({
      createdAt: mockISOString,
      updatedAt: mockISOString,
      items: [
        makeOrderItem({
          product: makeProduct({
            createdAt: mockISOString,
            updatedAt: mockISOString,
          }),
        }),
      ],
    })
    const result = serializeOrder(order as never)
    expect(result.createdAt).toBe(mockISOString)
    expect(result.items[0].product.createdAt).toBe(mockISOString)
  })

  it('preserves non-date fields', () => {
    const result = serializeOrder(makeOrder() as never)
    expect(result.customerName).toBe('John Doe')
    expect(result.totalAmount).toBe(59.98)
    expect(result.status).toBe('PENDING')
  })
})

describe('serializeOrders', () => {
  it('serializes array of orders', () => {
    const orders = [
      makeOrder(),
      makeOrder({ id: '990e8400-e29b-41d4-a716-446655440000' }),
    ]
    const result = serializeOrders(orders as never[])
    expect(result).toHaveLength(2)
    expect(result[0].createdAt).toBe(mockISOString)
    expect(result[1].createdAt).toBe(mockISOString)
  })

  it('returns empty array for empty input', () => {
    expect(serializeOrders([])).toEqual([])
  })
})
