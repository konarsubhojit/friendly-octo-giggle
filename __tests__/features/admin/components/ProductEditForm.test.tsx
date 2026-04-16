// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import ProductEditForm from '@/features/admin/components/ProductEditForm'

const mockFormatPrice = vi.fn((price: number) => `₹${price.toFixed(2)}`)

vi.mock('@/contexts/CurrencyContext', () => ({
  useCurrency: () => ({ formatPrice: mockFormatPrice }),
}))

vi.mock('next/image', () => ({
  default: ({
    src,
    alt,
    ...props
  }: {
    src: string
    alt: string
    [key: string]: unknown
  }) => <img src={src} alt={alt} data-testid="product-image" {...props} />,
}))

const mockProduct = {
  id: 'abc1234',
  name: 'Vintage Dress',
  description: 'A beautiful vintage dress for all occasions',
  image: '/images/dress.jpg',
  images: [] as string[],
  category: 'Dresses',
  deletedAt: null,
  createdAt: '2024-01-01T00:00:00Z',
  updatedAt: '2024-06-01T00:00:00Z',
  variants: [
    {
      id: 'var001',
      productId: 'abc1234',
      sku: null,
      price: 2499,
      stock: 15,
      image: null,
      images: [],
      deletedAt: null,
      createdAt: '2024-01-01T00:00:00Z',
      updatedAt: '2024-06-01T00:00:00Z',
    },
  ],
}

describe('ProductEditForm', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('renders the product name', () => {
    render(<ProductEditForm product={mockProduct} />)
    expect(screen.getByText('Vintage Dress')).toBeInTheDocument()
  })

  it('renders the product description', () => {
    render(<ProductEditForm product={mockProduct} />)
    expect(
      screen.getByText('A beautiful vintage dress for all occasions')
    ).toBeInTheDocument()
  })

  it('renders the formatted price', () => {
    render(<ProductEditForm product={mockProduct} />)
    expect(mockFormatPrice).toHaveBeenCalledWith(2499)
    expect(screen.getByText('₹2499.00')).toBeInTheDocument()
  })

  it('renders the stock count', () => {
    render(<ProductEditForm product={mockProduct} />)
    expect(screen.getByText('15')).toBeInTheDocument()
  })

  it('renders the category', () => {
    render(<ProductEditForm product={mockProduct} />)
    expect(screen.getByText('Dresses')).toBeInTheDocument()
  })

  it('renders the product image', () => {
    render(<ProductEditForm product={mockProduct} />)
    const img = screen.getByTestId('product-image')
    expect(img).toHaveAttribute('src', '/images/dress.jpg')
    expect(img).toHaveAttribute('alt', 'Vintage Dress')
  })

  it('renders section labels', () => {
    render(<ProductEditForm product={mockProduct} />)
    expect(screen.getByText('Product summary')).toBeInTheDocument()
    expect(screen.getByText('From price')).toBeInTheDocument()
    expect(screen.getByText('Total stock')).toBeInTheDocument()
    expect(screen.getByText('Category')).toBeInTheDocument()
  })
})
