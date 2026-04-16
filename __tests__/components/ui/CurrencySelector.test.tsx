// @vitest-environment jsdom
import { describe, it, expect } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import React from 'react'
import CurrencySelector from '@/components/ui/CurrencySelector'
import { CurrencyProvider } from '@/contexts/CurrencyContext'

function renderWithCurrency(ui: React.ReactElement) {
  return render(<CurrencyProvider>{ui}</CurrencyProvider>)
}

describe('CurrencySelector', () => {
  it('renders a select element', () => {
    renderWithCurrency(<CurrencySelector />)
    const select = screen.getByRole('combobox')
    expect(select).toBeTruthy()
  })

  it('shows all four currencies as options', () => {
    renderWithCurrency(<CurrencySelector />)
    const options = screen.getAllByRole('option')
    const values = options.map((o) => o.getAttribute('value'))
    expect(values).toContain('INR')
    expect(values).toContain('USD')
    expect(values).toContain('EUR')
    expect(values).toContain('GBP')
  })

  it('defaults to INR', () => {
    renderWithCurrency(<CurrencySelector />)
    const select = screen.getByRole('combobox') as HTMLSelectElement
    expect(select.value).toBe('INR')
  })

  it('changes currency when a different option is selected', () => {
    renderWithCurrency(<CurrencySelector />)
    const select = screen.getByRole('combobox') as HTMLSelectElement
    fireEvent.change(select, { target: { value: 'USD' } })
    expect(select.value).toBe('USD')
  })

  it('has accessible aria-label', () => {
    renderWithCurrency(<CurrencySelector />)
    const select = screen.getByLabelText('Select currency')
    expect(select).toBeTruthy()
  })
})
