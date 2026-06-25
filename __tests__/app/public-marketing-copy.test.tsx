// @vitest-environment jsdom
import { render, screen } from '@testing-library/react'
import React from 'react'
import { describe, expect, it, vi } from 'vitest'
import BlogPage, {
  metadata as blogMetadata,
} from '@/app/[locale]/(public)/blog/page'
import HelpPage, {
  metadata as helpMetadata,
} from '@/app/[locale]/(public)/help/page'
import PressPage, {
  metadata as pressMetadata,
} from '@/app/[locale]/(public)/press/page'
import ShippingPage, {
  metadata as shippingMetadata,
} from '@/app/[locale]/(public)/shipping/page'
import { STORE_NAME, withStoreName } from '@/lib/constants/store'

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

describe('public marketing copy', () => {
  it('uses the shared store name in affected page metadata', () => {
    expect(blogMetadata.title).toBe(withStoreName('Blog'))
    expect(helpMetadata.title).toBe(withStoreName('Help Center'))
    expect(pressMetadata.title).toBe(withStoreName('Press'))
    expect(shippingMetadata.title).toBe(withStoreName('Shipping Information'))
  })

  it('renders blog copy with the shared store name and without fake delivery claims', () => {
    render(<BlogPage />)

    expect(
      screen.getByText(`News, tips, and stories from the ${STORE_NAME} team.`)
    ).toBeInTheDocument()
    expect(
      screen.queryByText(/Craft\s*&\s*Cozy|Craft & Cozy/i)
    ).not.toBeInTheDocument()
    expect(screen.queryByText(/same-day delivery/i)).not.toBeInTheDocument()
  })

  it('renders help copy without unsupported payment or expedited shipping promises', () => {
    render(<HelpPage />)

    expect(
      screen.getByText(/supported payment steps inside the storefront/i)
    ).toBeInTheDocument()
    expect(screen.getByText(/standard shipping only/i)).toBeInTheDocument()
    expect(screen.getByText(new RegExp(STORE_NAME))).toBeInTheDocument()
    expect(
      screen.queryByText(/Visa|Mastercard|Amex|wallet/i)
    ).not.toBeInTheDocument()
    expect(screen.queryByText(/express delivery/i)).not.toBeInTheDocument()
  })

  it('removes placeholder brand and rollout claims from press and shipping pages', () => {
    const { rerender } = render(<PressPage />)

    expect(
      screen.queryByText(/Craft\s*&\s*Cozy|Craft & Cozy/i)
    ).not.toBeInTheDocument()
    expect(screen.queryByText(/same-day delivery/i)).not.toBeInTheDocument()
    expect(screen.queryByText(/Series A/i)).not.toBeInTheDocument()

    rerender(<ShippingPage />)

    expect(screen.getByText(/standard shipping/i)).toBeInTheDocument()
    expect(screen.queryByText(/express shipping/i)).not.toBeInTheDocument()
    expect(screen.queryByText(/same-day delivery/i)).not.toBeInTheDocument()
    expect(screen.queryByText(/international/i)).not.toBeInTheDocument()
  })
})
