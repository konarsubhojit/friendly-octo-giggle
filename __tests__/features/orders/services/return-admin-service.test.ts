import { beforeEach, describe, expect, it, vi } from 'vitest'

const {
  mockTransaction,
  mockUpdate,
  mockRestockReturnItems,
  mockRefundOrder,
  mockRecordAdminAuditLog,
  mockDispatchWorkflowEvent,
  mockDeliverReturnStatusNotification,
  mockLogBusinessEvent,
} = vi.hoisted(() => ({
  mockTransaction: vi.fn(),
  mockUpdate: vi.fn(),
  mockRestockReturnItems: vi.fn(),
  mockRefundOrder: vi.fn(),
  mockRecordAdminAuditLog: vi.fn(),
  mockDispatchWorkflowEvent: vi.fn(),
  mockDeliverReturnStatusNotification: vi.fn(),
  mockLogBusinessEvent: vi.fn(),
}))

vi.mock('@/lib/db', () => ({
  primaryDrizzleDb: { transaction: mockTransaction, update: mockUpdate },
}))

vi.mock('@/features/orders/services/return-restock', () => ({
  restockReturnItems: mockRestockReturnItems,
}))

vi.mock('@/features/orders/services/refund-service', () => ({
  refundOrder: mockRefundOrder,
}))

vi.mock('@/features/admin/services/admin-audit-log', () => ({
  recordAdminAuditLog: mockRecordAdminAuditLog,
}))

vi.mock('@/lib/inngest/dispatch', () => ({
  dispatchWorkflowEvent: mockDispatchWorkflowEvent,
}))

vi.mock('@/lib/notifications/order-notifications', () => ({
  deliverReturnStatusNotification: mockDeliverReturnStatusNotification,
}))

vi.mock('@/lib/logger', () => ({
  logBusinessEvent: mockLogBusinessEvent,
  logError: vi.fn(),
}))

import { decideReturn } from '@/features/orders/services/return-admin-service'
import { ReturnTransitionError } from '@/features/orders/services/return-state-machine'
import { MANUAL_SETTLEMENT_REASON_PREFIX } from '@/lib/constants/returns'

const ACTOR = { userId: 'admin-1', role: 'ADMIN' as const }

/**
 * Transaction stub driven by an ordered queue of query results.
 *
 * Every builder chain is awaitable at any point, so `.for('update')`,
 * `.returning()` and a bare `.where()` all resolve the next queued result.
 */
const stubTransaction = (results: unknown[][]) => {
  const queue = [...results]
  const inserted: unknown[] = []
  const updates: unknown[] = []

  const makeChain = (record?: (value: unknown) => void) => {
    const chain: Record<string, unknown> = {}
    for (const method of [
      'from',
      'where',
      'limit',
      'innerJoin',
      'orderBy',
      'for',
      'returning',
    ]) {
      chain[method] = vi.fn(() => chain)
    }
    chain.set = vi.fn((value: unknown) => {
      record?.(value)
      return chain
    })
    chain.values = vi.fn((value: unknown) => {
      record?.(value)
      return chain
    })
    chain.then = (resolve: (value: unknown) => unknown) =>
      resolve(queue.shift() ?? [])
    return chain
  }

  mockTransaction.mockImplementation(
    async (callback: (tx: unknown) => unknown) =>
      callback({
        select: vi.fn(() => makeChain()),
        update: vi.fn(() => makeChain((value) => updates.push(value))),
        insert: vi.fn(() => makeChain((value) => inserted.push(value))),
      })
  )

  // The refund path records its outcome outside any transaction, so that an
  // external gateway call never happens under a row lock.
  mockUpdate.mockImplementation(() => makeChain((value) => updates.push(value)))

  return { inserted, updates }
}

const currentReturn = (overrides: Record<string, unknown> = {}) => ({
  id: 'r7N8p9Q',
  orderId: 'ORD1234567',
  userId: 'user-1',
  status: 'RECEIVED',
  refundId: null,
  refundAmount: 1200,
  stockRestoredAt: null,
  ...overrides,
})

beforeEach(() => {
  vi.clearAllMocks()
  mockRestockReturnItems.mockResolvedValue(true)
  mockDispatchWorkflowEvent.mockResolvedValue(undefined)
  mockDeliverReturnStatusNotification.mockResolvedValue(undefined)
})

describe('decideReturn receive', () => {
  it('restocks and moves to RECEIVED without creating a refund', async () => {
    stubTransaction([
      [currentReturn({ status: 'APPROVED' })],
      [{ variantId: 'varAAAA', quantity: 2 }],
      [],
    ])

    const result = await decideReturn('r7N8p9Q', 'receive', ACTOR)

    expect(result.status).toBe('RECEIVED')
    expect(result.restocked).toBe(true)
    // Money is a separate, separately permissioned action.
    expect(result.refund).toBeNull()
    expect(mockRefundOrder).not.toHaveBeenCalled()
  })

  it('reports a replayed receive as not restocked', async () => {
    // The guarded claim on `stockRestoredAt` already fired, so stock must not
    // move a second time.
    mockRestockReturnItems.mockResolvedValue(false)
    stubTransaction([
      [currentReturn({ status: 'APPROVED' })],
      [{ variantId: 'varAAAA', quantity: 2 }],
      [],
    ])

    const result = await decideReturn('r7N8p9Q', 'receive', ACTOR)

    expect(result.restocked).toBe(false)
  })

  it('refuses to receive a return that is not approved', async () => {
    stubTransaction([[currentReturn({ status: 'REQUESTED' })]])

    await expect(
      decideReturn('r7N8p9Q', 'receive', ACTOR)
    ).rejects.toBeInstanceOf(ReturnTransitionError)
  })
})

describe('decideReturn refund', () => {
  it('creates exactly one refund and moves to REFUNDED', async () => {
    mockRefundOrder.mockResolvedValue({
      refund: { id: 'ref00001', amount: 1200, status: 'PROCESSED' },
    })
    stubTransaction([
      [currentReturn()],
      [{ id: 'ORD1234567', paymentProvider: 'RAZORPAY', totalAmount: 5000 }],
      [],
    ])

    const result = await decideReturn('r7N8p9Q', 'refund', ACTOR)

    expect(result.status).toBe('REFUNDED')
    expect(result.refund?.id).toBe('ref00001')
    expect(mockRefundOrder).toHaveBeenCalledTimes(1)
    expect(mockRefundOrder).toHaveBeenCalledWith(
      expect.objectContaining({
        orderId: 'ORD1234567',
        amount: 1200,
        returnRequestId: 'r7N8p9Q',
      })
    )
  })

  it('replaying refund produces no second refund row', async () => {
    stubTransaction([
      [currentReturn({ status: 'RECEIVED', refundId: 'ref00001' })],
      [{ id: 'ref00001', amount: 1200, status: 'PROCESSED' }],
    ])

    const result = await decideReturn('r7N8p9Q', 'refund', ACTOR)

    expect(result.refund?.id).toBe('ref00001')
    expect(mockRefundOrder).not.toHaveBeenCalled()
  })

  it('leaves the return at RECEIVED when the gateway rejects', async () => {
    // The whole transaction unwinds, so `refundId` stays unset and the status
    // change never lands — which is what makes the retry below legal.
    mockRefundOrder.mockRejectedValue(new Error('Gateway declined'))
    stubTransaction([
      [currentReturn()],
      [{ id: 'ORD1234567', paymentProvider: 'RAZORPAY', totalAmount: 5000 }],
    ])

    await expect(decideReturn('r7N8p9Q', 'refund', ACTOR)).rejects.toThrow(
      'Gateway declined'
    )
    expect(mockRecordAdminAuditLog).not.toHaveBeenCalled()
  })

  it('succeeds on a retry after a gateway rejection', async () => {
    mockRefundOrder.mockResolvedValue({
      refund: { id: 'ref00002', amount: 1200, status: 'PROCESSED' },
    })
    stubTransaction([
      [currentReturn({ status: 'RECEIVED', refundId: null })],
      [{ id: 'ORD1234567', paymentProvider: 'RAZORPAY', totalAmount: 5000 }],
      [],
    ])

    const result = await decideReturn('r7N8p9Q', 'refund', ACTOR)

    expect(result.status).toBe('REFUNDED')
    expect(result.refund?.id).toBe('ref00002')
  })

  it('refuses to refund a return that has not been received', async () => {
    stubTransaction([[currentReturn({ status: 'APPROVED' })]])

    await expect(
      decideReturn('r7N8p9Q', 'refund', ACTOR)
    ).rejects.toBeInstanceOf(ReturnTransitionError)
  })
})

describe('decideReturn refund for Cash on Delivery', () => {
  const stubCod = () =>
    stubTransaction([
      // Phase 1: lock the return, then read the order's provider.
      [currentReturn()],
      [{ id: 'ORD1234567', paymentProvider: 'COD' }],
      // Phase 2: manual settlement locks the order, sums the refund ledger,
      // inserts the row, then updates paymentStatus.
      [{ id: 'ORD1234567', amountPaid: 5000 }],
      [],
      [{ id: 'ref00003', amount: 1200, status: 'PENDING' }],
      [],
      // Phase 3: record the outcome on the return.
      [],
    ])

  it('never calls the gateway', async () => {
    // `codGateway.refund()` throws by design: nothing was captured at
    // checkout, so there is nothing to reverse.
    stubCod()

    await decideReturn('r7N8p9Q', 'refund', ACTOR)

    expect(mockRefundOrder).not.toHaveBeenCalled()
  })

  it('writes a PENDING row with no payment transaction and a manual prefix', async () => {
    const { inserted } = stubCod()

    const result = await decideReturn('r7N8p9Q', 'refund', ACTOR)

    expect(result.refund).toMatchObject({ id: 'ref00003', status: 'PENDING' })
    expect(inserted[0]).toMatchObject({
      provider: 'COD',
      paymentTransactionId: null,
      returnRequestId: 'r7N8p9Q',
      amount: 1200,
      status: 'PENDING',
    })
    expect(
      (inserted[0] as { reason: string }).reason.startsWith(
        MANUAL_SETTLEMENT_REASON_PREFIX
      )
    ).toBe(true)
  })
})

describe('decideReturn settle', () => {
  it('flips the pending refund to PROCESSED', async () => {
    stubTransaction([
      [currentReturn({ status: 'REFUNDED', refundId: 'ref00003' })],
      [{ id: 'ref00003', amount: 1200, status: 'PROCESSED' }],
    ])

    const result = await decideReturn('r7N8p9Q', 'settle', ACTOR)

    expect(result.refund?.status).toBe('PROCESSED')
    // The return's own status does not move; only the money does.
    expect(result.status).toBe('REFUNDED')
  })

  it('refuses when the refund is not awaiting manual settlement', async () => {
    // The guarded UPDATE matched nothing, so the row was already processed.
    stubTransaction([
      [currentReturn({ status: 'REFUNDED', refundId: 'ref00003' })],
      [],
    ])

    await expect(
      decideReturn('r7N8p9Q', 'settle', ACTOR)
    ).rejects.toMatchObject({ status: 409 })
  })

  it('refuses when there is no refund at all', async () => {
    stubTransaction([[currentReturn({ status: 'REFUNDED', refundId: null })]])

    await expect(
      decideReturn('r7N8p9Q', 'settle', ACTOR)
    ).rejects.toMatchObject({ status: 409 })
  })
})

describe('decideReturn approve and reject', () => {
  it('requires a reason on approve', async () => {
    stubTransaction([[currentReturn({ status: 'REQUESTED' })]])

    await expect(
      decideReturn('r7N8p9Q', 'approve', ACTOR, '   ')
    ).rejects.toMatchObject({ status: 400 })
  })

  it('requires a reason on reject', async () => {
    stubTransaction([[currentReturn({ status: 'REQUESTED' })]])

    await expect(
      decideReturn('r7N8p9Q', 'reject', ACTOR)
    ).rejects.toMatchObject({ status: 400 })
  })

  it('records an audit row carrying both statuses and the reason', async () => {
    stubTransaction([[currentReturn({ status: 'REQUESTED' })], []])

    await decideReturn('r7N8p9Q', 'approve', ACTOR, 'Photos show breakage')

    expect(mockRecordAdminAuditLog).toHaveBeenCalledWith(
      expect.objectContaining({
        entity: 'return',
        entityId: 'r7N8p9Q',
        action: 'approve',
        diff: expect.objectContaining({
          fromStatus: 'REQUESTED',
          toStatus: 'APPROVED',
          decisionReason: 'Photos show breakage',
        }),
      })
    )
  })

  it('reports a missing return as not found', async () => {
    stubTransaction([[]])

    await expect(
      decideReturn('r7N8p9Q', 'approve', ACTOR, 'Approved')
    ).rejects.toMatchObject({ status: 404 })
  })
})

describe('concurrent decisions', () => {
  it('serialises so the loser is refused by the transition check', async () => {
    // Both administrators read under `FOR UPDATE`, so the second sees the
    // status the first produced. `REQUESTED -> approve` is legal;
    // `APPROVED -> approve` is not.
    const statuses = ['REQUESTED', 'APPROVED']
    let call = 0
    mockTransaction.mockImplementation(
      async (callback: (tx: unknown) => unknown) => {
        const status = statuses[call] ?? 'APPROVED'
        call += 1
        const rows: unknown[][] = [[currentReturn({ status })], []]
        const makeChain = () => {
          const chain: Record<string, unknown> = {}
          for (const method of [
            'from',
            'where',
            'limit',
            'for',
            'returning',
            'set',
            'values',
          ]) {
            chain[method] = vi.fn(() => chain)
          }
          chain.then = (resolve: (value: unknown) => unknown) =>
            resolve(rows.shift() ?? [])
          return chain
        }
        return callback({
          select: vi.fn(() => makeChain()),
          update: vi.fn(() => makeChain()),
          insert: vi.fn(() => makeChain()),
        })
      }
    )

    const first = await decideReturn('r7N8p9Q', 'approve', ACTOR, 'Approved')
    expect(first.status).toBe('APPROVED')

    await expect(
      decideReturn('r7N8p9Q', 'approve', ACTOR, 'Approved again')
    ).rejects.toBeInstanceOf(ReturnTransitionError)
  })
})
