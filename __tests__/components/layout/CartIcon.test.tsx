import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import React from 'react'
import type { Session } from 'next-auth'
import { Provider } from 'react-redux'
import { makeStore } from '@/lib/store'
import CartIcon from '@/components/layout/CartIcon'

const mockUseSession = vi.fn<
  () => { data: Session | null; status: 'authenticated' | 'unauthenticated' }
>(() => ({ data: null, status: 'unauthenticated' }))

vi.mock('next/link', () => ({
  default: ({
    children,
    href,
    'aria-label': ariaLabel,
    ...props
  }: {
    children: React.ReactNode
    href: string
    'aria-label'?: string
  }) => (
    <a href={href} aria-label={ariaLabel} {...props}>
      {children}
    </a>
  ),
}))

vi.mock('next-auth/react', () => ({
  useSession: () => mockUseSession(),
}))

function renderCartIcon(_preloadedState?: object) {
  const store = makeStore()
  return render(
    <Provider store={store}>
      <CartIcon />
    </Provider>
  )
}

describe('CartIcon', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockUseSession.mockReturnValue({ data: null, status: 'unauthenticated' })
  })

  it('renders a link to /cart', () => {
    renderCartIcon()
    const link = screen.getByRole('link', { name: /shopping cart/i })
    expect(link.getAttribute('href')).toBe('/cart')
  })

  it('does not show badge when cart is empty', () => {
    renderCartIcon()
    expect(screen.queryByText(/^\d+$/)).toBeNull()
  })

  it('renders the cart SVG icon', () => {
    const { container } = renderCartIcon()
    expect(container.querySelector('svg')).toBeTruthy()
  })

  it('shows badge when cart has items', () => {
    const store = makeStore()
    store.dispatch({
      type: 'cart/fetchCart/fulfilled',
      payload: {
        id: 'cart-1',
        items: [
          {
            id: 'item-1',
            cartId: 'cart-1',
            productId: 'p1',
            quantity: 3,
            createdAt: '',
            updatedAt: '',
            product: {
              id: 'p1',
              name: 'P',
              description: '',
              price: 10,
              image: '',
              stock: 5,
              category: 'C',
              deletedAt: null,
              createdAt: '',
              updatedAt: '',
            },
          },
        ],
        createdAt: '',
        updatedAt: '',
      },
    })
    render(
      <Provider store={store}>
        <CartIcon />
      </Provider>
    )
    expect(screen.getByText('3')).toBeTruthy()
  })

  it('does not fetch cart for unauthenticated users', () => {
    const store = makeStore()
    const dispatchSpy = vi.spyOn(store, 'dispatch')

    render(
      <Provider store={store}>
        <CartIcon />
      </Provider>
    )

    expect(dispatchSpy).not.toHaveBeenCalled()
  })

  it('fetches cart after authentication', async () => {
    mockUseSession.mockReturnValue({
      data: {
        user: { id: 'user-1', role: 'CUSTOMER' },
        expires: '2099-01-01T00:00:00.000Z',
      },
      status: 'authenticated',
    })
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ cart: null }),
      })
    )

    const store = makeStore()
    render(
      <Provider store={store}>
        <CartIcon />
      </Provider>
    )

    await waitFor(() => {
      expect(fetch).toHaveBeenCalledWith('/api/cart', undefined)
    })
  })
})
