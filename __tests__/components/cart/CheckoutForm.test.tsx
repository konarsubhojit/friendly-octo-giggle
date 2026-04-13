import { describe, expect, it, vi, beforeEach } from 'vitest'
import { fireEvent, render, screen } from '@testing-library/react'
import React from 'react'
import { Provider } from 'react-redux'
import { configureStore } from '@reduxjs/toolkit'
import { CheckoutForm } from '@/features/cart/components/CheckoutForm'
import cartReducer from '@/features/cart/store/cartSlice'

const mockPush = vi.fn()
const mockToastError = vi.fn()
const mockUseSession = vi.fn()

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: mockPush }),
}))

vi.mock('next-auth/react', () => ({
  useSession: () => mockUseSession(),
}))

vi.mock('react-hot-toast', () => ({
  default: {
    success: vi.fn(),
    error: (message: string) => mockToastError(message),
  },
}))

vi.mock('@/contexts/CurrencyContext', () => ({
  useCurrency: () => ({ formatPrice: (amount: number) => `₹${amount}` }),
}))

const mockCart = {
  id: 'cart0001',
  userId: 'user-1',
  sessionId: null,
  createdAt: '2026-03-01T00:00:00.000Z',
  updatedAt: '2026-03-01T00:00:00.000Z',
  items: [
    {
      id: 'citem0001',
      cartId: 'cart0001',
      productId: 'prd0001',
      variationId: 'var0001',
      quantity: 2,
      createdAt: '2026-03-01T00:00:00.000Z',
      updatedAt: '2026-03-01T00:00:00.000Z',
      customizationNote: null,
      product: {
        id: 'prd0001',
        name: 'Hand-knitted Flower Bouquet',
        description: 'Bouquet',
        price: 1499,
        image: '/flower.jpg',
        images: [],
        stock: 10,
        category: 'Flowers',
        deletedAt: null,
        createdAt: '2026-03-01T00:00:00.000Z',
        updatedAt: '2026-03-01T00:00:00.000Z',
      },
      variation: {
        id: 'var0001',
        productId: 'prd0001',
        styleId: null,
        name: 'Small (15 cm)',
        designName: 'Rose Red',
        variationType: 'styling' as const,
        image: null,
        images: [],
        price: 100,
        stock: 10,
        deletedAt: null,
        createdAt: '2026-03-01T00:00:00.000Z',
        updatedAt: '2026-03-01T00:00:00.000Z',
      },
    },
  ],
}

const renderCheckoutForm = () => {
  const store = configureStore({
    reducer: {
      cart: cartReducer,
    },
    preloadedState: {
      cart: {
        cart: mockCart,
        loading: false,
        lastFetchedAt: Date.now(),
        error: null,
        stockWarning: null,
        adjustedQuantity: null,
      },
    },
  })

  return render(
    <Provider store={store}>
      <CheckoutForm customizationNotes={{ citem0001: 'Use a satin ribbon' }} />
    </Provider>
  )
}

const fillStructuredAddress = () => {
  fireEvent.change(screen.getByLabelText(/address line 1/i), {
    target: { value: '42 MG Road' },
  })
  fireEvent.change(screen.getByLabelText(/pin code/i), {
    target: { value: '560001' },
  })
  fireEvent.change(screen.getByLabelText(/city/i), {
    target: { value: 'Bengaluru' },
  })
  fireEvent.change(screen.getByLabelText(/state/i), {
    target: { value: 'Karnataka' },
  })
}

describe('CheckoutForm', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockUseSession.mockReturnValue({
      data: {
        user: {
          id: 'user-1',
          name: 'Alice',
          email: 'alice@example.com',
        },
        expires: '',
      },
      status: 'authenticated',
      update: vi.fn(),
    })
    vi.stubGlobal('sessionStorage', {
      setItem: vi.fn(),
      getItem: vi.fn(),
      removeItem: vi.fn(),
    })
  })

  it('renders all structured address fields', () => {
    renderCheckoutForm()

    expect(screen.getByLabelText(/address line 1/i)).toBeInTheDocument()
    expect(screen.getByLabelText(/address line 2/i)).toBeInTheDocument()
    expect(screen.getByLabelText(/address line 3/i)).toBeInTheDocument()
    expect(screen.getByLabelText(/pin code/i)).toBeInTheDocument()
    expect(screen.getByLabelText(/city/i)).toBeInTheDocument()
    expect(screen.getByLabelText(/state/i)).toBeInTheDocument()
  })

  it('navigates to review page with valid structured address', () => {
    renderCheckoutForm()
    fillStructuredAddress()

    fireEvent.click(
      screen.getByRole('button', { name: /review.*place order/i })
    )

    expect(sessionStorage.setItem).toHaveBeenCalledWith(
      'pending_checkout',
      expect.stringContaining('42 MG Road')
    )
    expect(mockPush).toHaveBeenCalledWith('/checkout/review')
  })

  it('shows error when address line 1 is empty', () => {
    renderCheckoutForm()

    fireEvent.change(screen.getByLabelText(/pin code/i), {
      target: { value: '560001' },
    })
    fireEvent.change(screen.getByLabelText(/city/i), {
      target: { value: 'Bengaluru' },
    })
    fireEvent.change(screen.getByLabelText(/state/i), {
      target: { value: 'Karnataka' },
    })

    fireEvent.click(
      screen.getByRole('button', { name: /review.*place order/i })
    )

    expect(screen.getByText(/address line 1 is required/i)).toBeInTheDocument()
    expect(mockPush).not.toHaveBeenCalledWith('/checkout/review')
  })

  it('shows error when pin code is invalid', () => {
    renderCheckoutForm()

    fireEvent.change(screen.getByLabelText(/address line 1/i), {
      target: { value: '42 MG Road' },
    })
    fireEvent.change(screen.getByLabelText(/pin code/i), {
      target: { value: '12345' },
    })
    fireEvent.change(screen.getByLabelText(/city/i), {
      target: { value: 'Bengaluru' },
    })
    fireEvent.change(screen.getByLabelText(/state/i), {
      target: { value: 'Karnataka' },
    })

    fireEvent.click(
      screen.getByRole('button', { name: /review.*place order/i })
    )

    expect(
      screen.getByText(/pin code must be exactly 6 digits/i)
    ).toBeInTheDocument()
    expect(mockPush).not.toHaveBeenCalledWith('/checkout/review')
  })

  it('redirects unauthenticated users to sign in', () => {
    mockUseSession.mockReturnValue({
      data: null,
      status: 'unauthenticated',
      update: vi.fn(),
    })

    renderCheckoutForm()
    fillStructuredAddress()

    fireEvent.click(
      screen.getByRole('button', { name: /review.*place order/i })
    )

    expect(mockPush).toHaveBeenCalledWith('/auth/signin?callbackUrl=/cart')
  })
})
