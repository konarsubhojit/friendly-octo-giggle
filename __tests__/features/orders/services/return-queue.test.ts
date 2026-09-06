import { describe, it, expect, vi, beforeEach } from 'vitest'

const { mockSelect, mockItemsWhere, mockEvidenceOrderBy } = vi.hoisted(() => {
  const mockItemsWhere = vi.fn()
  const mockItemsFrom = vi.fn(() => ({ where: mockItemsWhere }))

  const mockEvidenceOrderBy = vi.fn()
  const mockEvidenceWhere = vi.fn(() => ({ orderBy: mockEvidenceOrderBy }))
  const mockEvidenceFrom = vi.fn(() => ({ where: mockEvidenceWhere }))

  let call = 0
  const mockSelect = vi.fn(() => {
    call += 1
    return call === 1 ? { from: mockItemsFrom } : { from: mockEvidenceFrom }
  })

  return { mockSelect, mockItemsWhere, mockEvidenceOrderBy }
})

vi.mock('@/lib/db', () => ({
  primaryDrizzleDb: { select: mockSelect },
}))

vi.mock('@/lib/schema', () => ({
  returnItems: {
    returnRequestId: 'returnRequestId',
    orderItemId: 'orderItemId',
    quantity: 'quantity',
    refundableAmount: 'refundableAmount',
  },
  returnEvidence: {
    returnRequestId: 'returnRequestId',
    id: 'id',
    url: 'url',
    createdAt: 'createdAt',
  },
}))

import { withItemsAndEvidence } from '@/features/orders/services/return-queue'

describe('withItemsAndEvidence', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('returns an empty array without querying when the page is empty', async () => {
    const result = await withItemsAndEvidence([])

    expect(result).toEqual([])
    expect(mockSelect).not.toHaveBeenCalled()
  })

  it('attaches items and evidence scoped to each row', async () => {
    mockItemsWhere.mockResolvedValue([
      {
        returnRequestId: 'ret1',
        orderItemId: 'item1',
        quantity: 2,
        refundableAmount: 500,
      },
      {
        returnRequestId: 'ret2',
        orderItemId: 'item2',
        quantity: 1,
        refundableAmount: 250,
      },
    ])
    mockEvidenceOrderBy.mockResolvedValue([
      { returnRequestId: 'ret1', id: 'evid1', url: '/evid1.png' },
    ])

    const createdAt = new Date('2026-02-01T00:00:00.000Z')
    const result = await withItemsAndEvidence([
      { id: 'ret1', createdAt },
      { id: 'ret2', createdAt },
    ])

    expect(result).toEqual([
      {
        id: 'ret1',
        createdAt: createdAt.toISOString(),
        items: [{ orderItemId: 'item1', quantity: 2, refundableAmount: 500 }],
        evidence: [{ id: 'evid1', url: '/evid1.png' }],
      },
      {
        id: 'ret2',
        createdAt: createdAt.toISOString(),
        items: [{ orderItemId: 'item2', quantity: 1, refundableAmount: 250 }],
        evidence: [],
      },
    ])
  })
})
