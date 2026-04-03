import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { CursorPaginationBar } from '@/components/ui/CursorPaginationBar'

const defaultProps = {
  currentPage: 1,
  totalCount: 50,
  pageSize: 10,
  hasMore: true,
  loading: false,
  totalPages: 5,
  onFirst: vi.fn(),
  onPrev: vi.fn(),
  onNext: vi.fn(),
  onLast: vi.fn(),
  onPageSelect: vi.fn(),
}

describe('CursorPaginationBar', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('displays showing range text', () => {
    render(<CursorPaginationBar {...defaultProps} />)
    expect(screen.getByText('Showing 1-10 of 50')).toBeInTheDocument()
  })

  it('displays correct range for page 2', () => {
    render(<CursorPaginationBar {...defaultProps} currentPage={2} />)
    expect(screen.getByText('Showing 11-20 of 50')).toBeInTheDocument()
  })

  it('displays 0-0 when totalCount is 0', () => {
    render(
      <CursorPaginationBar
        {...defaultProps}
        totalCount={0}
        hasMore={false}
        totalPages={1}
      />
    )
    expect(screen.getByText('Showing 0-0 of 0')).toBeInTheDocument()
  })

  it('clamps rangeEnd to totalCount on last page', () => {
    render(
      <CursorPaginationBar
        {...defaultProps}
        currentPage={5}
        totalCount={47}
        hasMore={false}
      />
    )
    expect(screen.getByText('Showing 41-47 of 47')).toBeInTheDocument()
  })

  it('disables First and Previous when on page 1', () => {
    render(<CursorPaginationBar {...defaultProps} currentPage={1} />)
    expect(screen.getByText('« First')).toBeDisabled()
    expect(screen.getByText('← Previous')).toBeDisabled()
  })

  it('enables First and Previous when not on page 1', () => {
    render(<CursorPaginationBar {...defaultProps} currentPage={3} />)
    expect(screen.getByText('« First')).not.toBeDisabled()
    expect(screen.getByText('← Previous')).not.toBeDisabled()
  })

  it('disables Next and Last when on last page with no more data', () => {
    render(
      <CursorPaginationBar {...defaultProps} currentPage={5} hasMore={false} />
    )
    expect(screen.getByText('Next →')).toBeDisabled()
    expect(screen.getByText('Last »')).toBeDisabled()
  })

  it('enables Next and Last when hasMore is true and not at end', () => {
    render(
      <CursorPaginationBar {...defaultProps} currentPage={2} hasMore={true} />
    )
    expect(screen.getByText('Next →')).not.toBeDisabled()
    expect(screen.getByText('Last »')).not.toBeDisabled()
  })

  it('disables all navigation buttons when loading', () => {
    render(
      <CursorPaginationBar {...defaultProps} currentPage={3} loading={true} />
    )
    expect(screen.getByText('« First')).toBeDisabled()
    expect(screen.getByText('← Previous')).toBeDisabled()
    expect(screen.getByText('Next →')).toBeDisabled()
    expect(screen.getByText('Last »')).toBeDisabled()
  })

  it('calls onFirst when First button is clicked', () => {
    render(<CursorPaginationBar {...defaultProps} currentPage={3} />)
    fireEvent.click(screen.getByText('« First'))
    expect(defaultProps.onFirst).toHaveBeenCalledTimes(1)
  })

  it('calls onPrev when Previous button is clicked', () => {
    render(<CursorPaginationBar {...defaultProps} currentPage={3} />)
    fireEvent.click(screen.getByText('← Previous'))
    expect(defaultProps.onPrev).toHaveBeenCalledTimes(1)
  })

  it('calls onNext when Next button is clicked', () => {
    render(<CursorPaginationBar {...defaultProps} currentPage={1} />)
    fireEvent.click(screen.getByText('Next →'))
    expect(defaultProps.onNext).toHaveBeenCalledTimes(1)
  })

  it('calls onLast when Last button is clicked', () => {
    render(<CursorPaginationBar {...defaultProps} currentPage={1} />)
    fireEvent.click(screen.getByText('Last »'))
    expect(defaultProps.onLast).toHaveBeenCalledTimes(1)
  })

  it('renders jump-to-page select with correct options', () => {
    render(<CursorPaginationBar {...defaultProps} />)
    const select = screen.getByLabelText('Jump to page')
    expect(select).toBeInTheDocument()
    expect(select.querySelectorAll('option')).toHaveLength(5)
  })

  it('calls onPageSelect when jump-to-page changes', () => {
    render(<CursorPaginationBar {...defaultProps} />)
    const select = screen.getByLabelText('Jump to page')
    fireEvent.change(select, { target: { value: '3' } })
    expect(defaultProps.onPageSelect).toHaveBeenCalledWith(3)
  })

  it('disables the page selector when loading', () => {
    render(<CursorPaginationBar {...defaultProps} loading={true} />)
    const select = screen.getByLabelText('Jump to page')
    expect(select).toBeDisabled()
  })

  it('disables the page selector when totalPages <= 1', () => {
    render(
      <CursorPaginationBar {...defaultProps} totalPages={1} hasMore={false} />
    )
    const select = screen.getByLabelText('Jump to page')
    expect(select).toBeDisabled()
  })

  it('renders with warm variant classes', () => {
    const { container } = render(
      <CursorPaginationBar {...defaultProps} variant="warm" />
    )
    expect(
      container.querySelector('.border-\\[var\\(--border-warm\\)\\]')
    ).toBeTruthy()
  })

  it('renders with default variant when variant is not specified', () => {
    const { container } = render(<CursorPaginationBar {...defaultProps} />)
    expect(container.querySelector('.border-gray-200')).toBeTruthy()
  })
})
