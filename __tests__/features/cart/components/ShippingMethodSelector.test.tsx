// @vitest-environment jsdom
import { describe, it, expect, vi } from 'vitest'
import { fireEvent, render, screen } from '@testing-library/react'
import React from 'react'
import { ShippingMethodSelector } from '@/features/cart/components/ShippingMethodSelector'
import { buildShippingMethodOptions } from '@/lib/shipping'

const options = buildShippingMethodOptions({
  destination: { state: 'Delhi', pinCode: '110001' },
  items: [{ quantity: 1, weightGrams: 250 }],
  subtotal: 100,
})

const formatPrice = (amount: number) => `₹${amount.toFixed(2)}`

describe('ShippingMethodSelector', () => {
  it('lists every quoted method with its price and estimate', () => {
    render(
      <ShippingMethodSelector
        options={options}
        value="STANDARD"
        onChange={vi.fn()}
        formatPrice={formatPrice}
        hasDestination
      />
    )

    expect(screen.getByText('Standard delivery')).toBeInTheDocument()
    expect(screen.getByText('Express delivery')).toBeInTheDocument()
    expect(screen.getByText('₹69.00')).toBeInTheDocument()
    expect(screen.getByText(/Arrives in about 7 days/)).toBeInTheDocument()
  })

  it('marks the selected method as checked', () => {
    render(
      <ShippingMethodSelector
        options={options}
        value="EXPRESS"
        onChange={vi.fn()}
        formatPrice={formatPrice}
        hasDestination
      />
    )

    expect(
      screen.getByRole('radio', { name: /Express delivery/ })
    ).toBeChecked()
  })

  it('reports the newly chosen method', () => {
    const onChange = vi.fn()
    render(
      <ShippingMethodSelector
        options={options}
        value="STANDARD"
        onChange={onChange}
        formatPrice={formatPrice}
        hasDestination
      />
    )

    fireEvent.click(screen.getByRole('radio', { name: /Express delivery/ }))

    expect(onChange).toHaveBeenCalledWith('EXPRESS')
  })

  it('prompts for an address before rates are final', () => {
    render(
      <ShippingMethodSelector
        options={options}
        value="STANDARD"
        onChange={vi.fn()}
        formatPrice={formatPrice}
        hasDestination={false}
      />
    )

    expect(
      screen.getByText(/Enter your pin code and state/)
    ).toBeInTheDocument()
  })
})
