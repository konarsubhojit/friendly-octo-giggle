import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import ProductEditPageForm from '@/features/admin/components/ProductEditPageForm'

const mockPush = vi.fn()
const mockRefresh = vi.fn()

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: mockPush, refresh: mockRefresh }),
}))

vi.mock('@/features/admin/components/ProductFormModal', () => ({
  default: ({
    editingProduct,
    layout,
    onClose,
    onSuccess,
  }: {
    editingProduct: { id: string; name: string }
    layout: string
    onClose: () => void
    onSuccess: (product: { id: string }) => void
  }) => (
    <div data-testid="product-form-modal">
      <span data-testid="editing-product">{editingProduct.name}</span>
      <span data-testid="layout">{layout}</span>
      <button data-testid="cancel-btn" onClick={onClose}>
        Cancel
      </button>
      <button
        data-testid="save-btn"
        onClick={() => onSuccess({ id: 'saved-1' })}
      >
        Save
      </button>
    </div>
  ),
}))

const mockProduct = {
  id: 'prod123',
  name: 'Test Product',
  description: 'A test product',
  price: 1000,
  image: '/img.jpg',
  stock: 10,
  category: 'Cat',
  deletedAt: null,
  createdAt: '2024-01-01T00:00:00Z',
  updatedAt: '2024-06-01T00:00:00Z',
}

describe('ProductEditPageForm', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('passes the product and page layout to ProductFormModal', () => {
    render(<ProductEditPageForm product={mockProduct} />)
    expect(screen.getByTestId('product-form-modal')).toBeInTheDocument()
    expect(screen.getByTestId('editing-product')).toHaveTextContent(
      'Test Product'
    )
    expect(screen.getByTestId('layout')).toHaveTextContent('page')
  })

  it('navigates to product detail page on cancel', () => {
    render(<ProductEditPageForm product={mockProduct} />)
    screen.getByTestId('cancel-btn').click()
    expect(mockPush).toHaveBeenCalledWith('/admin/products/prod123')
  })

  it('navigates to saved product page on success and refreshes', () => {
    render(<ProductEditPageForm product={mockProduct} />)
    screen.getByTestId('save-btn').click()
    expect(mockPush).toHaveBeenCalledWith('/admin/products/saved-1')
    expect(mockRefresh).toHaveBeenCalled()
  })
})
