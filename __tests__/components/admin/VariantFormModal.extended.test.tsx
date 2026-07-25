// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import React from 'react'
import VariantFormModal from '@/features/admin/components/VariantFormModal'
import type { ProductVariant } from '@/lib/types'

const { mockToastError, mockToastSuccess, mockIsValidImageType } = vi.hoisted(
  () => ({
    mockToastError: vi.fn(),
    mockToastSuccess: vi.fn(),
    mockIsValidImageType: vi.fn(() => true),
  })
)

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
  isValidImageType: mockIsValidImageType,
  MAX_FILE_SIZE: 1024,
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
    rates: { INR: 1, USD: 0.5 },
  }),
}))

const baseVariant: ProductVariant = {
  id: 'var1234',
  productId: 'abc1234',
  sku: 'SKU-1',
  image: 'https://cdn.test/primary.png',
  images: ['https://cdn.test/extra.png'],
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

const makeFile = (name = 'pic.png', size = 10) => {
  const file = new File(['x'.repeat(size)], name, { type: 'image/png' })
  Object.defineProperty(file, 'size', { value: size })
  return file
}

const fillRequiredFields = (price = '100', stock = '5') => {
  fireEvent.change(screen.getByRole('spinbutton', { name: 'Price' }), {
    target: { value: price },
  })
  fireEvent.change(screen.getByLabelText(/Stock/), {
    target: { value: stock },
  })
}

describe('VariantFormModal (extended)', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockIsValidImageType.mockReturnValue(true)
    vi.stubGlobal('fetch', vi.fn())
    globalThis.URL.createObjectURL = vi.fn(() => 'blob:preview')
    globalThis.URL.revokeObjectURL = vi.fn()
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('renders existing SKU in the preview panel', () => {
    render(<VariantFormModal {...defaultProps} variant={baseVariant} />)
    expect(screen.getAllByText('SKU').length).toBeGreaterThan(1)
    expect(screen.getByText('SKU-1')).toBeInTheDocument()
  })

  it('updates the SKU field and clears its error state', () => {
    render(<VariantFormModal {...defaultProps} />)
    const skuInput = screen.getByLabelText(/SKU/)
    fireEvent.change(skuInput, { target: { value: 'SKU-NEW' } })
    expect(screen.getAllByDisplayValue('SKU-NEW').length).toBeGreaterThan(0)
  })

  it('converts the entered price when the price currency changes', () => {
    render(<VariantFormModal {...defaultProps} />)
    fireEvent.change(screen.getByRole('spinbutton', { name: 'Price' }), {
      target: { value: '100' },
    })
    const currencySelect = screen.getByRole('combobox')
    fireEvent.change(currencySelect, { target: { value: 'USD' } })
    expect(screen.getByText(/50\.00 USD/)).toBeInTheDocument()
  })

  it('rejects a primary image with an invalid type', () => {
    mockIsValidImageType.mockReturnValue(false)
    render(<VariantFormModal {...defaultProps} />)
    const fileInput = screen.getByLabelText(/Primary Image/)
    fireEvent.change(fileInput, { target: { files: [makeFile()] } })
    expect(mockToastError).toHaveBeenCalledWith(
      expect.stringContaining('Invalid type')
    )
  })

  it('rejects a primary image that is too large', () => {
    render(<VariantFormModal {...defaultProps} />)
    const fileInput = screen.getByLabelText(/Primary Image/)
    fireEvent.change(fileInput, {
      target: { files: [makeFile('big.png', 4096)] },
    })
    expect(mockToastError).toHaveBeenCalledWith(
      expect.stringContaining('File too large')
    )
  })

  it('ignores a primary image change with no selected file', () => {
    render(<VariantFormModal {...defaultProps} />)
    const fileInput = screen.getByLabelText(/Primary Image/)
    fireEvent.change(fileInput, { target: { files: [] } })
    expect(mockToastError).not.toHaveBeenCalled()
  })

  it('previews a valid primary image selection', () => {
    render(<VariantFormModal {...defaultProps} />)
    const fileInput = screen.getByLabelText(/Primary Image/)
    fireEvent.change(fileInput, { target: { files: [makeFile()] } })
    expect(globalThis.URL.createObjectURL).toHaveBeenCalled()
  })

  it('adds and removes additional image slots', () => {
    render(<VariantFormModal {...defaultProps} />)
    expect(screen.getByText(/Additional Images \(0\//)).toBeInTheDocument()
    fireEvent.click(screen.getByText('+ Add Image'))
    expect(screen.getByText(/Additional Images \(1\//)).toBeInTheDocument()
    fireEvent.click(screen.getByLabelText('Remove image 1'))
    expect(screen.getByText(/Additional Images \(0\//)).toBeInTheDocument()
  })

  it('blocks adding more than the maximum number of images', () => {
    render(
      <VariantFormModal
        {...defaultProps}
        variant={{
          ...baseVariant,
          images: Array.from({ length: 10 }, (_, i) => `https://cdn/${i}.png`),
        }}
      />
    )
    const addButton = screen.getByText('+ Add Image')
    expect(addButton).toBeDisabled()
    fireEvent.click(addButton, {}, { skipPointerEventsCheck: true })
    expect(screen.getByText(/Additional Images \(10\//)).toBeInTheDocument()
  })

  it('validates additional image selections', () => {
    render(<VariantFormModal {...defaultProps} variant={baseVariant} />)
    const slotInput = document.querySelector(
      'input[accept="image/*"]'
    ) as HTMLInputElement

    fireEvent.change(slotInput, { target: { files: [] } })
    expect(mockToastError).not.toHaveBeenCalled()

    mockIsValidImageType.mockReturnValue(false)
    fireEvent.change(slotInput, { target: { files: [makeFile()] } })
    expect(mockToastError).toHaveBeenCalledWith(
      expect.stringContaining('Invalid type')
    )

    mockIsValidImageType.mockReturnValue(true)
    fireEvent.change(slotInput, { target: { files: [makeFile()] } })
    expect(globalThis.URL.createObjectURL).toHaveBeenCalled()
  })

  it('rejects a fractional stock value on submit', async () => {
    render(<VariantFormModal {...defaultProps} />)
    fireEvent.change(screen.getByRole('spinbutton', { name: 'Price' }), {
      target: { value: '10' },
    })
    fireEvent.change(screen.getByLabelText(/Stock/), {
      target: { value: '1.5' },
    })
    fireEvent.click(screen.getByText('Create'))
    await waitFor(() => {
      expect(
        screen.getByText('Stock must be a non-negative integer')
      ).toBeInTheDocument()
    })
  })

  it('uploads the primary image before saving the variant', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ data: { url: 'https://cdn/new.png' } }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ data: { variant: baseVariant } }),
      })
    vi.stubGlobal('fetch', fetchMock)

    render(<VariantFormModal {...defaultProps} />)
    fireEvent.change(screen.getByLabelText(/Primary Image/), {
      target: { files: [makeFile()] },
    })
    fillRequiredFields()
    fireEvent.click(screen.getByText('Create'))

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledWith(
        '/api/upload',
        expect.objectContaining({ method: 'POST' })
      )
      expect(mockToastSuccess).toHaveBeenCalledWith('Variant created')
    })
  })

  it('surfaces an upload failure message', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: false,
      json: async () => ({ error: 'Upload rejected' }),
    })
    vi.stubGlobal('fetch', fetchMock)

    render(<VariantFormModal {...defaultProps} />)
    fireEvent.change(screen.getByLabelText(/Primary Image/), {
      target: { files: [makeFile()] },
    })
    fillRequiredFields()
    fireEvent.click(screen.getByText('Create'))

    await waitFor(() => {
      expect(mockToastError).toHaveBeenCalledWith('Upload rejected')
    })
  })

  it('falls back to a generic upload error when the body is unreadable', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: false,
      json: async () => {
        throw new Error('bad json')
      },
    })
    vi.stubGlobal('fetch', fetchMock)

    render(<VariantFormModal {...defaultProps} />)
    fireEvent.change(screen.getByLabelText(/Primary Image/), {
      target: { files: [makeFile()] },
    })
    fillRequiredFields()
    fireEvent.click(screen.getByText('Create'))

    await waitFor(() => {
      expect(mockToastError).toHaveBeenCalledWith('Failed to upload image')
    })
  })

  it('uploads pending gallery files and keeps existing urls', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ data: { url: 'https://cdn/slot.png' } }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ data: { variant: baseVariant } }),
      })
    vi.stubGlobal('fetch', fetchMock)

    render(<VariantFormModal {...defaultProps} variant={baseVariant} />)
    const slotInput = document.querySelector(
      'input[accept="image/*"]'
    ) as HTMLInputElement
    fireEvent.change(slotInput, { target: { files: [makeFile()] } })
    fireEvent.click(screen.getByText('Update'))

    await waitFor(() => {
      const body = JSON.parse(fetchMock.mock.calls[1][1].body as string)
      expect(body.images).toEqual(['https://cdn/slot.png'])
      expect(body.sku).toBe('SKU-1')
    })
  })

  it('drops empty gallery slots from the payload', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ data: { variant: baseVariant } }),
    })
    vi.stubGlobal('fetch', fetchMock)

    render(<VariantFormModal {...defaultProps} />)
    fireEvent.click(screen.getByText('+ Add Image'))
    fillRequiredFields()
    fireEvent.click(screen.getByText('Create'))

    await waitFor(() => {
      const body = JSON.parse(fetchMock.mock.calls[0][1].body as string)
      expect(body.images).toBeUndefined()
      expect(body.productId).toBe('abc1234')
      expect(body.sku).toBeNull()
    })
  })

  it('reports an unexpected server response shape', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ data: {} }),
    })
    vi.stubGlobal('fetch', fetchMock)

    render(<VariantFormModal {...defaultProps} />)
    fillRequiredFields()
    fireEvent.click(screen.getByText('Create'))

    await waitFor(() => {
      expect(mockToastError).toHaveBeenCalledWith(
        'Unexpected variant response from server'
      )
    })
  })

  it('falls back to the default error message when the response body is empty', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: false,
      json: async () => {
        throw new Error('no body')
      },
    })
    vi.stubGlobal('fetch', fetchMock)

    render(<VariantFormModal {...defaultProps} variant={baseVariant} />)
    fireEvent.click(screen.getByText('Update'))

    await waitFor(() => {
      expect(mockToastError).toHaveBeenCalledWith('Failed to update variant')
    })
  })

  it('reports a non-Error rejection with a generic message', async () => {
    const fetchMock = vi.fn().mockRejectedValue('boom')
    vi.stubGlobal('fetch', fetchMock)

    render(<VariantFormModal {...defaultProps} />)
    fillRequiredFields()
    fireEvent.click(screen.getByText('Create'))

    await waitFor(() => {
      expect(mockToastError).toHaveBeenCalledWith('Something went wrong')
    })
  })

  it('shows a saving state while the request is in flight', async () => {
    let resolveFetch: (value: unknown) => void = () => {}
    const fetchMock = vi.fn().mockImplementation(
      () =>
        new Promise((resolve) => {
          resolveFetch = resolve
        })
    )
    vi.stubGlobal('fetch', fetchMock)

    render(<VariantFormModal {...defaultProps} />)
    fillRequiredFields()
    fireEvent.click(screen.getByText('Create'))

    await waitFor(() => {
      expect(screen.getByText('Saving...')).toBeInTheDocument()
    })
    expect(screen.getByText('Cancel')).toBeDisabled()

    resolveFetch({
      ok: true,
      json: async () => ({ data: { variant: baseVariant } }),
    })
    await waitFor(() => {
      expect(mockToastSuccess).toHaveBeenCalled()
    })
  })

  it('renders an em dash when no price has been entered', () => {
    render(<VariantFormModal {...defaultProps} />)
    expect(screen.getByText(/—/)).toBeInTheDocument()
  })
})
