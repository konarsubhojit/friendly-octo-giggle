// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { Provider } from 'react-redux'
import { configureStore } from '@reduxjs/toolkit'
import { WishlistButton } from '@/features/wishlist/components/WishlistButton'

const mockDispatch = vi.fn()
const mockFetchWishlist = vi.fn()
const mockAddToWishlist = vi.fn()
const mockRemoveFromWishlist = vi.fn()
const mockOptimisticToggle = vi.fn()

vi.mock('next-auth/react', () => ({
  useSession: vi.fn(),
}))

vi.mock('react-redux', async () => {
  const actual = await vi.importActual('react-redux')
  return {
    ...actual,
    useDispatch: () => mockDispatch,
  }
})

vi.mock('@/features/wishlist/store/wishlistSlice', () => ({
  fetchWishlist: (...args: unknown[]) => mockFetchWishlist(...args),
  addToWishlist: (...args: unknown[]) => mockAddToWishlist(...args),
  removeFromWishlist: (...args: unknown[]) => mockRemoveFromWishlist(...args),
  optimisticToggle: (...args: unknown[]) => mockOptimisticToggle(...args),
}))

import { useSession } from 'next-auth/react'
const mockUseSession = vi.mocked(useSession)

const makeTestStore = (productIds: string[] = [], loading = false) =>
  configureStore({
    reducer: {
      wishlist: () => ({ productIds, loading }),
    },
    preloadedState: {
      wishlist: { productIds, loading },
    },
  })

const renderButton = (
  productIds: string[] = [],
  loading = false,
  session: ReturnType<typeof useSession> = {
    data: null,
    status: 'unauthenticated',
    update: vi.fn(),
  }
) => {
  mockUseSession.mockReturnValue(session)
  const store = makeTestStore(productIds, loading)
  return render(
    <Provider store={store}>
      <WishlistButton productId="p1" productName="Test Product" />
    </Provider>
  )
}

describe('WishlistButton', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockUseSession.mockReturnValue({
      data: null,
      status: 'unauthenticated',
      update: vi.fn(),
    })
    mockDispatch.mockReturnValue(Promise.resolve())
  })

  it('renders with Add to wishlist aria-label when not wishlisted', () => {
    renderButton([])
    const button = screen.getByRole('button', {
      name: 'Add Test Product to wishlist',
    })
    expect(button).toBeInTheDocument()
    expect(button).toHaveAttribute('aria-pressed', 'false')
  })

  it('renders with Remove from wishlist aria-label when wishlisted', () => {
    renderButton(['p1'])
    const button = screen.getByRole('button', {
      name: 'Remove Test Product from wishlist',
    })
    expect(button).toBeInTheDocument()
    expect(button).toHaveAttribute('aria-pressed', 'true')
  })

  it('dispatches fetchWishlist when user is authenticated and wishlist not loaded', () => {
    renderButton([], true, {
      data: {
        user: { id: 'u1', role: 'CUSTOMER' },
        expires: '2099-01-01',
      },
      status: 'authenticated',
      update: vi.fn(),
    })
    expect(mockDispatch).toHaveBeenCalled()
  })

  it('does nothing on click when user is not authenticated', async () => {
    renderButton([])
    const button = screen.getByRole('button')
    fireEvent.click(button)
    await waitFor(() => {
      expect(mockOptimisticToggle).not.toHaveBeenCalled()
    })
  })

  it('dispatches optimisticToggle and addToWishlist when adding', async () => {
    renderButton([], false, {
      data: {
        user: { id: 'u1', role: 'CUSTOMER' },
        expires: '2099-01-01',
      },
      status: 'authenticated',
      update: vi.fn(),
    })
    const button = screen.getByRole('button')
    fireEvent.click(button)
    await waitFor(() => {
      expect(mockDispatch).toHaveBeenCalled()
      expect(mockOptimisticToggle).toHaveBeenCalledWith('p1')
      expect(mockAddToWishlist).toHaveBeenCalledWith('p1')
    })
  })

  it('dispatches optimisticToggle and removeFromWishlist when removing', async () => {
    renderButton(['p1'], false, {
      data: {
        user: { id: 'u1', role: 'CUSTOMER' },
        expires: '2099-01-01',
      },
      status: 'authenticated',
      update: vi.fn(),
    })
    const button = screen.getByRole('button')
    fireEvent.click(button)
    await waitFor(() => {
      expect(mockDispatch).toHaveBeenCalled()
      expect(mockOptimisticToggle).toHaveBeenCalledWith('p1')
      expect(mockRemoveFromWishlist).toHaveBeenCalledWith('p1')
    })
  })

  it('applies custom className', () => {
    mockUseSession.mockReturnValue({
      data: null,
      status: 'unauthenticated',
      update: vi.fn(),
    })
    const store = makeTestStore()
    render(
      <Provider store={store}>
        <WishlistButton
          productId="p1"
          productName="Test"
          className="extra-class"
        />
      </Provider>
    )
    const button = screen.getByRole('button')
    expect(button.className).toContain('extra-class')
  })

  it('renders the heart SVG icon', () => {
    const { container } = render(
      <Provider store={makeTestStore()}>
        <WishlistButton productId="p1" productName="Test" />
      </Provider>
    )
    expect(container.querySelector('svg')).toBeTruthy()
  })
})
