import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import React from 'react'

const {
  mockDispatch,
  mockUnwrap,
  mockToastSuccess,
  mockToastError,
  mockToast,
  mockUseSession,
  mockAddPendingCartItem,
} = vi.hoisted(() => ({
  mockDispatch: vi.fn(),
  mockUnwrap: vi.fn(),
  mockToastSuccess: vi.fn(),
  mockToastError: vi.fn(),
  mockToast: vi.fn(),
  mockUseSession: vi.fn(() => ({ status: 'authenticated' })),
  mockAddPendingCartItem: vi.fn(),
}))

vi.mock('react-redux', () => ({
  useDispatch: () => mockDispatch,
}))

vi.mock('next-auth/react', () => ({
  useSession: mockUseSession,
}))

vi.mock('@/features/cart/store/cartSlice', () => ({
  addToCart: vi.fn((payload) => ({ type: 'cart/addToCart', payload })),
}))

vi.mock('react-hot-toast', () => ({
  default: Object.assign(mockToast, {
    success: mockToastSuccess,
    error: mockToastError,
  }),
}))

vi.mock('@/features/cart/services/pending-cart', () => ({
  addPendingCartItem: mockAddPendingCartItem,
}))

import { QuickAddButton } from '@/features/product/components/QuickAddButton'

describe('QuickAddButton', () => {
  const mockProduct = {
    id: 'prod123',
    name: 'Test Product',
    variants: [{ id: 'var-default', stock: 10 }],
  }

  beforeEach(() => {
    vi.clearAllMocks()
    mockDispatch.mockReturnValue({ unwrap: mockUnwrap })
    mockUnwrap.mockResolvedValue({})
  })

  it('does not render when product is out of stock', () => {
    const { container } = render(
      <QuickAddButton
        product={{
          ...mockProduct,
          variants: [{ id: 'var-default', stock: 0 }],
        }}
      />
    )
    expect(container.firstChild).toBeNull()
  })

  it('renders button when product is in stock', () => {
    render(<QuickAddButton product={mockProduct} />)
    expect(
      screen.getByLabelText('Add Test Product to cart')
    ).toBeInTheDocument()
  })

  it('adds to cart when authenticated', async () => {
    mockUnwrap.mockResolvedValueOnce({})
    render(<QuickAddButton product={mockProduct} />)

    const button = screen.getByLabelText('Add Test Product to cart')
    fireEvent.click(button)

    await waitFor(() => {
      expect(mockDispatch).toHaveBeenCalled()
      expect(mockToastSuccess).toHaveBeenCalledWith(
        'Test Product added to cart!'
      )
    })
  })

  it('shows warning toast when result has warning', async () => {
    mockUnwrap.mockResolvedValueOnce({ warning: 'Low stock warning' })
    render(<QuickAddButton product={mockProduct} />)

    const button = screen.getByLabelText('Add Test Product to cart')
    fireEvent.click(button)

    await waitFor(() => {
      expect(mockToast).toHaveBeenCalledWith('Low stock warning', {
        icon: '⚠️',
      })
    })
  })

  it('handles unauthenticated users by adding to pending cart', async () => {
    mockUseSession.mockReturnValueOnce({
      status: 'unauthenticated',
    } as never)

    render(<QuickAddButton product={mockProduct} />)

    const button = screen.getByLabelText('Add Test Product to cart')
    fireEvent.click(button)

    await waitFor(() => {
      expect(mockAddPendingCartItem).toHaveBeenCalledWith({
        productId: 'prod123',
        variantId: 'var-default',
        quantity: 1,
      })
      expect(mockToastSuccess).toHaveBeenCalledWith(
        'Test Product saved! Sign in to checkout.'
      )
    })
  })

  it('disables button while adding', async () => {
    mockUnwrap.mockImplementation(
      () => new Promise((resolve) => setTimeout(resolve, 100))
    )
    render(<QuickAddButton product={mockProduct} />)

    const button = screen.getByLabelText('Add Test Product to cart')
    fireEvent.click(button)

    expect(button).toBeDisabled()
  })

  it('shows loading spinner while adding', async () => {
    mockUnwrap.mockImplementation(
      () => new Promise((resolve) => setTimeout(resolve, 100))
    )
    render(<QuickAddButton product={mockProduct} />)

    const button = screen.getByLabelText('Add Test Product to cart')
    fireEvent.click(button)

    expect(button.querySelector('.animate-spin')).toBeInTheDocument()
  })

  it('shows error toast when add to cart fails', async () => {
    mockUnwrap.mockRejectedValueOnce('Product unavailable')
    render(<QuickAddButton product={mockProduct} />)

    const button = screen.getByLabelText('Add Test Product to cart')
    fireEvent.click(button)

    await waitFor(() => {
      expect(mockToastError).toHaveBeenCalledWith('Product unavailable')
    })
  })

  it('shows generic error message for unknown errors', async () => {
    mockUnwrap.mockRejectedValueOnce(new Error('Unknown error'))
    render(<QuickAddButton product={mockProduct} />)

    const button = screen.getByLabelText('Add Test Product to cart')
    fireEvent.click(button)

    await waitFor(() => {
      expect(mockToastError).toHaveBeenCalledWith(
        'Failed to add to cart. Please try again.'
      )
    })
  })

  it('re-enables button after successful add', async () => {
    mockUnwrap.mockResolvedValueOnce({})
    render(<QuickAddButton product={mockProduct} />)

    const button = screen.getByLabelText('Add Test Product to cart')
    fireEvent.click(button)

    await waitFor(() => {
      expect(button).not.toBeDisabled()
    })
  })

  it('prevents event propagation and default', () => {
    const preventDefaultSpy = vi.spyOn(Event.prototype, 'preventDefault')
    const stopPropagationSpy = vi.spyOn(Event.prototype, 'stopPropagation')

    render(<QuickAddButton product={mockProduct} />)
    const button = screen.getByLabelText('Add Test Product to cart')

    fireEvent.click(button)

    expect(preventDefaultSpy).toHaveBeenCalled()
    expect(stopPropagationSpy).toHaveBeenCalled()

    preventDefaultSpy.mockRestore()
    stopPropagationSpy.mockRestore()
  })
})
