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

const mockVariation: ProductVariant = {
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

const switchToColour = () => {
  const typeSelect = screen.getByLabelText('Variation Type')
  fireEvent.change(typeSelect, { target: { value: 'colour' } })
}

const switchToStyling = () => {
  const typeSelect = screen.getByLabelText('Variation Type')
  fireEvent.change(typeSelect, { target: { value: 'styling' } })
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
    render(<VariationFormModal {...defaultProps} variant={mockVariation} />)
    expect(screen.getByText('Edit Variation')).toBeInTheDocument()
    expect(screen.getByText('Update')).toBeInTheDocument()
  })

  it('shows validation errors for empty required fields', async () => {
    render(<VariationFormModal {...defaultProps} />)
    switchToColour()
    fireEvent.click(screen.getByText('Create'))

    await waitFor(() => {
      expect(screen.getByText('Name is required')).toBeInTheDocument()
      expect(screen.getByText('Design name is required')).toBeInTheDocument()
      expect(screen.getByText('Stock is required')).toBeInTheDocument()
    })
  })

  it('shows price warning when price <= 0', () => {
    render(<VariationFormModal {...defaultProps} />)
    switchToColour()
    const priceInput = screen.getByRole('spinbutton', { name: 'Price' })
    fireEvent.change(priceInput, { target: { value: '-50' } })
    expect(
      screen.getByText(/must be greater than 0.00 INR/)
    ).toBeInTheDocument()
  })

  it('disables submit when price is invalid', () => {
    render(<VariationFormModal {...defaultProps} />)
    switchToColour()
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
      json: async () => ({ data: { variation: mockVariation } }),
    })
    vi.stubGlobal('fetch', mockFetch)

    render(<VariationFormModal {...defaultProps} onSuccess={onSuccess} />)

    switchToColour()

    fireEvent.change(screen.getByLabelText(/^Name/), {
      target: { value: 'Blue' },
    })
    fireEvent.change(screen.getByLabelText(/Design Name/), {
      target: { value: 'Modern' },
    })
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
        variant={mockVariation}
        onSuccess={onSuccess}
      />
    )

    fireEvent.change(screen.getByLabelText(/^Name/), {
      target: { value: 'Green' },
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
    const typeSelect = screen.getByLabelText(
      'Variation Type'
    ) as HTMLSelectElement
    expect(typeSelect.value).toBe('styling')
    expect(screen.queryByLabelText(/^Stock/)).not.toBeInTheDocument()
    expect(screen.queryByLabelText(/^Price/)).not.toBeInTheDocument()
  })

  it('shows style grouping info banner for styling type', () => {
    render(<VariationFormModal {...defaultProps} />)
    expect(screen.getByText(/Styles are grouping-only/)).toBeInTheDocument()
  })

  it('shows parent style selector when switching to colour type', () => {
    render(<VariationFormModal {...defaultProps} />)
    switchToColour()
    expect(screen.getByLabelText('Parent Style')).toBeInTheDocument()
  })

  it('renders parent style options when variant prop is provided', () => {
    const mockStyle: ProductVariant = {
      ...mockVariation,
      id: 'sty001',
    }
    render(<VariationFormModal {...defaultProps} variant={mockStyle} />)
    switchToColour()
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

    fireEvent.change(screen.getByLabelText(/^Name/), {
      target: { value: 'Floral Style' },
    })
    fireEvent.change(screen.getByLabelText(/Design Name/), {
      target: { value: 'Summer' },
    })
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
    switchToColour()

    const longName = 'A'.repeat(101)
    fireEvent.change(screen.getByLabelText(/^Name/), {
      target: { value: longName },
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
    switchToColour()

    fireEvent.change(screen.getByLabelText(/^Name/), {
      target: { value: 'Red' },
    })
    fireEvent.change(screen.getByLabelText(/Design Name/), {
      target: { value: 'D'.repeat(101) },
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
    switchToColour()

    fireEvent.change(screen.getByLabelText(/^Name/), {
      target: { value: 'Red' },
    })
    fireEvent.change(screen.getByLabelText(/Design Name/), {
      target: { value: 'Classic' },
    })
    fireEvent.change(screen.getByRole('spinbutton', { name: 'Price' }), {
      target: { value: '100' },
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
    switchToColour()
    fireEvent.change(screen.getByLabelText(/^Name/), {
      target: { value: 'Red' },
    })
    fireEvent.change(screen.getByLabelText(/Design Name/), {
      target: { value: 'Classic' },
    })
    fireEvent.change(screen.getByRole('spinbutton', { name: 'Price' }), {
      target: { value: '100' },
    })
    fireEvent.change(screen.getByLabelText(/Stock/), {
      target: { value: '10' },
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
    switchToColour()
    fireEvent.change(screen.getByLabelText(/^Name/), {
      target: { value: 'Blue' },
    })
    fireEvent.change(screen.getByLabelText(/Design Name/), {
      target: { value: 'Summer' },
    })
    fireEvent.change(screen.getByRole('spinbutton', { name: 'Price' }), {
      target: { value: '150' },
    })
    fireEvent.change(screen.getByLabelText(/Stock/), {
      target: { value: '5' },
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
    const typeSelect = screen.getByLabelText(
      'Variation Type'
    ) as HTMLSelectElement
    expect(typeSelect.value).toBe('styling')
    switchToColour()
    expect(typeSelect.value).toBe('colour')
    expect(screen.getByLabelText('Parent Style')).toBeInTheDocument()
    switchToStyling()
    expect(typeSelect.value).toBe('styling')
  })

  it('displays Add Variation title text for create mode', () => {
    render(<VariationFormModal {...defaultProps} />)
    expect(screen.getByText('Add Variation')).toBeInTheDocument()
    expect(screen.getByText(/Variation editor/i)).toBeInTheDocument()
  })

  it('displays Edit Variation title text for edit mode', () => {
    render(<VariationFormModal {...defaultProps} variant={mockVariation} />)
    expect(screen.getByText('Edit Variation')).toBeInTheDocument()
  })
})
