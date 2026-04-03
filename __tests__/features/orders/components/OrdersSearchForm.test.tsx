import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import React from 'react'
import { OrdersSearchForm } from '@/features/orders/components/OrdersSearchForm'

describe('OrdersSearchForm', () => {
  it('renders search input', () => {
    render(
      <OrdersSearchForm
        searchInput=""
        setSearchInput={vi.fn()}
        search=""
        onSearch={vi.fn()}
        onClear={vi.fn()}
      />
    )

    expect(screen.getByLabelText('Search your orders')).toBeTruthy()
  })

  it('renders Search button', () => {
    render(
      <OrdersSearchForm
        searchInput=""
        setSearchInput={vi.fn()}
        search=""
        onSearch={vi.fn()}
        onClear={vi.fn()}
      />
    )

    expect(screen.getByRole('button', { name: 'Search' })).toBeTruthy()
  })

  it('does not render Clear button when no active search', () => {
    render(
      <OrdersSearchForm
        searchInput=""
        setSearchInput={vi.fn()}
        search=""
        onSearch={vi.fn()}
        onClear={vi.fn()}
      />
    )

    expect(screen.queryByRole('button', { name: 'Clear' })).toBeNull()
  })

  it('renders Clear button when search is active', () => {
    render(
      <OrdersSearchForm
        searchInput="test"
        setSearchInput={vi.fn()}
        search="test"
        onSearch={vi.fn()}
        onClear={vi.fn()}
      />
    )

    expect(screen.getByRole('button', { name: 'Clear' })).toBeTruthy()
  })

  it('shows search result text when search is active', () => {
    render(
      <OrdersSearchForm
        searchInput="PENDING"
        setSearchInput={vi.fn()}
        search="PENDING"
        onSearch={vi.fn()}
        onClear={vi.fn()}
      />
    )

    expect(screen.getByText('PENDING')).toBeTruthy()
  })

  it('calls setSearchInput on input change', () => {
    const setSearchInput = vi.fn()
    render(
      <OrdersSearchForm
        searchInput=""
        setSearchInput={setSearchInput}
        search=""
        onSearch={vi.fn()}
        onClear={vi.fn()}
      />
    )

    fireEvent.change(screen.getByLabelText('Search your orders'), {
      target: { value: 'ORD123' },
    })

    expect(setSearchInput).toHaveBeenCalled()
  })

  it('calls onSearch on form submit', () => {
    const onSearch = vi.fn((e) => e.preventDefault())
    render(
      <OrdersSearchForm
        searchInput="test"
        setSearchInput={vi.fn()}
        search=""
        onSearch={onSearch}
        onClear={vi.fn()}
      />
    )

    fireEvent.click(screen.getByRole('button', { name: 'Search' }))
    expect(onSearch).toHaveBeenCalled()
  })

  it('calls onClear when Clear button is clicked', () => {
    const onClear = vi.fn()
    render(
      <OrdersSearchForm
        searchInput="test"
        setSearchInput={vi.fn()}
        search="test"
        onSearch={vi.fn()}
        onClear={onClear}
      />
    )

    fireEvent.click(screen.getByRole('button', { name: 'Clear' }))
    expect(onClear).toHaveBeenCalled()
  })

  it('displays current searchInput value', () => {
    render(
      <OrdersSearchForm
        searchInput="my query"
        setSearchInput={vi.fn()}
        search=""
        onSearch={vi.fn()}
        onClear={vi.fn()}
      />
    )

    const input = screen.getByLabelText(
      'Search your orders'
    ) as HTMLInputElement
    expect(input.value).toBe('my query')
  })
})
