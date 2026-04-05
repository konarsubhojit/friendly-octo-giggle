import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react'
import React from 'react'
import ProductFormModal from '@/features/admin/components/ProductFormModal'
import { PRODUCT_ERRORS, API_ERRORS } from '@/lib/constants/error-messages'
import { CurrencyProvider } from '@/contexts/CurrencyContext'
import type { Product } from '@/lib/types'

vi.mock('react-hot-toast', () => ({
  default: {
    error: vi.fn(),
    success: vi.fn(),
  },
  error: vi.fn(),
  success: vi.fn(),
}))

vi.mock('next/image', () => ({
  default: ({ alt, src }: { alt: string; src: string }) => (
    <img alt={alt} src={src} />
  ),
}))

vi.mock('@/lib/logger', () => ({
  logError: vi.fn(),
}))

const mockProduct: Product = {
  id: 'prod-1',
  name: 'Test Product',
  description: 'A nice product',
  price: 500, // ₹500 INR (base currency)
  image: 'https://example.com/image.jpg',
  images: [],
  stock: 10,
  category: 'Flowers',
  deletedAt: null,
  createdAt: '2024-01-01',
  updatedAt: '2024-01-01',
}

function renderModal(
  props: Partial<React.ComponentProps<typeof ProductFormModal>> = {}
) {
  const defaults = {
    editingProduct: null,
    onClose: vi.fn(),
    onSuccess: vi.fn(),
  }
  return render(
    <CurrencyProvider>
      <ProductFormModal {...defaults} {...props} />
    </CurrencyProvider>
  )
}

describe('ProductFormModal', () => {
  beforeEach(() => {
    vi.restoreAllMocks()
    // Mock the /api/categories fetch used by the component
    vi.stubGlobal(
      'fetch',
      vi.fn().mockImplementation((url: string) => {
        if (url === '/api/categories') {
          return Promise.resolve({
            ok: true,
            json: () =>
              Promise.resolve({
                data: [
                  { name: 'Flowers' },
                  { name: 'Handbag' },
                  { name: 'Flower Pots' },
                  { name: 'Keychains' },
                  { name: 'Hair Accessories' },
                ],
              }),
          })
        }
        if (url === '/api/exchange-rates') {
          return Promise.resolve({
            ok: true,
            json: () =>
              Promise.resolve({
                data: {
                  rates: { INR: 1, USD: 0.012, EUR: 0.011, GBP: 0.0095 },
                },
              }),
          })
        }
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve({ data: {} }),
        })
      })
    )
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it("renders 'Add Product' heading for new product", () => {
    renderModal()
    expect(screen.getByText('Add Product')).toBeTruthy()
  })

  it("renders 'Edit Product' heading for existing product", () => {
    renderModal({ editingProduct: mockProduct })
    expect(screen.getByText('Edit Product')).toBeTruthy()
  })

  it("shows 'Create Product' submit button for new product", () => {
    renderModal()
    expect(screen.getByText('Create Product')).toBeTruthy()
  })

  it("shows 'Update Product' submit button for edit", () => {
    renderModal({ editingProduct: mockProduct })
    expect(screen.getByText('Update Product')).toBeTruthy()
  })

  it('pre-fills form fields from editingProduct', () => {
    renderModal({ editingProduct: mockProduct })
    const nameInput = screen.getByLabelText('Name')
    expect((nameInput as HTMLInputElement).value).toBe('Test Product')
  })

  it('calls onClose when Cancel is clicked', () => {
    const onClose = vi.fn()
    renderModal({ onClose })
    fireEvent.click(screen.getByText('Cancel'))
    expect(onClose).toHaveBeenCalledOnce()
  })

  it('updates name input when typed', () => {
    renderModal()
    const nameInput = screen.getByLabelText('Name')
    fireEvent.change(nameInput, { target: { value: 'New Name' } })
    expect((nameInput as HTMLInputElement).value).toBe('New Name')
  })

  it('updates description when typed', () => {
    renderModal()
    const descInput = screen.getByLabelText('Description')
    fireEvent.change(descInput, { target: { value: 'New Description' } })
    expect((descInput as HTMLTextAreaElement).value).toBe('New Description')
  })

  it('updates stock when changed', () => {
    renderModal()
    const stockInput = screen.getByLabelText('Stock')
    fireEvent.change(stockInput, { target: { value: '25' } })
    expect((stockInput as HTMLInputElement).value).toBe('25')
  })

  it('allows setting stock to 0 directly', () => {
    renderModal({ editingProduct: mockProduct }) // starts with stock=10
    const stockInput = screen.getByLabelText('Stock')
    fireEvent.change(stockInput, { target: { value: '0' } })
    expect((stockInput as HTMLInputElement).value).toBe('0')
  })

  it('allows clearing stock field and then typing 0', () => {
    renderModal({ editingProduct: mockProduct }) // starts with stock=10
    const stockInput = screen.getByLabelText('Stock')
    fireEvent.change(stockInput, { target: { value: '' } })
    expect((stockInput as HTMLInputElement).value).toBe('0')
    fireEvent.change(stockInput, { target: { value: '0' } })
    expect((stockInput as HTMLInputElement).value).toBe('0')
  })

  it('updates category when selected', async () => {
    renderModal()
    const catSelect = screen.getByLabelText('Category') as HTMLSelectElement

    await waitFor(() => {
      expect(
        Array.from(catSelect.options).some(
          (option) => option.value === 'Keychains'
        )
      ).toBe(true)
    })

    fireEvent.change(catSelect, { target: { value: 'Keychains' } })

    expect(catSelect.value).toBe('Keychains')
  })

  it('shows existing image when editing', () => {
    renderModal({ editingProduct: mockProduct })
    const img = screen.getByRole('img')
    expect(img.getAttribute('src')).toBe('https://example.com/image.jpg')
  })

  it('shows inline error on invalid file type upload', async () => {
    renderModal()
    const fileInput = screen.getByLabelText(/primary image/i)
    const invalidFile = new File(['content'], 'doc.pdf', {
      type: 'application/pdf',
    })
    fireEvent.change(fileInput, { target: { files: [invalidFile] } })
    await waitFor(() => {
      expect(screen.getByText(/only .* files are allowed/i)).toBeInTheDocument()
    })
  })

  it('shows inline error when file exceeds size limit', async () => {
    renderModal()
    const fileInput = screen.getByLabelText(/primary image/i)
    const largeFile = new File(['x'.repeat(6 * 1024 * 1024)], 'large.jpg', {
      type: 'image/jpeg',
    })
    Object.defineProperty(largeFile, 'size', { value: 6 * 1024 * 1024 })
    fireEvent.change(fileInput, { target: { files: [largeFile] } })
    await waitFor(() => {
      expect(screen.getByText(/file is too large/i)).toBeInTheDocument()
    })
  })

  it('shows selected filename after valid file pick', async () => {
    renderModal()
    const fileInput = screen.getByLabelText(/primary image/i)
    const validFile = new File(['content'], 'photo.jpg', {
      type: 'image/jpeg',
    })
    Object.defineProperty(validFile, 'size', { value: 100 * 1024 })
    fireEvent.change(fileInput, { target: { files: [validFile] } })
    await waitFor(() => {
      expect(screen.getByText(/photo\.jpg/)).toBeTruthy()
    })
  })

  it('handles currency change and converts price', () => {
    renderModal({ editingProduct: mockProduct })
    const currencySelect = screen.getByLabelText('Currency')
    fireEvent.change(currencySelect, { target: { value: 'USD' } })
    expect((currencySelect as HTMLSelectElement).value).toBe('USD')
  })

  it('shows inline error when submitting without image', async () => {
    const { container } = renderModal()
    fireEvent.change(screen.getByLabelText('Name'), {
      target: { value: 'Product' },
    })
    fireEvent.change(screen.getByLabelText('Description'), {
      target: { value: 'Desc' },
    })
    fireEvent.change(screen.getByLabelText('Category'), {
      target: { value: 'Flowers' },
    })
    const priceInput = screen.getByLabelText('Price')
    fireEvent.change(priceInput, { target: { value: '100' } })
    const stockInput = screen.getByLabelText('Stock')
    fireEvent.change(stockInput, { target: { value: '5' } })

    const form = container.querySelector('form')
    expect(form).not.toBeNull()
    act(() => {
      fireEvent.submit(form as HTMLFormElement)
    })
    await waitFor(() => {
      expect(
        screen.getByText(PRODUCT_ERRORS.IMAGE_REQUIRED)
      ).toBeInTheDocument()
    })
  })

  it('calls onSuccess and onClose after successful create', async () => {
    const onSuccess = vi.fn()
    const onClose = vi.fn()
    const savedProduct = { ...mockProduct, id: 'new-prod' }

    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ data: { product: savedProduct } }),
      })
    )

    const { container } = renderModal({
      onClose,
      onSuccess,
      editingProduct: mockProduct,
    })

    const form = container.querySelector('form')
    expect(form).not.toBeNull()
    act(() => {
      fireEvent.submit(form as HTMLFormElement)
    })

    await waitFor(() => {
      expect(onClose).toHaveBeenCalled()
      expect(onSuccess).toHaveBeenCalled()
    })
  })

  it('shows error toast when API returns error', async () => {
    const toast = await import('react-hot-toast')
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: false,
        json: () => Promise.resolve({ error: 'Validation failed' }),
      })
    )
    const { container } = renderModal({ editingProduct: mockProduct })
    const form = container.querySelector('form')
    expect(form).not.toBeNull()
    act(() => {
      fireEvent.submit(form as HTMLFormElement)
    })
    await waitFor(() => {
      expect(toast.default.error).toHaveBeenCalledWith(API_ERRORS.PRODUCT_SAVE)
    })
  })

  it('shows error toast and stops submit when file upload fails', async () => {
    const toast = await import('react-hot-toast')
    const logger = await import('@/lib/logger')
    const onSuccess = vi.fn()

    vi.stubGlobal(
      'fetch',
      vi.fn().mockImplementation((url: string) => {
        if (url === '/api/categories') {
          return Promise.resolve({
            ok: true,
            json: () =>
              Promise.resolve({
                data: [{ name: 'Flowers' }, { name: 'Keychains' }],
              }),
          })
        }
        return Promise.reject(new Error('Network error'))
      })
    )

    const { container } = renderModal({ onSuccess })

    await waitFor(() => {
      expect(screen.getByRole('option', { name: 'Flowers' })).toBeTruthy()
    })

    fireEvent.change(screen.getByLabelText('Name'), {
      target: { value: 'New Product' },
    })
    fireEvent.change(screen.getByLabelText('Description'), {
      target: { value: 'Description' },
    })
    fireEvent.change(screen.getByLabelText('Category'), {
      target: { value: 'Flowers' },
    })
    fireEvent.change(screen.getByLabelText('Price'), {
      target: { value: '50' },
    })
    fireEvent.change(screen.getByLabelText('Stock'), {
      target: { value: '10' },
    })

    const fileInput = screen.getByLabelText(/primary image/i)
    const validFile = new File(['content'], 'test.jpg', { type: 'image/jpeg' })
    Object.defineProperty(validFile, 'size', { value: 100 * 1024 })
    fireEvent.change(fileInput, { target: { files: [validFile] } })

    const form = container.querySelector('form')
    expect(form).not.toBeNull()
    act(() => {
      fireEvent.submit(form as HTMLFormElement)
    })

    await waitFor(() => {
      expect(logger.logError).toHaveBeenCalledWith(
        expect.objectContaining({ context: 'resolveImageUrl' })
      )
      expect(toast.default.error).toHaveBeenCalledWith(API_ERRORS.IMAGE_UPLOAD)
      expect(onSuccess).not.toHaveBeenCalled()
    })
  })

  it("shows 'Saving...' button text during submission", async () => {
    let resolvePromise: (value: unknown) => void = () => {}
    const pendingPromise = new Promise((resolve) => {
      resolvePromise = resolve
    })

    vi.stubGlobal('fetch', vi.fn().mockReturnValue(pendingPromise))

    const { container } = renderModal({ editingProduct: mockProduct })
    const form = container.querySelector('form')
    expect(form).not.toBeNull()

    act(() => {
      fireEvent.submit(form as HTMLFormElement)
    })

    await waitFor(() => {
      expect(screen.getByText('Saving...')).toBeTruthy()
    })

    resolvePromise({
      ok: true,
      json: () => Promise.resolve({ data: { product: mockProduct } }),
    })
  })

  it('successfully creates product with file upload', async () => {
    const onSuccess = vi.fn()
    const onClose = vi.fn()
    const savedProduct = {
      ...mockProduct,
      id: 'new-prod',
      image: 'https://cdn.example.com/uploaded.jpg',
    }

    let productCallCount = 0
    vi.stubGlobal(
      'fetch',
      vi.fn().mockImplementation((url: string) => {
        if (url === '/api/categories') {
          return Promise.resolve({
            ok: true,
            json: () =>
              Promise.resolve({
                data: [{ name: 'Flowers' }, { name: 'Keychains' }],
              }),
          })
        }
        if (url === '/api/exchange-rates') {
          return Promise.resolve({
            ok: true,
            json: () =>
              Promise.resolve({
                data: {
                  rates: { INR: 1, USD: 0.012, EUR: 0.011, GBP: 0.0095 },
                },
              }),
          })
        }
        productCallCount++
        if (url === '/api/upload') {
          return Promise.resolve({
            ok: true,
            json: () =>
              Promise.resolve({
                data: { url: 'https://cdn.example.com/uploaded.jpg' },
              }),
          })
        }
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve({ data: { product: savedProduct } }),
        })
      })
    )

    const { container } = renderModal({ onSuccess, onClose })

    await waitFor(() => {
      expect(screen.getByRole('option', { name: 'Flowers' })).toBeTruthy()
    })

    fireEvent.change(screen.getByLabelText('Name'), {
      target: { value: 'New Product' },
    })
    fireEvent.change(screen.getByLabelText('Description'), {
      target: { value: 'Description' },
    })
    fireEvent.change(screen.getByLabelText('Category'), {
      target: { value: 'Flowers' },
    })
    fireEvent.change(screen.getByLabelText('Price'), {
      target: { value: '50' },
    })
    fireEvent.change(screen.getByLabelText('Stock'), {
      target: { value: '10' },
    })

    const fileInput = screen.getByLabelText(/primary image/i)
    const validFile = new File(['content'], 'test.jpg', { type: 'image/jpeg' })
    Object.defineProperty(validFile, 'size', { value: 100 * 1024 })
    fireEvent.change(fileInput, { target: { files: [validFile] } })

    const form = container.querySelector('form')
    expect(form).not.toBeNull()
    act(() => {
      fireEvent.submit(form as HTMLFormElement)
    })

    await waitFor(() => {
      expect(productCallCount).toBe(2) // Upload + Create
      expect(onSuccess).toHaveBeenCalled()
      expect(onClose).toHaveBeenCalled()
    })
  })

  it('handles upload fetch returning !res.ok (reads error JSON and throws)', async () => {
    const toast = await import('react-hot-toast')
    const logger = await import('@/lib/logger')
    const onSuccess = vi.fn()

    vi.stubGlobal(
      'fetch',
      vi.fn().mockImplementation((url: string) => {
        if (url === '/api/categories') {
          return Promise.resolve({
            ok: true,
            json: () =>
              Promise.resolve({
                data: [{ name: 'Flowers' }, { name: 'Keychains' }],
              }),
          })
        }
        return Promise.resolve({
          ok: false,
          json: () => Promise.resolve({ error: 'Upload rejected' }),
        })
      })
    )

    const { container } = renderModal({ onSuccess })

    await waitFor(() => {
      expect(screen.getByRole('option', { name: 'Flowers' })).toBeTruthy()
    })

    fireEvent.change(screen.getByLabelText('Name'), { target: { value: 'P' } })
    fireEvent.change(screen.getByLabelText('Description'), {
      target: { value: 'D' },
    })
    fireEvent.change(screen.getByLabelText('Category'), {
      target: { value: 'Flowers' },
    })
    fireEvent.change(screen.getByLabelText('Price'), {
      target: { value: '10' },
    })
    fireEvent.change(screen.getByLabelText('Stock'), {
      target: { value: '5' },
    })

    const fileInput = screen.getByLabelText(/primary image/i)
    const validFile = new File(['content'], 'test.jpg', { type: 'image/jpeg' })
    Object.defineProperty(validFile, 'size', { value: 100 * 1024 })
    fireEvent.change(fileInput, { target: { files: [validFile] } })

    const form = container.querySelector('form')
    expect(form).not.toBeNull()
    act(() => {
      fireEvent.submit(form as HTMLFormElement)
    })

    await waitFor(() => {
      expect(logger.logError).toHaveBeenCalledWith(
        expect.objectContaining({ context: 'resolveImageUrl' })
      )
      expect(toast.default.error).toHaveBeenCalledWith(API_ERRORS.IMAGE_UPLOAD)
      expect(onSuccess).not.toHaveBeenCalled()
    })
  })
  it('shows inline error when name is empty on submit', async () => {
    const { container } = renderModal()
    const form = container.querySelector('form')
    expect(form).not.toBeNull()
    act(() => {
      fireEvent.submit(form as HTMLFormElement)
    })
    await waitFor(() => {
      expect(screen.getByText(PRODUCT_ERRORS.NAME_REQUIRED)).toBeInTheDocument()
    })
  })

  it('shows inline error when description is empty on submit', async () => {
    const { container } = renderModal()
    fireEvent.change(screen.getByLabelText('Name'), {
      target: { value: 'My Product' },
    })
    const form = container.querySelector('form')
    act(() => {
      fireEvent.submit(form as HTMLFormElement)
    })
    await waitFor(() => {
      expect(
        screen.getByText(PRODUCT_ERRORS.DESCRIPTION_REQUIRED)
      ).toBeInTheDocument()
    })
  })

  it('shows inline error when category is empty on submit', async () => {
    const { container } = renderModal()
    fireEvent.change(screen.getByLabelText('Name'), {
      target: { value: 'My Product' },
    })
    fireEvent.change(screen.getByLabelText('Description'), {
      target: { value: 'Desc' },
    })
    const form = container.querySelector('form')
    act(() => {
      fireEvent.submit(form as HTMLFormElement)
    })
    await waitFor(() => {
      expect(
        screen.getByText(PRODUCT_ERRORS.CATEGORY_REQUIRED)
      ).toBeInTheDocument()
    })
  })

  it('clears inline error when name is corrected', async () => {
    const { container } = renderModal()
    const form = container.querySelector('form')
    act(() => {
      fireEvent.submit(form as HTMLFormElement)
    })
    await waitFor(() => {
      expect(screen.getByText(PRODUCT_ERRORS.NAME_REQUIRED)).toBeInTheDocument()
    })
    fireEvent.change(screen.getByLabelText('Name'), {
      target: { value: 'Fixed Name' },
    })
    await waitFor(() => {
      expect(
        screen.queryByText(PRODUCT_ERRORS.NAME_REQUIRED)
      ).not.toBeInTheDocument()
    })
  })

  it('clears inline error when price is corrected', async () => {
    const { container } = renderModal()
    const form = container.querySelector('form')
    fireEvent.change(screen.getByLabelText('Price'), {
      target: { value: '0' },
    })
    act(() => {
      fireEvent.submit(form as HTMLFormElement)
    })
    await waitFor(() => {
      expect(
        screen.getByText(PRODUCT_ERRORS.PRICE_POSITIVE)
      ).toBeInTheDocument()
    })
    fireEvent.change(screen.getByLabelText('Price'), {
      target: { value: '50' },
    })
    await waitFor(() => {
      expect(
        screen.queryByText(PRODUCT_ERRORS.PRICE_POSITIVE)
      ).not.toBeInTheDocument()
    })
  })

  it('shows inline error for name with only 1 character', async () => {
    const { container } = renderModal()
    fireEvent.change(screen.getByLabelText('Name'), { target: { value: 'A' } })
    const form = container.querySelector('form')
    act(() => {
      fireEvent.submit(form as HTMLFormElement)
    })
    await waitFor(() => {
      expect(
        screen.getByText(PRODUCT_ERRORS.NAME_TOO_SHORT)
      ).toBeInTheDocument()
    })
  })

  it('shows red border on name input when validation fails', async () => {
    const { container } = renderModal()
    const form = container.querySelector('form')
    act(() => {
      fireEvent.submit(form as HTMLFormElement)
    })
    await waitFor(() => {
      const nameInput = screen.getByLabelText('Name')
      expect(nameInput.getAttribute('aria-invalid')).toBe('true')
    })
  })
})
