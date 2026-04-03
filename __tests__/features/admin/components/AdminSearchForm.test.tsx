import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { AdminSearchForm } from '@/features/admin/components/AdminSearchForm'

describe('AdminSearchForm', () => {
  const defaultProps = {
    searchInput: '',
    setSearchInput: vi.fn(),
    search: '',
    onSearch: vi.fn(),
    onClear: vi.fn(),
  }

  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('renders the search input with default placeholder', () => {
    render(<AdminSearchForm {...defaultProps} />)
    expect(screen.getByPlaceholderText('Search\u2026')).toBeInTheDocument()
  })

  it('renders with custom placeholder and aria-label', () => {
    render(
      <AdminSearchForm
        {...defaultProps}
        placeholder="Find products"
        ariaLabel="Product search"
      />
    )
    expect(screen.getByPlaceholderText('Find products')).toBeInTheDocument()
    expect(screen.getByLabelText('Product search')).toBeInTheDocument()
  })

  it('renders the Search submit button', () => {
    render(<AdminSearchForm {...defaultProps} />)
    expect(screen.getByRole('button', { name: 'Search' })).toBeInTheDocument()
  })

  it('does not render Clear button when search is empty', () => {
    render(<AdminSearchForm {...defaultProps} />)
    expect(screen.queryByRole('button', { name: 'Clear' })).toBeNull()
  })

  it('renders Clear button when search has a value', () => {
    render(<AdminSearchForm {...defaultProps} search="test" />)
    expect(screen.getByRole('button', { name: 'Clear' })).toBeInTheDocument()
  })

  it('shows results text when search has a value', () => {
    render(<AdminSearchForm {...defaultProps} search="shoes" />)
    expect(screen.getByText('shoes')).toBeInTheDocument()
    expect(screen.getByText(/showing results for/i)).toBeInTheDocument()
  })

  it('calls setSearchInput when input changes', () => {
    render(<AdminSearchForm {...defaultProps} />)
    fireEvent.change(screen.getByLabelText('Search'), {
      target: { value: 'new' },
    })
    expect(defaultProps.setSearchInput).toHaveBeenCalledWith('new')
  })

  it('calls onSearch on form submit', () => {
    render(<AdminSearchForm {...defaultProps} />)
    fireEvent.submit(screen.getByRole('button', { name: 'Search' }))
    expect(defaultProps.onSearch).toHaveBeenCalledTimes(1)
  })

  it('calls onClear when Clear button is clicked', () => {
    render(<AdminSearchForm {...defaultProps} search="test" />)
    fireEvent.click(screen.getByRole('button', { name: 'Clear' }))
    expect(defaultProps.onClear).toHaveBeenCalledTimes(1)
  })

  it('displays the current searchInput value', () => {
    render(<AdminSearchForm {...defaultProps} searchInput="current" />)
    expect(screen.getByDisplayValue('current')).toBeInTheDocument()
  })
})
