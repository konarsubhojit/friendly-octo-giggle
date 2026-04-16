// @vitest-environment jsdom
import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'

vi.mock('@sentry/nextjs', () => ({
  captureException: vi.fn(),
}))

vi.mock('next/link', () => ({
  default: ({
    children,
    href,
  }: {
    children: React.ReactNode
    href: string
  }) => <a href={href}>{children}</a>,
}))

import GlobalError from '@/app/error'
import OrdersError from '@/app/orders/error'
import AdminError from '@/app/admin/error'
import CartError from '@/app/cart/error'
import ProductsError from '@/app/products/error'

function createError(
  message: string,
  digest?: string
): Error & { digest?: string } {
  const error = new Error(message) as Error & { digest?: string }
  if (digest) error.digest = digest
  return error
}

describe('GlobalError (app/error.tsx)', () => {
  it('renders the heading', () => {
    render(<GlobalError error={createError('boom')} reset={vi.fn()} />)
    expect(screen.getByText('Something went wrong!')).toBeInTheDocument()
  })

  it('displays the error message', () => {
    render(
      <GlobalError error={createError('Network failure')} reset={vi.fn()} />
    )
    expect(screen.getByText('Network failure')).toBeInTheDocument()
  })

  it('displays error digest when present', () => {
    render(
      <GlobalError error={createError('fail', 'abc123')} reset={vi.fn()} />
    )
    expect(screen.getByText('Error ID: abc123')).toBeInTheDocument()
  })

  it('does not display digest when absent', () => {
    render(<GlobalError error={createError('fail')} reset={vi.fn()} />)
    expect(screen.queryByText(/Error ID:/)).not.toBeInTheDocument()
  })

  it('calls reset when "Try again" is clicked', () => {
    const reset = vi.fn()
    render(<GlobalError error={createError('fail')} reset={reset} />)
    fireEvent.click(screen.getByText('Try again'))
    expect(reset).toHaveBeenCalledOnce()
  })

  it('displays fallback message when error.message is empty', () => {
    render(<GlobalError error={createError('')} reset={vi.fn()} />)
    expect(screen.getByText('An unexpected error occurred')).toBeInTheDocument()
  })
})

describe('OrdersError (app/orders/error.tsx)', () => {
  it('renders the heading', () => {
    render(<OrdersError error={createError('boom')} reset={vi.fn()} />)
    expect(screen.getByText('Error Loading Orders')).toBeInTheDocument()
  })

  it('displays the error message', () => {
    render(<OrdersError error={createError('DB timeout')} reset={vi.fn()} />)
    expect(screen.getByText('DB timeout')).toBeInTheDocument()
  })

  it('displays error digest when present', () => {
    render(
      <OrdersError error={createError('fail', 'ord-456')} reset={vi.fn()} />
    )
    expect(screen.getByText('Error ID: ord-456')).toBeInTheDocument()
  })

  it('calls reset when "Try again" is clicked', () => {
    const reset = vi.fn()
    render(<OrdersError error={createError('fail')} reset={reset} />)
    fireEvent.click(screen.getByText('Try again'))
    expect(reset).toHaveBeenCalledOnce()
  })

  it('"Go home" link points to "/"', () => {
    render(<OrdersError error={createError('fail')} reset={vi.fn()} />)
    expect(screen.getByText('Go home')).toHaveAttribute('href', '/')
  })

  it('displays fallback message when error.message is empty', () => {
    render(<OrdersError error={createError('')} reset={vi.fn()} />)
    expect(
      screen.getByText('Failed to load your order information')
    ).toBeInTheDocument()
  })

  it('does not display digest when absent', () => {
    render(<OrdersError error={createError('fail')} reset={vi.fn()} />)
    expect(screen.queryByText(/Error ID:/)).not.toBeInTheDocument()
  })
})

describe('AdminError (app/admin/error.tsx)', () => {
  it('renders the heading', () => {
    render(<AdminError error={createError('boom')} reset={vi.fn()} />)
    expect(screen.getByText('Admin Panel Error')).toBeInTheDocument()
  })

  it('displays the error message', () => {
    render(
      <AdminError error={createError('Permission denied')} reset={vi.fn()} />
    )
    expect(screen.getByText('Permission denied')).toBeInTheDocument()
  })

  it('displays error digest when present', () => {
    render(
      <AdminError error={createError('fail', 'adm-789')} reset={vi.fn()} />
    )
    expect(screen.getByText('Error ID: adm-789')).toBeInTheDocument()
  })

  it('calls reset when "Try again" is clicked', () => {
    const reset = vi.fn()
    render(<AdminError error={createError('fail')} reset={reset} />)
    fireEvent.click(screen.getByText('Try again'))
    expect(reset).toHaveBeenCalledOnce()
  })

  it('"Admin home" link points to "/admin"', () => {
    render(<AdminError error={createError('fail')} reset={vi.fn()} />)
    expect(screen.getByText('Admin home')).toHaveAttribute('href', '/admin')
  })

  it('displays fallback message when error.message is empty', () => {
    render(<AdminError error={createError('')} reset={vi.fn()} />)
    expect(
      screen.getByText('An error occurred in the admin panel')
    ).toBeInTheDocument()
  })

  it('does not display digest when absent', () => {
    render(<AdminError error={createError('fail')} reset={vi.fn()} />)
    expect(screen.queryByText(/Error ID:/)).not.toBeInTheDocument()
  })
})

describe('CartError (app/cart/error.tsx)', () => {
  it('renders the heading', () => {
    render(<CartError error={createError('boom')} reset={vi.fn()} />)
    expect(screen.getByText('Error Loading Cart')).toBeInTheDocument()
  })

  it('displays the error message', () => {
    render(
      <CartError error={createError('Cart service down')} reset={vi.fn()} />
    )
    expect(screen.getByText('Cart service down')).toBeInTheDocument()
  })

  it('displays error digest when present', () => {
    render(
      <CartError error={createError('fail', 'cart-012')} reset={vi.fn()} />
    )
    expect(screen.getByText('Error ID: cart-012')).toBeInTheDocument()
  })

  it('calls reset when "Try again" is clicked', () => {
    const reset = vi.fn()
    render(<CartError error={createError('fail')} reset={reset} />)
    fireEvent.click(screen.getByText('Try again'))
    expect(reset).toHaveBeenCalledOnce()
  })

  it('"Continue shopping" link points to "/products"', () => {
    render(<CartError error={createError('fail')} reset={vi.fn()} />)
    expect(screen.getByText('Continue shopping')).toHaveAttribute(
      'href',
      '/products'
    )
  })

  it('displays fallback message when error.message is empty', () => {
    render(<CartError error={createError('')} reset={vi.fn()} />)
    expect(
      screen.getByText('Failed to load your shopping cart')
    ).toBeInTheDocument()
  })

  it('does not display digest when absent', () => {
    render(<CartError error={createError('fail')} reset={vi.fn()} />)
    expect(screen.queryByText(/Error ID:/)).not.toBeInTheDocument()
  })
})

describe('ProductsError (app/products/error.tsx)', () => {
  it('renders the heading', () => {
    render(<ProductsError error={createError('boom')} reset={vi.fn()} />)
    expect(screen.getByText('Error Loading Products')).toBeInTheDocument()
  })

  it('displays the error message', () => {
    render(
      <ProductsError error={createError('Fetch failed')} reset={vi.fn()} />
    )
    expect(screen.getByText('Fetch failed')).toBeInTheDocument()
  })

  it('displays error digest when present', () => {
    render(
      <ProductsError error={createError('fail', 'prod-345')} reset={vi.fn()} />
    )
    expect(screen.getByText('Error ID: prod-345')).toBeInTheDocument()
  })

  it('calls reset when "Try again" is clicked', () => {
    const reset = vi.fn()
    render(<ProductsError error={createError('fail')} reset={reset} />)
    fireEvent.click(screen.getByText('Try again'))
    expect(reset).toHaveBeenCalledOnce()
  })

  it('"Go home" link points to "/"', () => {
    render(<ProductsError error={createError('fail')} reset={vi.fn()} />)
    expect(screen.getByText('Go home')).toHaveAttribute('href', '/')
  })
})
