// @vitest-environment jsdom
import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import type { ReactNode } from 'react'

vi.mock('next/link', () => ({
  default: ({ children, href }: { children: ReactNode; href: string }) => (
    <a href={href}>{children}</a>
  ),
}))

import { RouteErrorCard } from '@/components/ui/RouteErrorCard'

function makeError(
  message: string,
  digest?: string
): Error & { digest?: string } {
  const err = new Error(message) as Error & { digest?: string }
  if (digest) err.digest = digest
  return err
}

describe('RouteErrorCard (public variant)', () => {
  it('renders the title', () => {
    render(
      <RouteErrorCard
        error={makeError('boom')}
        reset={vi.fn()}
        title="Error Loading Cart"
        fallbackMessage="Failed to load your shopping cart"
      />
    )
    expect(screen.getByText('Error Loading Cart')).toBeInTheDocument()
  })

  it('displays the error message when present', () => {
    render(
      <RouteErrorCard
        error={makeError('Network timeout')}
        reset={vi.fn()}
        title="Error"
        fallbackMessage="Fallback text"
      />
    )
    expect(screen.getByText('Network timeout')).toBeInTheDocument()
  })

  it('shows fallback message when error.message is empty', () => {
    render(
      <RouteErrorCard
        error={makeError('')}
        reset={vi.fn()}
        title="Error"
        fallbackMessage="Fallback text"
      />
    )
    expect(screen.getByText('Fallback text')).toBeInTheDocument()
  })

  it('renders error digest when present', () => {
    render(
      <RouteErrorCard
        error={makeError('fail', 'abc-123')}
        reset={vi.fn()}
        title="Error"
        fallbackMessage="Fallback"
      />
    )
    expect(screen.getByText('Error ID: abc-123')).toBeInTheDocument()
  })

  it('does not render error digest when absent', () => {
    render(
      <RouteErrorCard
        error={makeError('fail')}
        reset={vi.fn()}
        title="Error"
        fallbackMessage="Fallback"
      />
    )
    expect(screen.queryByText(/Error ID:/)).not.toBeInTheDocument()
  })

  it('calls reset when "Try again" is clicked', () => {
    const reset = vi.fn()
    render(
      <RouteErrorCard
        error={makeError('fail')}
        reset={reset}
        title="Error"
        fallbackMessage="Fallback"
      />
    )
    fireEvent.click(screen.getByText('Try again'))
    expect(reset).toHaveBeenCalledOnce()
  })

  it('renders secondary link when secondaryHref and secondaryLabel are provided', () => {
    render(
      <RouteErrorCard
        error={makeError('fail')}
        reset={vi.fn()}
        title="Error"
        fallbackMessage="Fallback"
        secondaryHref="/shop"
        secondaryLabel="Continue shopping"
      />
    )
    const link = screen.getByText('Continue shopping')
    expect(link).toBeInTheDocument()
    expect(link).toHaveAttribute('href', '/en/shop')
  })

  it('does not render secondary link when props are absent', () => {
    render(
      <RouteErrorCard
        error={makeError('fail')}
        reset={vi.fn()}
        title="Error"
        fallbackMessage="Fallback"
      />
    )
    expect(screen.queryByRole('link')).not.toBeInTheDocument()
  })

  it('renders the icon when provided', () => {
    render(
      <RouteErrorCard
        error={makeError('fail')}
        reset={vi.fn()}
        title="Error"
        fallbackMessage="Fallback"
        icon={<span data-testid="test-icon">icon</span>}
      />
    )
    expect(screen.getByTestId('test-icon')).toBeInTheDocument()
  })

  it('omits the icon wrapper when no icon is provided', () => {
    const { container } = render(
      <RouteErrorCard
        error={makeError('fail')}
        reset={vi.fn()}
        title="Error"
        fallbackMessage="Fallback"
      />
    )
    // The icon circle wrapper has both w-16 and h-16; without an icon it should not be rendered
    expect(container.querySelector('.w-16.h-16')).not.toBeInTheDocument()
  })
})

describe('RouteErrorCard (admin variant)', () => {
  it('renders the title', () => {
    render(
      <RouteErrorCard
        error={makeError('boom')}
        reset={vi.fn()}
        title="Admin Panel Error"
        fallbackMessage="An error occurred in the admin panel"
        variant="admin"
      />
    )
    expect(screen.getByText('Admin Panel Error')).toBeInTheDocument()
  })

  it('shows fallback message when error.message is empty', () => {
    render(
      <RouteErrorCard
        error={makeError('')}
        reset={vi.fn()}
        title="Admin Panel Error"
        fallbackMessage="An error occurred in the admin panel"
        variant="admin"
      />
    )
    expect(
      screen.getByText('An error occurred in the admin panel')
    ).toBeInTheDocument()
  })

  it('renders the eyebrow label when provided', () => {
    render(
      <RouteErrorCard
        error={makeError('fail')}
        reset={vi.fn()}
        title="Admin Panel Error"
        fallbackMessage="Fallback"
        variant="admin"
        label="Admin route failure"
      />
    )
    expect(screen.getByText('Admin route failure')).toBeInTheDocument()
  })

  it('renders error digest when present', () => {
    render(
      <RouteErrorCard
        error={makeError('fail', 'adm-456')}
        reset={vi.fn()}
        title="Admin Panel Error"
        fallbackMessage="Fallback"
        variant="admin"
      />
    )
    expect(screen.getByText('Error ID: adm-456')).toBeInTheDocument()
  })

  it('calls reset when "Try again" is clicked', () => {
    const reset = vi.fn()
    render(
      <RouteErrorCard
        error={makeError('fail')}
        reset={reset}
        title="Admin Panel Error"
        fallbackMessage="Fallback"
        variant="admin"
      />
    )
    fireEvent.click(screen.getByText('Try again'))
    expect(reset).toHaveBeenCalledOnce()
  })

  it('renders secondary link with correct href', () => {
    render(
      <RouteErrorCard
        error={makeError('fail')}
        reset={vi.fn()}
        title="Admin Panel Error"
        fallbackMessage="Fallback"
        variant="admin"
        secondaryHref="/admin"
        secondaryLabel="Admin home"
      />
    )
    expect(screen.getByText('Admin home')).toHaveAttribute('href', '/en/admin')
  })
})
