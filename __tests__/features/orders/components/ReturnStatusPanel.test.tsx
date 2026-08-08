// @vitest-environment jsdom
import { describe, expect, it, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import {
  ReturnStatusPanel,
  type CustomerReturn,
} from '@/features/orders/components/ReturnStatusPanel'

vi.mock('@/contexts/CurrencyContext', () => ({
  useCurrency: () => ({
    formatPrice: (amount: number) => `₹${amount.toFixed(2)}`,
  }),
}))

const baseReturn: CustomerReturn = {
  id: 'r7N8p9Q',
  status: 'REQUESTED',
  reason: 'DAMAGED',
  decisionReason: null,
  refundAmount: 1200,
  createdAt: '2026-02-01T00:00:00.000Z',
  refund: null,
}

const renderPanel = (overrides: Partial<CustomerReturn> = {}) =>
  render(<ReturnStatusPanel returnRequest={{ ...baseReturn, ...overrides }} />)

describe('ReturnStatusPanel', () => {
  it('shows the reference a customer needs to quote to support', () => {
    renderPanel()

    expect(screen.getByText('r7N8p9Q')).toBeInTheDocument()
  })

  it('labels a new claim as under review', () => {
    renderPanel({ status: 'REQUESTED' })

    expect(screen.getByText('Under review')).toBeInTheDocument()
  })

  it('tells an approved customer to ship the item back', () => {
    renderPanel({ status: 'APPROVED' })

    expect(screen.getByText('Approved')).toBeInTheDocument()
    expect(screen.getByText(/send the item back/i)).toBeInTheDocument()
  })

  it('shows the rejection reason so the outcome is explicable', () => {
    renderPanel({ status: 'REJECTED', decisionReason: 'Outside the window' })

    expect(screen.getByText('Not approved')).toBeInTheDocument()
    expect(screen.getByText('Outside the window')).toBeInTheDocument()
  })

  it('omits the reason row when there is no decision reason', () => {
    renderPanel()

    expect(screen.queryByText('Reason:')).not.toBeInTheDocument()
  })

  it('warns that a refund takes time to land', () => {
    renderPanel({ status: 'REFUNDED' })

    expect(screen.getByText('Refunded')).toBeInTheDocument()
    expect(screen.getByText(/few working days/i)).toBeInTheDocument()
  })

  it('formats the refund through the currency context, never raw', () => {
    renderPanel({
      status: 'REFUNDED',
      refund: { amount: 1200, status: 'PROCESSED', processedAt: null },
    })

    expect(screen.getByText('₹1200.00')).toBeInTheDocument()
  })

  it('omits the refund row while no refund exists yet', () => {
    renderPanel({ status: 'RECEIVED' })

    expect(screen.queryByText('Refund:')).not.toBeInTheDocument()
  })

  it('names the reason the customer originally gave', () => {
    renderPanel({ reason: 'WRONG_ITEM' })

    expect(screen.getByText(/wrong item/i)).toBeInTheDocument()
  })
})
