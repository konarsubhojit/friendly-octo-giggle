// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import React from 'react'

const { mockPush, mockFormatPrice, mockFetch } = vi.hoisted(() => ({
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

    const closeButton = screen.getAllByRole('button', {
      name: 'Close search',
    })[1]
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
})
