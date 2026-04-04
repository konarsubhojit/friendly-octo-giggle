import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import React from 'react'
import userEvent from '@testing-library/user-event'

const {
  mockPush,
  mockFormatPrice,
  mockFetch,
} = vi.hoisted(() => ({
  mockPush: vi.fn(),
  mockFormatPrice: vi.fn((price: number) => `$${price.toFixed(2)}`),
  mockFetch: vi.fn(),
}))

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: mockPush }),
}))

vi.mock('next/image', () => ({
  default: ({ alt, src }: { alt: string; src: string }) => (
    <img alt={alt} src={src} />
  ),
}))

vi.mock('@/contexts/CurrencyContext', () => ({
  useCurrency: () => ({ formatPrice: mockFormatPrice }),
}))

vi.stubGlobal('fetch', mockFetch)

import ProductSearch from '@/features/product/components/ProductSearch'

describe('ProductSearch', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.useFakeTimers()
    // Create portal container
    const portalRoot = document.createElement('div')
    portalRoot.setAttribute('id', 'portal-root')
    document.body.appendChild(portalRoot)
  })

  afterEach(() => {
    vi.runOnlyPendingTimers()
    vi.useRealTimers()
    document.body.innerHTML = ''
  })

  it('renders search button with keyboard shortcut', () => {
    render(<ProductSearch />)
    expect(screen.getByLabelText('Search products')).toBeInTheDocument()
    expect(screen.getByText('Search products...')).toBeInTheDocument()
    expect(screen.getByText('⌘K')).toBeInTheDocument()
  })

  it('opens dialog when button is clicked', () => {
    render(<ProductSearch />)
    const button = screen.getByLabelText('Search products')
    fireEvent.click(button)

    expect(screen.getByRole('search')).toBeInTheDocument()
    expect(
      screen.getByPlaceholderText('Search products by name, category...')
    ).toBeInTheDocument()
  })

  it('shows initial empty state message', () => {
    render(<ProductSearch />)
    const button = screen.getByLabelText('Search products')
    fireEvent.click(button)

    expect(
      screen.getByText('Start typing to search products...')
    ).toBeInTheDocument()
  })

  it('closes dialog when ESC button is clicked', () => {
    render(<ProductSearch />)
    const openButton = screen.getByLabelText('Search products')
    fireEvent.click(openButton)

    expect(screen.getByRole('search')).toBeInTheDocument()

    const closeButton = screen.getByRole('button', { name: 'Close search' })
    fireEvent.click(closeButton)

    expect(screen.queryByRole('search')).not.toBeInTheDocument()
  })

  it('closes dialog when backdrop is clicked', () => {
    render(<ProductSearch />)
    const button = screen.getByLabelText('Search products')
    fireEvent.click(button)

    const backdrop = screen.getAllByLabelText('Close search')[0]
    fireEvent.click(backdrop)

    expect(screen.queryByRole('search')).not.toBeInTheDocument()
  })

  it('closes dialog on Escape key press', async () => {
    render(<ProductSearch />)
    const button = screen.getByLabelText('Search products')
    fireEvent.click(button)

    expect(screen.getByRole('search')).toBeInTheDocument()

    fireEvent.keyDown(document, { key: 'Escape' })

    await waitFor(() => {
      expect(screen.queryByRole('search')).not.toBeInTheDocument()
    })
  })

  it('opens/toggles dialog with Cmd+K', async () => {
    render(<ProductSearch />)

    fireEvent.keyDown(document, { key: 'k', metaKey: true })

    await waitFor(() => {
      expect(screen.getByRole('search')).toBeInTheDocument()
    })

    fireEvent.keyDown(document, { key: 'k', metaKey: true })

    await waitFor(() => {
      expect(screen.queryByRole('search')).not.toBeInTheDocument()
    })
  })

  it('opens/toggles dialog with Ctrl+K', async () => {
    render(<ProductSearch />)

    fireEvent.keyDown(document, { key: 'k', ctrlKey: true })

    await waitFor(() => {
      expect(screen.getByRole('search')).toBeInTheDocument()
    })
  })

  it('shows loading state while searching', async () => {
    mockFetch.mockImplementation(
      () =>
        new Promise((resolve) => {
          setTimeout(() => resolve({ ok: true, json: async () => ({}) }), 500)
        })
    )

    render(<ProductSearch />)
    const button = screen.getByLabelText('Search products')
    fireEvent.click(button)

    const input = screen.getByPlaceholderText(
      'Search products by name, category...'
    )
    fireEvent.change(input, { target: { value: 'test' } })

    // Fast-forward past debounce
    vi.advanceTimersByTime(250)

    await waitFor(() => {
      expect(screen.getByText('Searching...')).toBeInTheDocument()
    })
  })

  it('displays search results', async () => {
    const mockResults = [
      {
        id: 'prod1',
        name: 'Test Product',
        description: 'A test product',
        price: 99.99,
        image: 'https://example.com/image.jpg',
        category: 'Electronics',
      },
    ]

    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => ({ results: mockResults }),
    })

    render(<ProductSearch />)
    const button = screen.getByLabelText('Search products')
    fireEvent.click(button)

    const input = screen.getByPlaceholderText(
      'Search products by name, category...'
    )
    fireEvent.change(input, { target: { value: 'test' } })

    vi.advanceTimersByTime(250)

    await waitFor(() => {
      expect(screen.getByText('Test Product')).toBeInTheDocument()
      expect(screen.getByText('Electronics')).toBeInTheDocument()
      expect(screen.getByText('$99.99')).toBeInTheDocument()
    })
  })

  it('shows no results message when search returns empty', async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => ({ results: [] }),
    })

    render(<ProductSearch />)
    const button = screen.getByLabelText('Search products')
    fireEvent.click(button)

    const input = screen.getByPlaceholderText(
      'Search products by name, category...'
    )
    fireEvent.change(input, { target: { value: 'nonexistent' } })

    vi.advanceTimersByTime(250)

    await waitFor(() => {
      expect(
        screen.getByText(/No products found for "nonexistent"/)
      ).toBeInTheDocument()
    })
  })

  it('handles search API errors gracefully', async () => {
    mockFetch.mockRejectedValue(new Error('API Error'))

    render(<ProductSearch />)
    const button = screen.getByLabelText('Search products')
    fireEvent.click(button)

    const input = screen.getByPlaceholderText(
      'Search products by name, category...'
    )
    fireEvent.change(input, { target: { value: 'test' } })

    vi.advanceTimersByTime(250)

    await waitFor(() => {
      expect(screen.getByText(/No products found/)).toBeInTheDocument()
    })
  })

  it('debounces search requests', async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => ({ results: [] }),
    })

    render(<ProductSearch />)
    const button = screen.getByLabelText('Search products')
    fireEvent.click(button)

    const input = screen.getByPlaceholderText(
      'Search products by name, category...'
    )

    fireEvent.change(input, { target: { value: 't' } })
    vi.advanceTimersByTime(100)
    fireEvent.change(input, { target: { value: 'te' } })
    vi.advanceTimersByTime(100)
    fireEvent.change(input, { target: { value: 'tes' } })
    vi.advanceTimersByTime(100)
    fireEvent.change(input, { target: { value: 'test' } })
    vi.advanceTimersByTime(250)

    await waitFor(() => {
      expect(mockFetch).toHaveBeenCalledTimes(1)
    })
  })

  it('navigates with keyboard arrow down', async () => {
    const mockResults = [
      {
        id: 'prod1',
        name: 'Product 1',
        price: 10,
        image: '',
        category: 'Cat1',
        description: '',
      },
      {
        id: 'prod2',
        name: 'Product 2',
        price: 20,
        image: '',
        category: 'Cat2',
        description: '',
      },
    ]

    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => ({ results: mockResults }),
    })

    render(<ProductSearch />)
    const button = screen.getByLabelText('Search products')
    fireEvent.click(button)

    const input = screen.getByPlaceholderText(
      'Search products by name, category...'
    )
    fireEvent.change(input, { target: { value: 'prod' } })
    vi.advanceTimersByTime(250)

    await waitFor(() => {
      expect(screen.getByText('Product 1')).toBeInTheDocument()
    })

    fireEvent.keyDown(input, { key: 'ArrowDown' })
    // First item should be highlighted (index 0)

    fireEvent.keyDown(input, { key: 'ArrowDown' })
    // Second item should be highlighted (index 1)
  })

  it('navigates with keyboard arrow up', async () => {
    const mockResults = [
      {
        id: 'prod1',
        name: 'Product 1',
        price: 10,
        image: '',
        category: 'Cat1',
        description: '',
      },
      {
        id: 'prod2',
        name: 'Product 2',
        price: 20,
        image: '',
        category: 'Cat2',
        description: '',
      },
    ]

    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => ({ results: mockResults }),
    })

    render(<ProductSearch />)
    const button = screen.getByLabelText('Search products')
    fireEvent.click(button)

    const input = screen.getByPlaceholderText(
      'Search products by name, category...'
    )
    fireEvent.change(input, { target: { value: 'prod' } })
    vi.advanceTimersByTime(250)

    await waitFor(() => {
      expect(screen.getByText('Product 1')).toBeInTheDocument()
    })

    fireEvent.keyDown(input, { key: 'ArrowUp' })
    // Should wrap to last item (index 1)
  })

  it('navigates to product on Enter key', async () => {
    const mockResults = [
      {
        id: 'prod1',
        name: 'Product 1',
        price: 10,
        image: '',
        category: 'Cat1',
        description: '',
      },
    ]

    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => ({ results: mockResults }),
    })

    render(<ProductSearch />)
    const button = screen.getByLabelText('Search products')
    fireEvent.click(button)

    const input = screen.getByPlaceholderText(
      'Search products by name, category...'
    )
    fireEvent.change(input, { target: { value: 'prod' } })
    vi.advanceTimersByTime(250)

    await waitFor(() => {
      expect(screen.getByText('Product 1')).toBeInTheDocument()
    })

    fireEvent.keyDown(input, { key: 'ArrowDown' })
    fireEvent.keyDown(input, { key: 'Enter' })

    await waitFor(() => {
      expect(mockPush).toHaveBeenCalledWith('/products/prod1')
    })
  })

  it('navigates to product on click', async () => {
    const mockResults = [
      {
        id: 'prod1',
        name: 'Product 1',
        price: 10,
        image: '',
        category: 'Cat1',
        description: '',
      },
    ]

    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => ({ results: mockResults }),
    })

    render(<ProductSearch />)
    const button = screen.getByLabelText('Search products')
    fireEvent.click(button)

    const input = screen.getByPlaceholderText(
      'Search products by name, category...'
    )
    fireEvent.change(input, { target: { value: 'prod' } })
    vi.advanceTimersByTime(250)

    await waitFor(() => {
      expect(screen.getByText('Product 1')).toBeInTheDocument()
    })

    const productButton = screen.getByText('Product 1').closest('button')!
    fireEvent.click(productButton)

    expect(mockPush).toHaveBeenCalledWith('/products/prod1')
  })

  it('calls onNavigate callback when navigating', async () => {
    const mockOnNavigate = vi.fn()
    const mockResults = [
      {
        id: 'prod1',
        name: 'Product 1',
        price: 10,
        image: '',
        category: 'Cat1',
        description: '',
      },
    ]

    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => ({ results: mockResults }),
    })

    render(<ProductSearch onNavigate={mockOnNavigate} />)
    const button = screen.getByLabelText('Search products')
    fireEvent.click(button)

    const input = screen.getByPlaceholderText(
      'Search products by name, category...'
    )
    fireEvent.change(input, { target: { value: 'prod' } })
    vi.advanceTimersByTime(250)

    await waitFor(() => {
      expect(screen.getByText('Product 1')).toBeInTheDocument()
    })

    const productButton = screen.getByText('Product 1').closest('button')!
    fireEvent.click(productButton)

    expect(mockOnNavigate).toHaveBeenCalled()
  })

  it('displays keyboard navigation hints when results exist', async () => {
    const mockResults = [
      {
        id: 'prod1',
        name: 'Product 1',
        price: 10,
        image: '',
        category: 'Cat1',
        description: '',
      },
    ]

    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => ({ results: mockResults }),
    })

    render(<ProductSearch />)
    const button = screen.getByLabelText('Search products')
    fireEvent.click(button)

    const input = screen.getByPlaceholderText(
      'Search products by name, category...'
    )
    fireEvent.change(input, { target: { value: 'prod' } })
    vi.advanceTimersByTime(250)

    await waitFor(() => {
      expect(screen.getByText('navigate')).toBeInTheDocument()
      expect(screen.getByText('select')).toBeInTheDocument()
      expect(screen.getByText('close')).toBeInTheDocument()
    })
  })

  it('highlights matching text in results', async () => {
    const mockResults = [
      {
        id: 'prod1',
        name: 'Test Product',
        price: 10,
        image: '',
        category: 'Electronics',
        description: '',
      },
    ]

    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => ({ results: mockResults }),
    })

    render(<ProductSearch />)
    const button = screen.getByLabelText('Search products')
    fireEvent.click(button)

    const input = screen.getByPlaceholderText(
      'Search products by name, category...'
    )
    fireEvent.change(input, { target: { value: 'test' } })
    vi.advanceTimersByTime(250)

    await waitFor(() => {
      const marks = screen.getAllByText('Test')
      expect(marks.length).toBeGreaterThan(0)
    })
  })

  it('renders product image when available', async () => {
    const mockResults = [
      {
        id: 'prod1',
        name: 'Product 1',
        price: 10,
        image: 'https://example.com/image.jpg',
        category: 'Cat1',
        description: '',
      },
    ]

    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => ({ results: mockResults }),
    })

    render(<ProductSearch />)
    const button = screen.getByLabelText('Search products')
    fireEvent.click(button)

    const input = screen.getByPlaceholderText(
      'Search products by name, category...'
    )
    fireEvent.change(input, { target: { value: 'prod' } })
    vi.advanceTimersByTime(250)

    await waitFor(() => {
      const img = screen.getByAltText('')
      expect(img).toHaveAttribute('src', 'https://example.com/image.jpg')
    })
  })

  it('renders initial when no image', async () => {
    const mockResults = [
      {
        id: 'prod1',
        name: 'Product 1',
        price: 10,
        image: '',
        category: 'Electronics',
        description: '',
      },
    ]

    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => ({ results: mockResults }),
    })

    render(<ProductSearch />)
    const button = screen.getByLabelText('Search products')
    fireEvent.click(button)

    const input = screen.getByPlaceholderText(
      'Search products by name, category...'
    )
    fireEvent.change(input, { target: { value: 'prod' } })
    vi.advanceTimersByTime(250)

    await waitFor(() => {
      expect(screen.getByText('P')).toBeInTheDocument()
    })
  })

  it('clears results when query is cleared', async () => {
    const mockResults = [
      {
        id: 'prod1',
        name: 'Product 1',
        price: 10,
        image: '',
        category: 'Cat1',
        description: '',
      },
    ]

    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => ({ results: mockResults }),
    })

    render(<ProductSearch />)
    const button = screen.getByLabelText('Search products')
    fireEvent.click(button)

    const input = screen.getByPlaceholderText(
      'Search products by name, category...'
    )
    fireEvent.change(input, { target: { value: 'prod' } })
    vi.advanceTimersByTime(250)

    await waitFor(() => {
      expect(screen.getByText('Product 1')).toBeInTheDocument()
    })

    fireEvent.change(input, { target: { value: '' } })

    await waitFor(() => {
      expect(screen.queryByText('Product 1')).not.toBeInTheDocument()
      expect(
        screen.getByText('Start typing to search products...')
      ).toBeInTheDocument()
    })
  })

  it('handles SearchResultHit format from API', async () => {
    const mockResults = [
      {
        id: 'prod1',
        content: {
          name: 'Hit Product',
          price: 50,
          category: 'Test',
          description: 'A hit product',
        },
        metadata: {
          image: 'https://example.com/hit.jpg',
        },
      },
    ]

    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => ({ data: { results: mockResults } }),
    })

    render(<ProductSearch />)
    const button = screen.getByLabelText('Search products')
    fireEvent.click(button)

    const input = screen.getByPlaceholderText(
      'Search products by name, category...'
    )
    fireEvent.change(input, { target: { value: 'hit' } })
    vi.advanceTimersByTime(250)

    await waitFor(() => {
      expect(screen.getByText('Hit Product')).toBeInTheDocument()
      expect(screen.getByText('$50.00')).toBeInTheDocument()
    })
  })

  it('filters out invalid results with missing name or price', async () => {
    const mockResults = [
      {
        id: 'prod1',
        name: 'Valid Product',
        price: 10,
        image: '',
        category: 'Cat1',
        description: '',
      },
      {
        id: 'prod2',
        name: '',
        price: 20,
        image: '',
        category: 'Cat2',
        description: '',
      },
      {
        id: 'prod3',
        name: 'Another Valid',
        price: NaN,
        image: '',
        category: 'Cat3',
        description: '',
      },
    ]

    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => ({ results: mockResults }),
    })

    render(<ProductSearch />)
    const button = screen.getByLabelText('Search products')
    fireEvent.click(button)

    const input = screen.getByPlaceholderText(
      'Search products by name, category...'
    )
    fireEvent.change(input, { target: { value: 'prod' } })
    vi.advanceTimersByTime(250)

    await waitFor(() => {
      expect(screen.getByText('Valid Product')).toBeInTheDocument()
      expect(screen.queryByText('Another Valid')).not.toBeInTheDocument()
    })
  })
})
