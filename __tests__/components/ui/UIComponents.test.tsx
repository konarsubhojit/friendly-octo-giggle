// @vitest-environment jsdom
import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import React from 'react'
import { Badge, orderStatusVariant, roleVariant } from '@/components/ui/Badge'
import { Card } from '@/components/ui/Card'
import { LoadingSpinner } from '@/components/ui/LoadingSpinner'
import { AuthRequiredState } from '@/components/ui/AuthRequiredState'
import { AlertBanner } from '@/components/ui/AlertBanner'
import { EmptyState } from '@/components/ui/EmptyState'

vi.mock('next/link', () => ({
  default: ({
    children,
    href,
  }: {
    children: React.ReactNode
    href: string
  }) => <a href={href}>{children}</a>,
}))
describe('Badge', () => {
  it('renders children', () => {
    render(<Badge>In Stock</Badge>)
    expect(screen.getByText('In Stock')).toBeTruthy()
  })

  it('applies success variant classes', () => {
    const { container } = render(<Badge variant="success">OK</Badge>)
    expect(container.firstChild).toHaveClass('text-[var(--accent-sage)]')
  })

  it('applies error variant classes', () => {
    const { container } = render(<Badge variant="error">Error</Badge>)
    expect(container.firstChild).toHaveClass('text-[var(--accent-rose)]')
  })

  it('applies primary variant classes', () => {
    const { container } = render(<Badge variant="primary">ADMIN</Badge>)
    expect(container.firstChild).toHaveClass('bg-[var(--accent-blush)]')
  })

  it('applies sm size classes', () => {
    const { container } = render(<Badge size="sm">Tiny</Badge>)
    expect(container.firstChild).toHaveClass('text-xs')
  })

  it('applies extra className', () => {
    const { container } = render(<Badge className="my-class">X</Badge>)
    expect(container.firstChild).toHaveClass('my-class')
  })

  it('defaults to neutral variant', () => {
    const { container } = render(<Badge>Default</Badge>)
    expect(container.firstChild).toHaveClass('rounded-full')
    expect(container.firstChild).toHaveClass('font-semibold')
  })
})

describe('orderStatusVariant', () => {
  it('maps PENDING to warning', () =>
    expect(orderStatusVariant('PENDING')).toBe('warning'))
  it('maps PROCESSING to info', () =>
    expect(orderStatusVariant('PROCESSING')).toBe('info'))
  it('maps SHIPPED to primary', () =>
    expect(orderStatusVariant('SHIPPED')).toBe('primary'))
  it('maps DELIVERED to success', () =>
    expect(orderStatusVariant('DELIVERED')).toBe('success'))
  it('maps CANCELLED to error', () =>
    expect(orderStatusVariant('CANCELLED')).toBe('error'))
  it('maps unknown status to neutral', () =>
    expect(orderStatusVariant('UNKNOWN')).toBe('neutral'))
  it('is case-insensitive', () =>
    expect(orderStatusVariant('delivered')).toBe('success'))
})

describe('roleVariant', () => {
  it('maps ADMIN to primary', () =>
    expect(roleVariant('ADMIN')).toBe('primary'))
  it('maps CUSTOMER to success', () =>
    expect(roleVariant('CUSTOMER')).toBe('success'))
  it('is case-insensitive for admin', () =>
    expect(roleVariant('admin')).toBe('primary'))
})
describe('Card', () => {
  it('renders children', () => {
    render(
      <Card>
        <p>Content</p>
      </Card>
    )
    expect(screen.getByText('Content')).toBeTruthy()
  })

  it('applies base glass-morphism classes', () => {
    const { container } = render(<Card>X</Card>)
    expect(container.firstChild).toHaveClass('backdrop-blur-lg')
    expect(container.firstChild).toHaveClass('rounded-2xl')
  })

  it('merges extra className', () => {
    const { container } = render(<Card className="p-8">X</Card>)
    expect(container.firstChild).toHaveClass('p-8')
  })
})
describe('LoadingSpinner', () => {
  it('renders with default aria label', () => {
    render(<LoadingSpinner />)
    expect(screen.getByText('Loading')).toBeTruthy()
  })

  it('renders with custom label', () => {
    render(<LoadingSpinner label="Saving…" />)
    expect(screen.getByText('Saving…')).toBeTruthy()
  })

  it('has role=status on wrapper', () => {
    render(<LoadingSpinner />)
    expect(screen.getByRole('status')).toBeTruthy()
  })

  it('applies custom size class', () => {
    const { container } = render(<LoadingSpinner size="h-5 w-5" />)
    const svg = container.querySelector('svg')
    expect(svg?.getAttribute('class')).toContain('h-5 w-5')
  })

  it('applies custom color class', () => {
    const { container } = render(<LoadingSpinner color="text-white" />)
    const svg = container.querySelector('svg')
    expect(svg?.getAttribute('class')).toContain('text-white')
  })

  it('label is visually hidden via sr-only', () => {
    const { container } = render(<LoadingSpinner label="Loading" />)
    const srSpan = container.querySelector('.sr-only')
    expect(srSpan?.textContent).toBe('Loading')
  })
})
describe('AuthRequiredState', () => {
  it('renders default title and message', () => {
    render(<AuthRequiredState callbackUrl="/cart" />)
    expect(screen.getByText('Sign In Required')).toBeTruthy()
    expect(screen.getByText('Please sign in to continue.')).toBeTruthy()
  })

  it('renders custom title', () => {
    render(<AuthRequiredState callbackUrl="/orders" title="Login Needed" />)
    expect(screen.getByText('Login Needed')).toBeTruthy()
  })

  it('renders custom message', () => {
    render(
      <AuthRequiredState
        callbackUrl="/orders"
        message="Sign in to view your orders."
      />
    )
    expect(screen.getByText('Sign in to view your orders.')).toBeTruthy()
  })

  it('renders a Sign In link with callback URL encoded', () => {
    render(<AuthRequiredState callbackUrl="/cart" />)
    const link = screen.getByRole('link', { name: 'Sign In' })
    expect(link.getAttribute('href')).toContain('/auth/signin')
    expect(link.getAttribute('href')).toContain(encodeURIComponent('/cart'))
  })

  it('renders custom CTA text', () => {
    render(<AuthRequiredState callbackUrl="/account" ctaText="Log In Now" />)
    expect(screen.getByRole('link', { name: 'Log In Now' })).toBeTruthy()
  })
})
describe('AlertBanner', () => {
  it('renders message', () => {
    render(<AlertBanner message="Something went wrong" />)
    expect(screen.getByText('Something went wrong')).toBeTruthy()
  })

  it('has role=alert', () => {
    render(<AlertBanner message="Error" />)
    expect(screen.getByRole('alert')).toBeTruthy()
  })

  it('applies error variant styles by default', () => {
    const { container } = render(<AlertBanner message="Error" />)
    expect(container.firstChild).toHaveClass('bg-red-50')
  })

  it('applies success variant styles', () => {
    const { container } = render(
      <AlertBanner message="Saved!" variant="success" />
    )
    expect(container.firstChild).toHaveClass('bg-green-50')
  })

  it('applies info variant styles', () => {
    const { container } = render(<AlertBanner message="FYI" variant="info" />)
    expect(container.firstChild).toHaveClass('bg-blue-50')
  })

  it('renders dismiss button when onDismiss is provided', () => {
    const onDismiss = vi.fn()
    render(<AlertBanner message="Error" onDismiss={onDismiss} />)
    const btn = screen.getByRole('button', { name: /dismiss/i })
    expect(btn).toBeTruthy()
    fireEvent.click(btn)
    expect(onDismiss).toHaveBeenCalledOnce()
  })

  it('does not render dismiss button when onDismiss is absent', () => {
    render(<AlertBanner message="Error" />)
    expect(screen.queryByRole('button', { name: /dismiss/i })).toBeNull()
  })

  it('applies extra className', () => {
    const { container } = render(<AlertBanner message="X" className="mt-4" />)
    expect(container.firstChild).toHaveClass('mt-4')
  })
})
describe('EmptyState', () => {
  it('renders title', () => {
    render(<EmptyState title="No items found" />)
    expect(screen.getByText('No items found')).toBeTruthy()
  })

  it('renders message when provided', () => {
    render(<EmptyState title="Empty" message="Add some items" />)
    expect(screen.getByText('Add some items')).toBeTruthy()
  })

  it('does not render message when absent', () => {
    render(<EmptyState title="Empty" />)
    expect(screen.queryByText('Add some items')).toBeNull()
  })

  it('renders CTA as a link when ctaHref is provided', () => {
    render(<EmptyState title="Empty" ctaText="Browse" ctaHref="/" />)
    const link = screen.getByRole('link', { name: 'Browse' })
    expect(link.getAttribute('href')).toBe('/')
  })

  it('renders CTA as a button when onCtaClick is provided', () => {
    const onClick = vi.fn()
    render(<EmptyState title="Empty" ctaText="Click me" onCtaClick={onClick} />)
    const btn = screen.getByRole('button', { name: 'Click me' })
    fireEvent.click(btn)
    expect(onClick).toHaveBeenCalledOnce()
  })

  it('renders nothing for CTA when neither ctaHref nor onCtaClick provided', () => {
    render(<EmptyState title="Empty" ctaText="Orphan" />)
    expect(screen.queryByRole('link')).toBeNull()
    expect(screen.queryByRole('button')).toBeNull()
  })

  it('renders default icon when no icon prop given', () => {
    const { container } = render(<EmptyState title="Empty" />)
    expect(container.querySelector('svg')).toBeTruthy()
  })

  it('renders custom icon', () => {
    render(
      <EmptyState title="Empty" icon={<span data-testid="custom-icon" />} />
    )
    expect(screen.getByTestId('custom-icon')).toBeTruthy()
  })

  it('applies extra className', () => {
    const { container } = render(<EmptyState title="Empty" className="mt-8" />)
    expect(container.firstChild).toHaveClass('mt-8')
  })
})
