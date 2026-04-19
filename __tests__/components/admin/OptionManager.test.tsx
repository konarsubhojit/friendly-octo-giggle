// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import React from 'react'
import OptionManager from '@/features/admin/components/OptionManager'
import type { ProductOption, ProductVariant } from '@/lib/types'

vi.mock('react-hot-toast', () => ({
  default: {
    success: vi.fn(),
    error: vi.fn(),
  },
}))

import toast from 'react-hot-toast'

const mockOption: ProductOption = {
  id: 'o1',
  productId: 'p1',
  name: 'Color',
  sortOrder: 0,
  createdAt: '2025-01-01T00:00:00.000Z',
  values: [
    {
      id: 'v1',
      optionId: 'o1',
      value: 'Red',
      sortOrder: 0,
      createdAt: '2025-01-01T00:00:00.000Z',
    },
    {
      id: 'v2',
      optionId: 'o1',
      value: 'Blue',
      sortOrder: 1,
      createdAt: '2025-01-01T00:00:00.000Z',
    },
  ],
}

const mockVariants: ProductVariant[] = [
  {
    id: 'var1',
    productId: 'p1',
    sku: 'Red-L',
    price: 100,
    stock: 10,
    image: null,
    images: [],
    deletedAt: null,
    createdAt: '2025-01-01T00:00:00.000Z',
    updatedAt: '2025-01-01T00:00:00.000Z',
  },
  {
    id: 'var2',
    productId: 'p1',
    sku: 'Red-XL',
    price: 100,
    stock: 5,
    image: null,
    images: [],
    deletedAt: null,
    createdAt: '2025-01-01T00:00:00.000Z',
    updatedAt: '2025-01-01T00:00:00.000Z',
  },
]

describe('OptionManager', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.stubGlobal('fetch', vi.fn())
  })

  it('renders heading and description', () => {
    render(
      <OptionManager
        productId="p1"
        initialOptions={[]}
        variants={mockVariants}
      />
    )
    expect(screen.getByText('Product Options')).toBeInTheDocument()
    expect(screen.getByText(/Define option dimensions/)).toBeInTheDocument()
  })

  it('renders existing options with values', () => {
    render(
      <OptionManager
        productId="p1"
        initialOptions={[mockOption]}
        variants={mockVariants}
      />
    )
    expect(screen.getByText('Color')).toBeInTheDocument()
    expect(screen.getByText('Red')).toBeInTheDocument()
    expect(screen.getByText('Blue')).toBeInTheDocument()
  })

  it('renders the generate form inputs', () => {
    render(
      <OptionManager
        productId="p1"
        initialOptions={[]}
        variants={mockVariants}
      />
    )
    expect(
      screen.getByLabelText('Option Names (comma-separated)')
    ).toBeInTheDocument()
    expect(screen.getByLabelText('Delimiter')).toBeInTheDocument()
    expect(
      screen.getByRole('button', { name: 'Generate Options' })
    ).toBeInTheDocument()
  })

  it('shows warning when no variants', () => {
    render(<OptionManager productId="p1" initialOptions={[]} variants={[]} />)
    expect(screen.getByText(/No variants found/)).toBeInTheDocument()
  })

  it('shows live SKU preview when option names are entered', () => {
    render(
      <OptionManager
        productId="p1"
        initialOptions={[]}
        variants={mockVariants}
      />
    )

    const input = screen.getByLabelText('Option Names (comma-separated)')
    fireEvent.change(input, { target: { value: 'Color, Size' } })

    // Should show SKU preview table with variant SKUs in monospace cells
    const skuCells = screen.getAllByText('Red-L')
    expect(skuCells.length).toBeGreaterThanOrEqual(1)
    const skuCells2 = screen.getAllByText('Red-XL')
    expect(skuCells2.length).toBeGreaterThanOrEqual(1)
    // Preview parsed values - Red appears in both rows
    expect(screen.getAllByText('Red')).toHaveLength(2)
  })

  it('shows error in preview when SKU segment count mismatches', () => {
    const variantsWithBadSku: ProductVariant[] = [
      {
        id: 'var3',
        productId: 'p1',
        sku: 'Red-L-Cotton',
        price: 100,
        stock: 10,
        image: null,
        images: [],
        deletedAt: null,
        createdAt: '2025-01-01T00:00:00.000Z',
        updatedAt: '2025-01-01T00:00:00.000Z',
      },
    ]

    render(
      <OptionManager
        productId="p1"
        initialOptions={[]}
        variants={variantsWithBadSku}
      />
    )

    const input = screen.getByLabelText('Option Names (comma-separated)')
    fireEvent.change(input, { target: { value: 'Color, Size' } })

    expect(screen.getByText(/Splits into 3 parts/)).toBeInTheDocument()
  })

  it('shows "No SKU" in preview when variant has no sku', () => {
    const variantsNoSku: ProductVariant[] = [
      {
        id: 'var4',
        productId: 'p1',
        sku: null,
        price: 100,
        stock: 10,
        image: null,
        images: [],
        deletedAt: null,
        createdAt: '2025-01-01T00:00:00.000Z',
        updatedAt: '2025-01-01T00:00:00.000Z',
      },
    ]

    render(
      <OptionManager
        productId="p1"
        initialOptions={[]}
        variants={variantsNoSku}
      />
    )

    const input = screen.getByLabelText('Option Names (comma-separated)')
    fireEvent.change(input, { target: { value: 'Color' } })

    expect(screen.getByText('No SKU')).toBeInTheDocument()
  })

  it('does not show preview when no option names entered', () => {
    render(
      <OptionManager
        productId="p1"
        initialOptions={[]}
        variants={mockVariants}
      />
    )
    // No table should be visible
    expect(screen.queryByText('Red-L')).not.toBeInTheDocument()
  })

  it('changes delimiter and updates preview', () => {
    const underscoreVariants: ProductVariant[] = [
      {
        id: 'var5',
        productId: 'p1',
        sku: 'Red_L',
        price: 100,
        stock: 10,
        image: null,
        images: [],
        deletedAt: null,
        createdAt: '2025-01-01T00:00:00.000Z',
        updatedAt: '2025-01-01T00:00:00.000Z',
      },
    ]

    render(
      <OptionManager
        productId="p1"
        initialOptions={[]}
        variants={underscoreVariants}
      />
    )

    const delimiterInput = screen.getByLabelText('Delimiter')
    fireEvent.change(delimiterInput, { target: { value: '_' } })

    const nameInput = screen.getByLabelText('Option Names (comma-separated)')
    fireEvent.change(nameInput, { target: { value: 'Color, Size' } })

    // With underscore delimiter, Red_L should split into Red and L
    expect(screen.getByText('Red')).toBeInTheDocument()
    expect(screen.getByText('L')).toBeInTheDocument()
  })

  it('calls generate API and updates options on success', async () => {
    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      json: () =>
        Promise.resolve({
          data: {
            options: [
              {
                id: 'o2',
                productId: 'p1',
                name: 'Color',
                sortOrder: 0,
                createdAt: '2025-01-01T00:00:00.000Z',
                values: [
                  {
                    id: 'ov1',
                    optionId: 'o2',
                    value: 'Red',
                    sortOrder: 0,
                    createdAt: '2025-01-01T00:00:00.000Z',
                  },
                ],
              },
            ],
            variantsLinked: 2,
          },
        }),
    })
    vi.stubGlobal('fetch', mockFetch)

    render(
      <OptionManager
        productId="p1"
        initialOptions={[]}
        variants={mockVariants}
      />
    )

    const input = screen.getByLabelText('Option Names (comma-separated)')
    fireEvent.change(input, { target: { value: 'Color, Size' } })

    const btn = screen.getByRole('button', { name: 'Generate Options' })
    fireEvent.click(btn)

    await waitFor(() => {
      expect(mockFetch).toHaveBeenCalledWith(
        '/api/admin/products/p1/options/generate',
        expect.objectContaining({ method: 'POST' })
      )
    })

    await waitFor(() => {
      expect(vi.mocked(toast.success)).toHaveBeenCalled()
    })
  })

  it('shows error toast when generate API fails', async () => {
    const mockFetch = vi.fn().mockResolvedValue({
      ok: false,
      json: () => Promise.resolve({ error: 'SKU mismatch' }),
    })
    vi.stubGlobal('fetch', mockFetch)

    render(
      <OptionManager
        productId="p1"
        initialOptions={[]}
        variants={mockVariants}
      />
    )

    const input = screen.getByLabelText('Option Names (comma-separated)')
    fireEvent.change(input, { target: { value: 'Color' } })

    const btn = screen.getByRole('button', { name: 'Generate Options' })
    fireEvent.click(btn)

    await waitFor(() => {
      expect(vi.mocked(toast.error)).toHaveBeenCalledWith('SKU mismatch')
    })
  })

  it('shows error toast when generate API returns non-json error', async () => {
    const mockFetch = vi.fn().mockResolvedValue({
      ok: false,
      json: () => Promise.reject(new Error('parse error')),
    })
    vi.stubGlobal('fetch', mockFetch)

    render(
      <OptionManager
        productId="p1"
        initialOptions={[]}
        variants={mockVariants}
      />
    )

    const input = screen.getByLabelText('Option Names (comma-separated)')
    fireEvent.change(input, { target: { value: 'Color' } })

    fireEvent.click(screen.getByRole('button', { name: 'Generate Options' }))

    await waitFor(() => {
      expect(vi.mocked(toast.error)).toHaveBeenCalledWith(
        'Failed to generate options'
      )
    })
  })

  it('shows error toast when option names are empty on generate', async () => {
    render(
      <OptionManager
        productId="p1"
        initialOptions={[]}
        variants={mockVariants}
      />
    )

    // Button should be disabled when input is empty, but test the handler guard
    const input = screen.getByLabelText('Option Names (comma-separated)')
    fireEvent.change(input, { target: { value: '  ,  , ' } })

    // With only whitespace/commas, names array is empty after trim+filter
    const btn = screen.getByRole('button', { name: 'Generate Options' })
    fireEvent.click(btn)

    await waitFor(() => {
      expect(vi.mocked(toast.error)).toHaveBeenCalledWith(
        'Enter at least one option name (e.g. Color, Size)'
      )
    })
  })

  it('shows error toast when no variants and trying to generate', async () => {
    render(<OptionManager productId="p1" initialOptions={[]} variants={[]} />)

    const input = screen.getByLabelText('Option Names (comma-separated)')
    fireEvent.change(input, { target: { value: 'Color' } })

    const btn = screen.getByRole('button', { name: 'Generate Options' })
    fireEvent.click(btn)

    await waitFor(() => {
      expect(vi.mocked(toast.error)).toHaveBeenCalledWith(
        'Create variants with SKUs first, then generate options'
      )
    })
  })

  it('deletes an option successfully', async () => {
    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ data: { deleted: true } }),
    })
    vi.stubGlobal('fetch', mockFetch)

    render(
      <OptionManager
        productId="p1"
        initialOptions={[mockOption]}
        variants={mockVariants}
      />
    )

    expect(screen.getByText('Color')).toBeInTheDocument()

    const deleteBtn = screen.getByLabelText('Delete Color option')
    fireEvent.click(deleteBtn)

    await waitFor(() => {
      expect(mockFetch).toHaveBeenCalledWith(
        '/api/admin/products/p1/options/o1',
        expect.objectContaining({ method: 'DELETE' })
      )
    })

    await waitFor(() => {
      expect(vi.mocked(toast.success)).toHaveBeenCalledWith('Option deleted')
    })

    // Assert the deleted option is removed from the DOM
    await waitFor(() => {
      expect(screen.queryByText('Color')).not.toBeInTheDocument()
    })
  })

  it('shows error toast when delete fails', async () => {
    const mockFetch = vi.fn().mockResolvedValue({
      ok: false,
      json: () => Promise.resolve({ error: 'Cannot delete' }),
    })
    vi.stubGlobal('fetch', mockFetch)

    render(
      <OptionManager
        productId="p1"
        initialOptions={[mockOption]}
        variants={mockVariants}
      />
    )

    const deleteBtn = screen.getByLabelText('Delete Color option')
    fireEvent.click(deleteBtn)

    await waitFor(() => {
      expect(vi.mocked(toast.error)).toHaveBeenCalledWith('Cannot delete')
    })
  })

  it('shows error toast when delete returns non-json error', async () => {
    const mockFetch = vi.fn().mockResolvedValue({
      ok: false,
      json: () => Promise.reject(new Error('parse')),
    })
    vi.stubGlobal('fetch', mockFetch)

    render(
      <OptionManager
        productId="p1"
        initialOptions={[mockOption]}
        variants={mockVariants}
      />
    )

    const deleteBtn = screen.getByLabelText('Delete Color option')
    fireEvent.click(deleteBtn)

    await waitFor(() => {
      expect(vi.mocked(toast.error)).toHaveBeenCalledWith(
        'Failed to delete option'
      )
    })
  })

  it('disables generate button when input is empty', () => {
    render(
      <OptionManager
        productId="p1"
        initialOptions={[]}
        variants={mockVariants}
      />
    )
    const btn = screen.getByRole('button', { name: 'Generate Options' })
    expect(btn).toBeDisabled()
  })

  it('handles fetch throwing an exception during generate', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockRejectedValue(new Error('Network error'))
    )

    render(
      <OptionManager
        productId="p1"
        initialOptions={[]}
        variants={mockVariants}
      />
    )

    const input = screen.getByLabelText('Option Names (comma-separated)')
    fireEvent.change(input, { target: { value: 'Color' } })

    fireEvent.click(screen.getByRole('button', { name: 'Generate Options' }))

    await waitFor(() => {
      expect(vi.mocked(toast.error)).toHaveBeenCalledWith('Network error')
    })
  })

  it('handles fetch throwing a non-Error during delete', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue('string error'))

    render(
      <OptionManager
        productId="p1"
        initialOptions={[mockOption]}
        variants={mockVariants}
      />
    )

    fireEvent.click(screen.getByLabelText('Delete Color option'))

    await waitFor(() => {
      expect(vi.mocked(toast.error)).toHaveBeenCalledWith('Failed to delete')
    })
  })
})
