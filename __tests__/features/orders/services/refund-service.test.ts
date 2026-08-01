import { beforeEach, describe, expect, it, vi } from 'vitest'

const {
  mockTransaction,
  mockDbUpdate,
  mockFindPreferences,
  mockGetPaymentGateway,
  mockDispatchWorkflowEvent,
  mockNotifyOrderRefundUpdate,
  mockInvalidateAdminOrderCaches,
  mockRecordAdminAuditLog,
  PaymentVerificationError,
  PaymentConfigurationError,
} = vi.hoisted(() => {
  class PaymentVerificationError extends Error {
    status: number
    constructor(message: string, status = 400) {
      super(message)
      this.status = status
    }
  }
  class PaymentConfigurationError extends Error {
    status: number
    constructor(message: string, status = 503) {
      super(message)
      this.status = status
    }
  }
  return {
    mockTransaction: vi.fn(),
    mockDbUpdate: vi.fn(),
    mockFindPreferences: vi.fn(),
    mockGetPaymentGateway: vi.fn(),
    mockDispatchWorkflowEvent: vi.fn(),
    mockNotifyOrderRefundUpdate: vi.fn(),
    mockInvalidateAdminOrderCaches: vi.fn(),
    mockRecordAdminAuditLog: vi.fn(),
    PaymentVerificationError,
    PaymentConfigurationError,
  }
})

vi.mock('@/lib/db', () => ({
  primaryDrizzleDb: { transaction: mockTransaction, update: mockDbUpdate },
  db: { users: { findPreferences: mockFindPreferences } },
}))

vi.mock('@/lib/schema', () => ({
  orders: {
    id: 'id',
    userId: 'userId',
    customerEmail: 'customerEmail',
    customerName: 'customerName',
    status: 'status',
    paymentStatus: 'paymentStatus',
    paymentProvider: 'paymentProvider',
    paymentTransactionId: 'paymentTransactionId',
    amountPaid: 'amountPaid',
    totalAmount: 'totalAmount',
    stockRestoredAt: 'stockRestoredAt',
  },
  orderItems: { orderId: 'orderId', variantId: 'variantId', quantity: 'qty' },
  productVariants: { id: 'id', stock: 'stock' },
  refunds: {
    id: 'id',
    orderId: 'orderId',
    amount: 'amount',
    status: 'status',
    reason: 'reason',
    gatewayRefundId: 'gatewayRefundId',
  },
}))

vi.mock('drizzle-orm', () => ({
  and: vi.fn((...args) => args),
  eq: vi.fn((...args) => args),
  ne: vi.fn((...args) => args),
  isNull: vi.fn((...args) => args),
  sql: Object.assign(
    vi.fn((...args) => args),
    { raw: vi.fn() }
  ),
}))

vi.mock('@/lib/payments', () => ({
  getPaymentGateway: mockGetPaymentGateway,
  PaymentVerificationError,
  PaymentConfigurationError,
}))

vi.mock('@/lib/env', () => ({
  env: { NEXT_PUBLIC_APP_URL: 'http://localhost:3000' },
}))

vi.mock('@/lib/inngest/dispatch', () => ({
  dispatchWorkflowEvent: mockDispatchWorkflowEvent,
}))

vi.mock('@/lib/notifications/order-notifications', () => ({
  notifyOrderRefundUpdate: mockNotifyOrderRefundUpdate,
}))

vi.mock('@/lib/cache', () => ({
  invalidateAdminOrderCaches: mockInvalidateAdminOrderCaches,
}))

vi.mock('@/lib/logger', () => ({
  logError: vi.fn(),
  logBusinessEvent: vi.fn(),
}))

vi.mock('@/features/admin/services/admin-audit-log', () => ({
  recordAdminAuditLog: mockRecordAdminAuditLog,
}))

import {
  isRefundRequestError,
  reconcileRefundWebhook,
  refundOrder,
} from '@/features/orders/services/refund-service'

/**
 * Minimal stand-in for a Drizzle query builder: every chained method returns the
 * same node, and awaiting the node (or calling `returning()`) yields `rows`.
 */
const chain = (rows: unknown[] = []) => {
  const node: Record<string, unknown> = {}
  const self = () => node
  for (const method of [
    'from',
    'where',
    'limit',
    'for',
    'values',
    'set',
    'innerJoin',
  ]) {
    node[method] = vi.fn(self)
  }
  node.returning = vi.fn(async () => rows)
  node.then = (
    resolve: (value: unknown) => unknown,
    reject: (reason: unknown) => unknown
  ) => Promise.resolve(rows).then(resolve, reject)
  return node
}

const paidOrder = {
  id: 'order1',
  userId: 'user1',
  customerEmail: 'customer@example.com',
  customerName: 'Customer',
  status: 'PROCESSING',
  paymentStatus: 'PAID',
  paymentProvider: 'RAZORPAY',
  paymentTransactionId: 'pay_123',
  amountPaid: 100,
  totalAmount: 100,
}

interface TxMocks {
  select: ReturnType<typeof vi.fn>
  insert: ReturnType<typeof vi.fn>
  update: ReturnType<typeof vi.fn>
}

/** Queue a transaction whose builders return `results` in call order. */
const queueTransaction = (results: {
  select?: unknown[][]
  insert?: unknown[][]
  update?: unknown[][]
}): TxMocks => {
  const make = (queue: unknown[][] = []) => {
    let index = 0
    return vi.fn(() => chain(queue[index++] ?? []))
  }
  const tx: TxMocks = {
    select: make(results.select),
    insert: make(results.insert),
    update: make(results.update),
  }
  mockTransaction.mockImplementationOnce(
    async (callback: (tx: TxMocks) => Promise<unknown>) => callback(tx)
  )
  return tx
}

const gatewayRefund = vi.fn()

beforeEach(() => {
  vi.clearAllMocks()
  gatewayRefund.mockResolvedValue({
    refundId: 'rfnd_1',
    status: 'processed',
    amount: 100,
  })
  mockGetPaymentGateway.mockReturnValue({ refund: gatewayRefund })
  mockFindPreferences.mockResolvedValue({ currencyPreference: 'INR' })
  mockDispatchWorkflowEvent.mockResolvedValue('published')
  mockRecordAdminAuditLog.mockResolvedValue(undefined)
  mockDbUpdate.mockImplementation(() => chain([]))
})

describe('refundOrder', () => {
  it('refunds the full outstanding amount and restocks the order', async () => {
    // prepare: order lookup, existing refunds, insert
    queueTransaction({ select: [[paidOrder], []], insert: [[{ id: 'ref1' }]] })
    // settle: update refund, update order, order items, restock claim
    queueTransaction({
      select: [[{ variantId: 'v1', quantity: 2 }]],
      update: [[], [], [{ id: 'order1' }], []],
    })

    const result = await refundOrder({
      orderId: 'order1',
      actor: { userId: 'admin1', role: 'ADMIN' },
    })

    expect(gatewayRefund).toHaveBeenCalledWith({
      paymentTransactionId: 'pay_123',
      amount: 100,
    })
    expect(result.refund).toMatchObject({
      id: 'ref1',
      amount: 100,
      status: 'PROCESSED',
      gatewayRefundId: 'rfnd_1',
    })
    expect(result.refundableBalance).toBe(0)
    expect(result.restocked).toBe(true)
    expect(mockInvalidateAdminOrderCaches).toHaveBeenCalledWith(
      'order1',
      'user1'
    )
    expect(mockRecordAdminAuditLog).toHaveBeenCalledWith(
      expect.objectContaining({ entity: 'order', action: 'refund' })
    )
    expect(mockDispatchWorkflowEvent).toHaveBeenCalledWith(
      expect.objectContaining({
        event: expect.objectContaining({ name: 'order/refunded' }),
      })
    )
  })

  it('issues a partial refund without restocking', async () => {
    queueTransaction({ select: [[paidOrder], []], insert: [[{ id: 'ref1' }]] })
    queueTransaction({ update: [[], []] })

    const result = await refundOrder({ orderId: 'order1', amount: 40 })

    expect(gatewayRefund).toHaveBeenCalledWith({
      paymentTransactionId: 'pay_123',
      amount: 40,
    })
    expect(result.refundableBalance).toBe(60)
    expect(result.restocked).toBe(false)
  })

  it('does not restock an order that has already shipped', async () => {
    queueTransaction({
      select: [[{ ...paidOrder, status: 'SHIPPED' }], []],
      insert: [[{ id: 'ref1' }]],
    })
    queueTransaction({ update: [[], []] })

    const result = await refundOrder({ orderId: 'order1' })

    expect(result.refundableBalance).toBe(0)
    expect(result.restocked).toBe(false)
  })

  it('counts pending refunds against the refundable balance', async () => {
    queueTransaction({
      select: [[paidOrder], [{ amount: 70 }]],
      insert: [[{ id: 'ref2' }]],
    })

    await expect(
      refundOrder({ orderId: 'order1', amount: 50 })
    ).rejects.toThrow('Refund amount exceeds the refundable balance of 30')
    expect(gatewayRefund).not.toHaveBeenCalled()
  })

  it('rejects a refund once the order is fully refunded', async () => {
    queueTransaction({ select: [[paidOrder], [{ amount: 100 }]] })

    await expect(refundOrder({ orderId: 'order1' })).rejects.toThrow(
      'Order has already been fully refunded'
    )
  })

  it('rejects a refund for an unpaid order', async () => {
    queueTransaction({
      select: [[{ ...paidOrder, paymentStatus: 'PENDING' }]],
    })

    await expect(refundOrder({ orderId: 'order1' })).rejects.toMatchObject({
      message: 'Only paid orders can be refunded',
      status: 409,
    })
  })

  it('rejects a refund for a missing order', async () => {
    queueTransaction({ select: [[]] })

    await expect(refundOrder({ orderId: 'missing' })).rejects.toMatchObject({
      status: 404,
    })
  })

  it('marks the refund failed when the gateway rejects it', async () => {
    queueTransaction({ select: [[paidOrder], []], insert: [[{ id: 'ref1' }]] })
    gatewayRefund.mockRejectedValueOnce(
      new PaymentVerificationError('Refund declined', 422)
    )

    const error = await refundOrder({ orderId: 'order1' }).catch((e) => e)

    expect(isRefundRequestError(error)).toBe(true)
    expect(error.status).toBe(422)
    expect(mockDbUpdate).toHaveBeenCalled()
  })

  it('surfaces a gateway-reported failure without restocking', async () => {
    queueTransaction({ select: [[paidOrder], []], insert: [[{ id: 'ref1' }]] })
    gatewayRefund.mockResolvedValueOnce({
      refundId: 'rfnd_1',
      status: 'failed',
      amount: 100,
    })

    await expect(refundOrder({ orderId: 'order1' })).rejects.toThrow(
      'The payment gateway rejected the refund'
    )
    expect(mockInvalidateAdminOrderCaches).not.toHaveBeenCalled()
  })

  it('rejects a non-positive refund amount', async () => {
    queueTransaction({ select: [[paidOrder], []] })

    await expect(refundOrder({ orderId: 'order1', amount: 0 })).rejects.toThrow(
      'Refund amount must be greater than zero'
    )
  })
})

describe('reconcileRefundWebhook', () => {
  const webhook = {
    provider: 'RAZORPAY' as const,
    gatewayRefundId: 'rfnd_1',
    paymentTransactionId: 'pay_123',
    status: 'PROCESSED' as const,
    amountInMinorUnits: 10000,
  }

  it('settles a pending refund and restocks a fully refunded order', async () => {
    queueTransaction({
      select: [
        [{ ...paidOrder, status: 'PROCESSING' }],
        [{ id: 'ref1', amount: 100, status: 'PENDING', reason: null }],
        [{ amount: 100 }],
        [{ variantId: 'v1', quantity: 1 }],
      ],
      update: [[], [], [{ id: 'order1' }], []],
    })

    const outcome = await reconcileRefundWebhook(webhook)

    expect(outcome).toMatchObject({
      amount: 100,
      isPartial: false,
      restocked: true,
    })
    expect(mockInvalidateAdminOrderCaches).toHaveBeenCalledWith(
      'order1',
      'user1'
    )
    expect(mockDispatchWorkflowEvent).toHaveBeenCalled()
  })

  it('does not restock a shipped order from a refund webhook', async () => {
    queueTransaction({
      select: [
        [{ ...paidOrder, status: 'SHIPPED' }],
        [{ id: 'ref1', amount: 100, status: 'PENDING', reason: null }],
        [{ amount: 100 }],
      ],
      update: [[], []],
    })

    const outcome = await reconcileRefundWebhook(webhook)

    expect(outcome).toMatchObject({ isPartial: false, restocked: false })
  })

  it('ignores a repeated delivery for an already settled refund', async () => {
    queueTransaction({
      select: [
        [paidOrder],
        [{ id: 'ref1', amount: 100, status: 'PROCESSED', reason: null }],
      ],
    })

    await expect(reconcileRefundWebhook(webhook)).resolves.toBeNull()
    expect(mockDispatchWorkflowEvent).not.toHaveBeenCalled()
  })

  it('ignores a delivery for an unknown payment', async () => {
    queueTransaction({ select: [[]] })

    await expect(reconcileRefundWebhook(webhook)).resolves.toBeNull()
  })

  it('records a refund issued from the gateway dashboard', async () => {
    queueTransaction({
      select: [[paidOrder], [], [{ amount: 40 }]],
      insert: [[{ id: 'ref9' }]],
      update: [[]],
    })

    const outcome = await reconcileRefundWebhook({
      ...webhook,
      amountInMinorUnits: 4000,
    })

    expect(outcome).toMatchObject({
      amount: 40,
      isPartial: true,
      restocked: false,
    })
  })

  it('rejects a gateway refund without a usable amount', async () => {
    queueTransaction({ select: [[paidOrder], []] })

    await expect(
      reconcileRefundWebhook({ ...webhook, amountInMinorUnits: null })
    ).rejects.toThrow('Invalid refund amount in webhook payload')
  })

  it('falls back to sending the email inline when Inngest is unavailable', async () => {
    queueTransaction({
      select: [
        [paidOrder],
        [{ id: 'ref1', amount: 100, status: 'PENDING', reason: null }],
        [{ amount: 100 }],
        [{ variantId: 'v1', quantity: 1 }],
      ],
      update: [[], [], [{ id: 'order1' }], []],
    })
    mockDispatchWorkflowEvent.mockImplementationOnce(
      async ({ fallback }: { fallback?: () => Promise<void> }) => {
        await fallback?.()
        return 'fallback'
      }
    )

    await reconcileRefundWebhook(webhook)

    expect(mockNotifyOrderRefundUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        to: 'customer@example.com',
        orderId: 'order1',
        status: 'PROCESSED',
      })
    )
  })
})
