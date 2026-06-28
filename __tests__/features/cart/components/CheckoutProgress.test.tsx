// @vitest-environment jsdom
import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { CheckoutProgress } from '@/features/cart/components/CheckoutProgress'

describe('CheckoutProgress', () => {
  it('renders all five steps as a navigation list', () => {
    render(<CheckoutProgress currentStep="cart" />)

    expect(
      screen.getByRole('navigation', { name: /checkout progress/i })
    ).toBeInTheDocument()
    expect(screen.getByText('Cart')).toBeInTheDocument()
    expect(screen.getByText('Shipping')).toBeInTheDocument()
    expect(screen.getByText('Payment')).toBeInTheDocument()
    expect(screen.getByText('Review')).toBeInTheDocument()
    expect(screen.getByText('Confirmation')).toBeInTheDocument()
  })

  it('marks the active step with aria-current="step"', () => {
    render(<CheckoutProgress currentStep="payment" />)

    const active = screen.getByText('Payment')
    expect(active).toHaveAttribute('aria-current', 'step')
    expect(screen.getByText('Review')).not.toHaveAttribute('aria-current')
  })

  it('renders completed steps as locale-prefixed links', () => {
    render(<CheckoutProgress currentStep="review" />)

    const cartLink = screen.getByRole('link', { name: 'Cart' })
    const shippingLink = screen.getByRole('link', { name: 'Shipping' })
    const paymentLink = screen.getByRole('link', { name: 'Payment' })
    expect(cartLink).toHaveAttribute('href', expect.stringContaining('/cart'))
    expect(shippingLink).toHaveAttribute(
      'href',
      expect.stringContaining('/checkout/shipping')
    )
    expect(paymentLink).toHaveAttribute(
      'href',
      expect.stringContaining('/checkout/payment')
    )
    // Review is the current step — rendered as a span, not a link
    expect(screen.queryByRole('link', { name: 'Review' })).toBeNull()
  })

  it('renders no links when the first step is current', () => {
    render(<CheckoutProgress currentStep="cart" />)

    expect(screen.queryAllByRole('link')).toHaveLength(0)
  })

  it('renders four links when the final step is current', () => {
    render(<CheckoutProgress currentStep="confirmation" />)

    expect(screen.getAllByRole('link')).toHaveLength(4)
    expect(screen.getByText('Confirmation')).toHaveAttribute(
      'aria-current',
      'step'
    )
  })
})
