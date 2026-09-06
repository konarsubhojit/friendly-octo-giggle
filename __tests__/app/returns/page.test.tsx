// @vitest-environment jsdom
import { describe, expect, it, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import React from 'react'
import ReturnsPage from '@/app/(public)/returns/page'

vi.mock('next/link', () => ({
  default: ({
    children,
    href,
  }: {
    children: React.ReactNode
    href: string
  }) => <a href={href}>{children}</a>,
}))

vi.mock('@/components/layout/Footer', () => ({
  default: () => <div data-testid="footer" />,
}))

describe('ReturnsPage', () => {
  it('renders the shared damaged-item policy', () => {
    render(<ReturnsPage />)

    expect(
      screen.getAllByText(/damaged, defective, or incorrect/i).length
    ).toBeGreaterThan(0)
    expect(screen.getAllByText(/short video/i).length).toBeGreaterThan(0)
    expect(
      screen.getByText(/shipping cost to send the damaged product back/i)
    ).toBeInTheDocument()
    expect(
      screen.getAllByText(/replacement product/i).length
    ).toBeGreaterThanOrEqual(1)
  })

  it('describes the in-product claim route rather than an email-only one', () => {
    // The published promise has to match the shipped mechanism; a page still
    // telling customers to email support contradicts the feature.
    render(<ReturnsPage />)

    expect(screen.getAllByText(/start a return/i).length).toBeGreaterThan(0)
    expect(
      screen.getAllByText(/within 7 days of delivery/i).length
    ).toBeGreaterThan(0)
  })

  it('no longer claims refunds are never issued', () => {
    render(<ReturnsPage />)

    expect(
      screen.queryByText(/refunds are not issued for orders/i)
    ).not.toBeInTheDocument()
  })
})
