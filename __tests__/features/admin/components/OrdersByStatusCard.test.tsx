import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import React from 'react'
import { OrdersByStatusCard } from '@/features/admin/components/OrdersByStatusCard'

describe('OrdersByStatusCard', () => {
  it('displays empty state when no orders exist', () => {
    render(<OrdersByStatusCard ordersByStatus={{}} />)

    expect(screen.getByText('Orders by status')).toBeInTheDocument()
    expect(screen.getByText('No active orders yet.')).toBeInTheDocument()
  })

  it('displays total order count', () => {
    const ordersByStatus = {
      PENDING: 5,
      PROCESSING: 3,
      DELIVERED: 10,
    }
    render(<OrdersByStatusCard ordersByStatus={ordersByStatus} />)

    expect(screen.getByText('18 active orders')).toBeInTheDocument()
  })

  it('displays orders sorted by count (descending)', () => {
    const ordersByStatus = {
      PENDING: 2,
      PROCESSING: 8,
      DELIVERED: 5,
    }
    render(<OrdersByStatusCard ordersByStatus={ordersByStatus} />)

    const statuses = screen.getAllByRole('listitem')
    expect(statuses[0]).toHaveTextContent('PROCESSING')
    expect(statuses[0]).toHaveTextContent('8')
    expect(statuses[1]).toHaveTextContent('DELIVERED')
    expect(statuses[1]).toHaveTextContent('5')
    expect(statuses[2]).toHaveTextContent('PENDING')
    expect(statuses[2]).toHaveTextContent('2')
  })

  it('renders progress bars with correct widths', () => {
    const ordersByStatus = {
      PENDING: 10,
      DELIVERED: 30,
    }
    render(<OrdersByStatusCard ordersByStatus={ordersByStatus} />)

    const progressBars = screen.getAllByRole('listitem')
    // DELIVERED should be first (30 orders = 75%)
    const deliveredBar = progressBars[0].querySelector('.bg-gradient-to-r')
    expect(deliveredBar).toHaveStyle({ width: '75%' })

    // PENDING should be second (10 orders = 25%)
    const pendingBar = progressBars[1].querySelector('.bg-gradient-to-r')
    expect(pendingBar).toHaveStyle({ width: '25%' })
  })

  it('ensures minimum 8% width for non-zero counts', () => {
    const ordersByStatus = {
      PENDING: 100,
      DELIVERED: 1, // 1% would be too small, should get 8% minimum
    }
    render(<OrdersByStatusCard ordersByStatus={ordersByStatus} />)

    const progressBars = screen.getAllByRole('listitem')
    const deliveredBar = progressBars[1].querySelector('.bg-gradient-to-r')
    expect(deliveredBar).toHaveStyle({ width: '8%' })
  })

  it('displays 0% width for zero counts', () => {
    const ordersByStatus = {
      PENDING: 10,
      CANCELLED: 0,
    }
    render(<OrdersByStatusCard ordersByStatus={ordersByStatus} />)

    const progressBars = screen.getAllByRole('listitem')
    const cancelledBar = progressBars[1].querySelector('.bg-gradient-to-r')
    expect(cancelledBar).toHaveStyle({ width: '0%' })
  })

  it('handles single status correctly', () => {
    const ordersByStatus = {
      PENDING: 25,
    }
    render(<OrdersByStatusCard ordersByStatus={ordersByStatus} />)

    expect(screen.getByText('25 active orders')).toBeInTheDocument()
    expect(screen.getByText('PENDING')).toBeInTheDocument()
    expect(screen.getByText('25')).toBeInTheDocument()

    const progressBar = screen.getByRole('listitem').querySelector('.bg-gradient-to-r')
    expect(progressBar).toHaveStyle({ width: '100%' })
  })

  it('displays descriptive subtitle', () => {
    const ordersByStatus = {
      PENDING: 5,
    }
    render(<OrdersByStatusCard ordersByStatus={ordersByStatus} />)

    expect(
      screen.getByText('A quick view of the current fulfilment mix.')
    ).toBeInTheDocument()
  })

  it('handles multiple statuses with equal counts', () => {
    const ordersByStatus = {
      PENDING: 10,
      PROCESSING: 10,
      DELIVERED: 10,
    }
    render(<OrdersByStatusCard ordersByStatus={ordersByStatus} />)

    expect(screen.getByText('30 active orders')).toBeInTheDocument()
    expect(screen.getAllByRole('listitem')).toHaveLength(3)

    // Each should have equal width (33.33%)
    const progressBars = screen.getAllByRole('listitem')
    for (const bar of progressBars) {
      const progressBar = bar.querySelector('.bg-gradient-to-r')
      const width = progressBar?.getAttribute('style')
      expect(width).toContain('33.33')
    }
  })
})
