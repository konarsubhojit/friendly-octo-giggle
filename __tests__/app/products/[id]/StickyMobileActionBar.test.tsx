// @vitest-environment jsdom
import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import React from 'react'
import { StickyMobileActionBar } from '@/app/[locale]/(public)/products/[id]/components/StickyMobileActionBar'

vi.mock('@/components/ui/LocaleLink', () => ({
  __esModule: true,
  default: ({
    children,
    href,
    className,
  }: {
    children: React.ReactNode
    href: string
    className?: string
  }) => (
    <a href={href} className={className}>
      {children}
    </a>
  ),
}))

vi.mock('@/features/wishlist/components/WishlistButton', () => ({
  WishlistButton: () => <button type="button">wishlist</button>,
}))

const baseProps = {
  remainingStock: 5,
  addingToCart: false,
  handleAddToCart: vi.fn(),
  productId: 'p1',
  productName: 'Test',
  effectivePrice: 100,
  quantity: 1,
  quantityMessage: '',
  setQuantity: vi.fn(),
  formatPrice: (n: number) => `$${n.toFixed(2)}`,
}

const renderBar = (overrides: Partial<typeof baseProps> = {}) =>
  render(<StickyMobileActionBar {...baseProps} {...overrides} />)

describe('StickyMobileActionBar', () => {
  it('renders within a <section aria-label="Quick actions"> (S6819)', () => {
    renderBar()
    const region = screen.getByRole('region', { name: 'Quick actions' })
    expect(region.tagName).toBe('SECTION')
  })

  it('shows price multiplied by quantity', () => {
    renderBar({ quantity: 3 })
    expect(screen.getByText('$300.00')).toBeInTheDocument()
  })

  it('enables "Add to Cart" when stock is available', () => {
    renderBar()
    const cta = screen.getByRole('button', { name: /add to cart/i })
    expect(cta).not.toBeDisabled()
    fireEvent.click(cta)
    expect(baseProps.handleAddToCart).toHaveBeenCalledTimes(1)
  })

  it('shows "Out of Stock" and disables CTA when remainingStock is 0', () => {
    renderBar({ remainingStock: 0 })
    const cta = screen.getByRole('button', { name: /out of stock/i })
    expect(cta).toBeDisabled()
    expect(cta).toHaveAttribute('aria-disabled', 'true')
  })

  it('shows "Adding…" while addingToCart is true', () => {
    renderBar({ addingToCart: true })
    const cta = screen.getByRole('button', { name: /adding/i })
    expect(cta).toBeDisabled()
  })

  it('hides the quantity selector when out of stock', () => {
    renderBar({ remainingStock: 0 })
    expect(screen.queryByLabelText(/select quantity/i)).toBeNull()
    expect(screen.queryByRole('link', { name: /view cart/i })).toBeNull()
  })

  it('shows quantity selector + View Cart link when in stock', () => {
    renderBar({ remainingStock: 4 })
    const select = screen.getByLabelText(/select quantity/i) as HTMLSelectElement
    expect(select).toBeInTheDocument()
    // remainingStock=4 → options 1..4
    expect(select.querySelectorAll('option')).toHaveLength(4)

    const setQuantity = vi.fn()
    renderBar({ remainingStock: 4, setQuantity })
    const select2 = screen.getAllByLabelText(/select quantity/i)[1] as HTMLSelectElement
    fireEvent.change(select2, { target: { value: '3' } })
    expect(setQuantity).toHaveBeenCalledWith(3)

    expect(screen.getAllByRole('link', { name: /view cart/i }).length).toBeGreaterThan(0)
  })

  it('caps quantity options at 10 even when remainingStock is higher', () => {
    renderBar({ remainingStock: 25 })
    const select = screen.getByLabelText(/select quantity/i) as HTMLSelectElement
    expect(select.querySelectorAll('option')).toHaveLength(10)
  })

  it('renders the quantity message and links it via aria-describedby', () => {
    renderBar({ quantityMessage: 'Only 3 left' })
    const select = screen.getByLabelText(/select quantity/i)
    expect(select).toHaveAttribute('aria-describedby', 'mobile-quantity-message')
    expect(screen.getByText('Only 3 left')).toBeInTheDocument()
  })
})
