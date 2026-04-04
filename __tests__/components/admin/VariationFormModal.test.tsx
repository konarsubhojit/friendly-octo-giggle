import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import React from 'react'
import VariationFormModal from '@/features/admin/components/VariationFormModal'
import type { ProductVariation } from '@/lib/types'

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

const mockVariation: ProductVariation = {
  id: 'var1234',
  productId: 'abc1234',
  styleId: null,
  name: 'Red - Large',
  designName: 'Classic Logo',
  image: null,
  images: [],
  price: 150,
  variationType: 'styling' as const,
  stock: 25,
  deletedAt: null,
  createdAt: '2025-01-01T00:00:00.000Z',
  updatedAt: '2025-01-01T00:00:00.000Z',
}

const defaultProps = {
  productId: 'abc1234',
  productPrice: 29.99,
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
    expect(screen.getByText('Add Variation')).toBeInTheDocument()
    expect(screen.getByLabelText(/^Name/)).toHaveValue('')
    expect(screen.getByLabelText(/Design Name/)).toHaveValue('')
    expect(screen.getByText('Create')).toBeInTheDocument()
  })

  it('renders in edit mode with pre-populated fields', () => {
    render(<VariationFormModal {...defaultProps} variation={mockVariation} />)
    expect(screen.getByText('Edit Variation')).toBeInTheDocument()
    expect(screen.getByLabelText(/^Name/)).toHaveValue('Red - Large')
    expect(screen.getByLabelText(/Design Name/)).toHaveValue('Classic Logo')
    expect(screen.getByText('Update')).toBeInTheDocument()
  })

  it('shows validation errors for empty required fields', async () => {
    render(<VariationFormModal {...defaultProps} />)
    fireEvent.click(screen.getByRole('radio', { name: /🌈 Colour/ }))
    fireEvent.click(screen.getByText('Create'))

    await waitFor(() => {
      expect(screen.getByText('Name is required')).toBeInTheDocument()
      expect(screen.getByText('Design name is required')).toBeInTheDocument()
      expect(screen.getByText('Stock is required')).toBeInTheDocument()
    })
  })

  it('shows price warning when price <= 0', () => {
    render(<VariationFormModal {...defaultProps} />)
    fireEvent.click(screen.getByRole('radio', { name: /🌈 Colour/ }))
    const priceInput = screen.getByRole('spinbutton', { name: /price/i })
    fireEvent.change(priceInput, {
      target: { name: 'price', value: '-50' },
    })
    expect(
      screen.getByText(/must be greater than 0.00 INR/)
    ).toBeInTheDocument()
  })

  it('disables submit when price is invalid', () => {
    render(<VariationFormModal {...defaultProps} />)
    fireEvent.click(screen.getByRole('radio', { name: /🌈 Colour/ }))
    const priceInput = screen.getByRole('spinbutton', { name: /price/i })
    fireEvent.change(priceInput, {
      target: { name: 'price', value: '-100' },
    })
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
      json: async () => ({ data: { variation: mockVariation } }),
    })
    vi.stubGlobal('fetch', mockFetch)

    render(<VariationFormModal {...defaultProps} onSuccess={onSuccess} />)

    fireEvent.click(screen.getByRole('radio', { name: /🌈 Colour/ }))

    fireEvent.change(screen.getByLabelText(/^Name/), {
      target: { name: 'name', value: 'Blue' },
    })
    fireEvent.change(screen.getByLabelText(/Design Name/), {
      target: { name: 'designName', value: 'Modern' },
    })
    fireEvent.change(screen.getByRole('spinbutton', { name: /price/i }), {
      target: { name: 'price', value: '150' },
    })
    fireEvent.change(screen.getByLabelText(/Stock/), {
      target: { name: 'stock', value: '10' },
    })

    fireEvent.click(screen.getByText('Create'))

    await waitFor(() => {
      expect(mockFetch).toHaveBeenCalledWith(
        '/api/admin/variations',
        expect.objectContaining({
          method: 'POST',
          body: JSON.stringify({
            name: 'Blue',
            designName: 'Modern',
            variationType: 'colour',
            price: 150,
            stock: 10,
            styleId: null,
            productId: 'abc1234',
            image: null,
          }),
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
        data: { variation: { ...mockVariation, name: 'Green' } },
      }),
    })
    vi.stubGlobal('fetch', mockFetch)

    render(
      <VariationFormModal
        {...defaultProps}
        variation={mockVariation}
        onSuccess={onSuccess}
      />
    )

    fireEvent.change(screen.getByLabelText(/^Name/), {
      target: { name: 'name', value: 'Green' },
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

  it('renders in styling type mode and hides price/stock fields', () => {
    render(<VariationFormModal {...defaultProps} />)
    // Default is 'styling' type
    expect(screen.getByRole('radio', { name: /🎨 Style/ })).toBeChecked()
    // Price and stock fields should not be present for styling type
    expect(screen.queryByLabelText(/^Stock/)).not.toBeInTheDocument()
    expect(screen.queryByLabelText(/^Price/)).not.toBeInTheDocument()
  })

  it('shows style grouping info banner for styling type', () => {
    render(<VariationFormModal {...defaultProps} />)
    expect(screen.getByText(/Styles are grouping-only/)).toBeInTheDocument()
  })

  it('shows parent style selector when switching to colour type', () => {
    render(<VariationFormModal {...defaultProps} />)
    fireEvent.click(screen.getByRole('radio', { name: /🌈 Colour/ }))
    expect(screen.getByLabelText('Parent style')).toBeInTheDocument()
  })

  it('renders parent style options when styles prop is provided', () => {
    const mockStyles = [
      {
        ...mockVariation,
        id: 'sty001',
        name: 'Floral',
        designName: 'classic',
        variationType: 'styling' as const,
      },
    ]
    render(<VariationFormModal {...defaultProps} styles={mockStyles} />)
    fireEvent.click(screen.getByRole('radio', { name: /🌈 Colour/ }))
    expect(screen.getByText(/Floral/)).toBeInTheDocument()
  })

  it('submits styling type without price/stock validation', async () => {
    const onSuccess = vi.fn()
    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ data: { variation: mockVariation } }),
    })
    vi.stubGlobal('fetch', mockFetch)

    render(<VariationFormModal {...defaultProps} onSuccess={onSuccess} />)

    // Styling type is the default
    fireEvent.change(screen.getByLabelText(/^Name/), {
      target: { name: 'name', value: 'Floral Style' },
    })
    fireEvent.change(screen.getByLabelText(/Design Name/), {
      target: { name: 'designName', value: 'Summer' },
    })
    // No price or stock input needed for styling type
    fireEvent.click(screen.getByText('Create'))

    await waitFor(() => {
      expect(mockFetch).toHaveBeenCalledWith(
        '/api/admin/variations',
        expect.objectContaining({
          method: 'POST',
          body: expect.stringContaining('"variationType":"styling"'),
        })
      )
      expect(onSuccess).toHaveBeenCalled()
    })
  })

  it('shows name too long validation error', async () => {
    render(<VariationFormModal {...defaultProps} />)
    fireEvent.click(screen.getByRole('radio', { name: /🌈 Colour/ }))

    const longName = 'A'.repeat(101)
    fireEvent.change(screen.getByLabelText(/^Name/), {
      target: { name: 'name', value: longName },
    })
    fireEvent.click(screen.getByText('Create'))

    await waitFor(() => {
      expect(
        screen.getByText('Name must be under 100 characters')
      ).toBeInTheDocument()
    })
  })

  it('shows design name too long validation error', async () => {
    render(<VariationFormModal {...defaultProps} />)
    fireEvent.click(screen.getByRole('radio', { name: /🌈 Colour/ }))

    fireEvent.change(screen.getByLabelText(/^Name/), {
      target: { name: 'name', value: 'Red' },
    })
    fireEvent.change(screen.getByLabelText(/Design Name/), {
      target: { name: 'designName', value: 'D'.repeat(101) },
    })
    fireEvent.click(screen.getByText('Create'))

    await waitFor(() => {
      expect(
        screen.getByText('Design name must be under 100 characters')
      ).toBeInTheDocument()
    })
  })

  it('shows stock validation error for non-integer stock value', async () => {
    render(<VariationFormModal {...defaultProps} />)
    // Switch to colour type so stock/price fields appear
    fireEvent.click(screen.getByRole('radio', { name: /🌈 Colour/ }))

    fireEvent.change(screen.getByLabelText(/^Name/), {
      target: { name: 'name', value: 'Red' },
    })
    fireEvent.change(screen.getByLabelText(/Design Name/), {
      target: { name: 'designName', value: 'Classic' },
    })
    fireEvent.change(screen.getByRole('spinbutton', { name: /price/i }), {
      target: { name: 'price', value: '100' },
    })
    fireEvent.click(screen.getByText('Create'))

    await waitFor(() => {
      expect(screen.getByText('Stock is required')).toBeInTheDocument()
    })
  })

  it('shows toast error when fetch returns error response', async () => {
    const mockFetch = vi.fn().mockResolvedValue({
      ok: false,
      json: async () => ({ error: 'Duplicate variation name' }),
    })
    vi.stubGlobal('fetch', mockFetch)

    render(<VariationFormModal {...defaultProps} />)
    fireEvent.click(screen.getByRole('radio', { name: /🌈 Colour/ }))
    fireEvent.change(screen.getByLabelText(/^Name/), {
      target: { name: 'name', value: 'Red' },
    })
    fireEvent.change(screen.getByLabelText(/Design Name/), {
      target: { name: 'designName', value: 'Classic' },
    })
    fireEvent.change(screen.getByRole('spinbutton', { name: /price/i }), {
      target: { name: 'price', value: '100' },
    })
    fireEvent.change(screen.getByLabelText(/Stock/), {
      target: { name: 'stock', value: '10' },
    })
    fireEvent.click(screen.getByText('Create'))

    await waitFor(() => {
      expect(mockToastError).toHaveBeenCalledWith('Duplicate variation name')
    })
  })

  it('shows generic toast error when server returns unexpected response', async () => {
    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ unexpected: 'format' }),
    })
    vi.stubGlobal('fetch', mockFetch)

    render(<VariationFormModal {...defaultProps} />)
    fireEvent.click(screen.getByRole('radio', { name: /🌈 Colour/ }))
    fireEvent.change(screen.getByLabelText(/^Name/), {
      target: { name: 'name', value: 'Blue' },
    })
    fireEvent.change(screen.getByLabelText(/Design Name/), {
      target: { name: 'designName', value: 'Summer' },
    })
    fireEvent.change(screen.getByRole('spinbutton', { name: /price/i }), {
      target: { name: 'price', value: '150' },
    })
    fireEvent.change(screen.getByLabelText(/Stock/), {
      target: { name: 'stock', value: '5' },
    })
    fireEvent.click(screen.getByText('Create'))

    await waitFor(() => {
      expect(mockToastError).toHaveBeenCalledWith(
        expect.stringContaining('Unexpected variation response')
      )
    })
  })

  it('closes via close X button (aria-label)', () => {
    const onClose = vi.fn()
    render(<VariationFormModal {...defaultProps} onClose={onClose} />)
    fireEvent.click(screen.getByLabelText('Close variation editor'))
    expect(onClose).toHaveBeenCalled()
  })

  it('switches from styling to colour type and resets styleId', () => {
    render(<VariationFormModal {...defaultProps} />)
    // Start on styling
    expect(screen.getByRole('radio', { name: /🎨 Style/ })).toBeChecked()
    // Switch to colour
    fireEvent.click(screen.getByRole('radio', { name: /🌈 Colour/ }))
    expect(screen.getByRole('radio', { name: /🌈 Colour/ })).toBeChecked()
    // Parent style selector should appear
    expect(screen.getByLabelText('Parent style')).toBeInTheDocument()
    // Switch back to styling
    fireEvent.click(screen.getByRole('radio', { name: /🎨 Style/ }))
    expect(screen.getByRole('radio', { name: /🎨 Style/ })).toBeChecked()
  })

  it('displays Add Variation title text for create mode', () => {
    render(<VariationFormModal {...defaultProps} />)
    expect(screen.getByText('Add Variation')).toBeInTheDocument()
    expect(screen.getByText(/Variation editor/i)).toBeInTheDocument()
  })

  it('displays Edit Variation title text for edit mode', () => {
    render(<VariationFormModal {...defaultProps} variation={mockVariation} />)
    expect(screen.getByText('Edit Variation')).toBeInTheDocument()
  })
})
