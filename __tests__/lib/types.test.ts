import { describe, it, expect } from 'vitest'
import { OrderStatus } from '@/lib/types'

describe('types', () => {
  it('OrderStatus enum has all expected values', () => {
    expect(OrderStatus.PENDING).toBe('PENDING')
    expect(OrderStatus.PROCESSING).toBe('PROCESSING')
    expect(OrderStatus.SHIPPED).toBe('SHIPPED')
    expect(OrderStatus.DELIVERED).toBe('DELIVERED')
    expect(OrderStatus.CANCELLED).toBe('CANCELLED')
  })

  it('OrderStatus enum has exactly 5 members', () => {
    const values = Object.values(OrderStatus)
    expect(values).toHaveLength(5)
  })

  it('OrderStatus keys match values', () => {
    const entries = Object.entries(OrderStatus)
    for (const [key, value] of entries) {
      expect(key).toBe(value)
    }
  })
})
