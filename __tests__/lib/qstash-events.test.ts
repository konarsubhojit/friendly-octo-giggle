import { describe, it, expect } from 'vitest'
import { QStashEmailEventSchema } from '@/lib/qstash-events'

const validOrderCreatedPayload = {
  type: 'order.created' as const,
  data: {
    orderId: 'abc1234',
    customerEmail: 'user@example.com',
    customerName: 'Jane Doe',
    customerAddress: '123 Main St, Springfield',
    totalAmount: 4999,
    items: [
      { name: 'Blue Widget', quantity: 2, price: 1999 },
      { name: 'Red Gadget', quantity: 1, price: 1001 },
    ],
  },
}

const validOrderStatusChangedPayload = {
  type: 'order.status_changed' as const,
  data: {
    orderId: 'abc1234',
    customerEmail: 'user@example.com',
    customerName: 'Jane Doe',
    newStatus: 'SHIPPED' as const,
    trackingNumber: '1Z999AA10123456784',
    shippingProvider: 'UPS',
  },
}

describe('QStashEmailEventSchema', () => {
  describe('order.created', () => {
    it('accepts a valid order.created event', () => {
      const result = QStashEmailEventSchema.safeParse(validOrderCreatedPayload)
      expect(result.success).toBe(true)
      if (result.success && result.data.type === 'order.created') {
        expect(result.data.type).toBe('order.created')
        expect(result.data.data.orderId).toBe('abc1234')
        expect(result.data.data.items).toHaveLength(2)
      }
    })

    it('rejects missing orderId', () => {
      const payload = {
        ...validOrderCreatedPayload,
        data: { ...validOrderCreatedPayload.data, orderId: '' },
      }
      const result = QStashEmailEventSchema.safeParse(payload)
      expect(result.success).toBe(false)
    })

    it('rejects invalid customerEmail', () => {
      const payload = {
        ...validOrderCreatedPayload,
        data: {
          ...validOrderCreatedPayload.data,
          customerEmail: 'not-an-email',
        },
      }
      const result = QStashEmailEventSchema.safeParse(payload)
      expect(result.success).toBe(false)
    })

    it('rejects negative totalAmount', () => {
      const payload = {
        ...validOrderCreatedPayload,
        data: { ...validOrderCreatedPayload.data, totalAmount: -1 },
      }
      const result = QStashEmailEventSchema.safeParse(payload)
      expect(result.success).toBe(false)
    })

    it('rejects zero totalAmount', () => {
      const payload = {
        ...validOrderCreatedPayload,
        data: { ...validOrderCreatedPayload.data, totalAmount: 0 },
      }
      const result = QStashEmailEventSchema.safeParse(payload)
      expect(result.success).toBe(false)
    })
  })

  describe('order.status_changed', () => {
    it('accepts a valid order.status_changed event', () => {
      const result = QStashEmailEventSchema.safeParse(
        validOrderStatusChangedPayload
      )
      expect(result.success).toBe(true)
      if (result.success && result.data.type === 'order.status_changed') {
        expect(result.data.type).toBe('order.status_changed')
        expect(result.data.data.newStatus).toBe('SHIPPED')
      }
    })

    it('accepts null for trackingNumber and shippingProvider', () => {
      const payload = {
        ...validOrderStatusChangedPayload,
        data: {
          ...validOrderStatusChangedPayload.data,
          trackingNumber: null,
          shippingProvider: null,
        },
      }
      const result = QStashEmailEventSchema.safeParse(payload)
      expect(result.success).toBe(true)
    })

    it('rejects non-enum newStatus', () => {
      const payload = {
        ...validOrderStatusChangedPayload,
        data: {
          ...validOrderStatusChangedPayload.data,
          newStatus: 'UNKNOWN_STATUS',
        },
      }
      const result = QStashEmailEventSchema.safeParse(payload)
      expect(result.success).toBe(false)
    })

    it('rejects invalid customerEmail', () => {
      const payload = {
        ...validOrderStatusChangedPayload,
        data: {
          ...validOrderStatusChangedPayload.data,
          customerEmail: 'bad-email',
        },
      }
      const result = QStashEmailEventSchema.safeParse(payload)
      expect(result.success).toBe(false)
    })
  })

  describe('discriminated union', () => {
    it('rejects unknown type discriminant', () => {
      const payload = {
        type: 'order.unknown',
        data: { orderId: 'abc1234', customerEmail: 'user@example.com' },
      }
      const result = QStashEmailEventSchema.safeParse(payload)
      expect(result.success).toBe(false)
    })

    it('rejects payload with no type field', () => {
      const result = QStashEmailEventSchema.safeParse({
        data: { orderId: 'abc1234' },
      })
      expect(result.success).toBe(false)
    })
  })
})
