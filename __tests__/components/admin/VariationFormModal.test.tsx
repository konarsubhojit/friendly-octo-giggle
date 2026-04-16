import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import React from 'react'
import VariationFormModal from '@/features/admin/components/VariationFormModal'
import type { ProductVariant } from '@/lib/types'

const { mockToastError, mockToastSuccess } = vi.hoisted(() => ({
  mockToastError: vi.fn(),
  mockToastSuccess: vi.fn(),
}))

vi.mock('react-hot-toast', () => ({
  default: { error: mockToastError, success: mockToastSuccess },
  error: mockToastError,
  success: mockToastSuccess,
}))

vi.mock('next/image', () => ({
  default: ({ alt, src }: { alt: string; src: string }) => (
    <img alt={alt} src={src} />
  ),
}))

vi.mock('@/lib/upload-constants', () => ({
  isValidImageType: () => true,
  MAX_FILE_SIZE: 5 * 1024 * 1024,
  VALID_IMAGE_TYPES_DISPLAY: 'JPEG, PNG, WebP, GIF',
}))

vi.mock('@/contexts/CurrencyContext', () => ({
  CURRENCIES: {
    INR: { symbol: '₹' },
    USD: { symbol: '$' },
  },
  useCurrency: () => ({
    currency: 'INR',
    availableCurrencies: ['INR', 'USD'],
    rates: { INR: 1, USD: 1 / 83.5 },
  }),
}))

const mockVariant: ProductVariant = {
  id: 'var1234',
  productId: 'abc1234',
  sku: null,
  image: null,
  images: [],
  price: 150,
  stock: 25,
  deletedAt: null,
  createdAt: '2025-01-01T00:00:00.000Z',
  updatedAt: '2025-01-01T00:00:00.000Z',
}

const defaultProps = {
  productId: 'abc1234',
  onClose: vi.fn(),
  onSuccess: vi.fn(),
}

describe('VariationFormModal', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.stubGlobal('fetch', vi.fn())
  })

  it('renders in create mode with empty fields', () => {
    render(<VariationFormModal {...defaultProps} />)
    expect(screen.getByText('Add Variant')).toBeInTheDocument()
    expect(screen.getByText('Create')).toBeInTheDocument()
  })

  it('renders in edit mode with pre-populated fields', () => {
    render(<VariationFormModal {...defaultProps} variant={mockVariant} />)
    expect(screen.getByText('Edit Variant')).toBeInTheDocument()
    expect(screen.getByText('Update')).toBeInTheDocument()
  })

  it('shows price warning when price <= 0', () => {
    render(<VariationFormModal {...defaultProps} />)
    const priceInput = screen.getByRole('spinbutton', { name: 'Price' })
    fireEvent.change(priceInput, { target: { value: '-50' } })
    expect(
      screen.getByText(/must be greater than 0.00 INR/)
    ).toBeInTheDocument()
  })

  it('disables submit when price is invalid', () => {
    render(<VariationFormModal {...defaultProps} />)
    const priceInput = screen.getByRole('spinbutton', { name: 'Price' })
    fireEvent.change(priceInput, { target: { value: '-100' } })
    expect(screen.getByText('Create')).toBeDisabled()
  })

  it('calls onClose when Cancel is clicked', () => {
    const onClose = vi.fn()
    render(<VariationFormModal {...defaultProps} onClose={onClose} />)
    fireEvent.click(screen.getByText('Cancel'))
    expect(onClose).toHaveBeenCalled()
  })

  it('submits to POST endpoint in create mode', async () => {
    const onSuccess = vi.fn()
    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ data: { variant: mockVariant } }),
    })
    vi.stubGlobal('fetch', mockFetch)

    render(<VariationFormModal {...defaultProps} onSuccess={onSuccess} />)

    fireEvent.change(screen.getByRole('spinbutton', { name: 'Price' }), {
      target: { value: '150' },
    })
    fireEvent.change(screen.getByLabelText(/Stock/), {
      target: { value: '10' },
    })

    fireEvent.click(screen.getByText('Create'))

    await waitFor(() => {
      expect(mockFetch).toHaveBeenCalledWith(
        '/api/admin/variations',
        expect.objectContaining({
          method: 'POST',
        })
      )
      expect(onSuccess).toHaveBeenCalled()
    })
  })

  it('submits to PUT endpoint in edit mode', async () => {
    const onSuccess = vi.fn()
    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        data: { variant: { ...mockVariant, price: 200 } },
      }),
    })
    vi.stubGlobal('fetch', mockFetch)

    render(
      <VariationFormModal
        {...defaultProps}
        variant={mockVariant}
        onSuccess={onSuccess}
      />
    )

    fireEvent.change(screen.getByRole('spinbutton', { name: 'Price' }), {
      target: { value: '200' },
    })
    fireEvent.click(screen.getByText('Update'))

    await waitFor(() => {
      expect(mockFetch).toHaveBeenCalledWith(
        '/api/admin/variations/var1234',
        expect.objectContaining({ method: 'PUT' })
      )
      expect(onSuccess).toHaveBeenCalled()
    })
  })

  it('shows validation errors for empty required fields', async () => {
    render(<VariationFormModal {...defaultProps} />)
    fireEvent.click(screen.getByText('Create'))

    await waitFor(() => {
      expect(screen.getByText('Stock is required')).toBeInTheDocument()
    })
  })

  it('shows toast error when fetch returns error response', async () => {
    const mockFetch = vi.fn().mockResolvedValue({
      ok: false,
      json: async () => ({ error: 'Server error' }),
    })
    vi.stubGlobal('fetch', mockFetch)

    render(<VariationFormModal {...defaultProps} />)
    fireEvent.change(screen.getByRole('spinbutton', { name: 'Price' }), {
      target: { value: '100' },
    })
    fireEvent.change(screen.getByLabelText(/Stock/), {
      target: { value: '10' },
    })
    fireEvent.click(screen.getByText('Create'))

    await waitFor(() => {
      expect(mockToastError).toHaveBeenCalledWith('Server error')
    })
  })

  it('closes via close X button (aria-label)', () => {
    const onClose = vi.fn()
    render(<VariationFormModal {...defaultProps} onClose={onClose} />)
    fireEvent.click(screen.getByLabelText('Close variant editor'))
    expect(onClose).toHaveBeenCalled()
  })

  it('displays Variant editor heading', () => {
    render(<VariationFormModal {...defaultProps} />)
    expect(screen.getByText(/Variant editor/i)).toBeInTheDocument()
  })
})
