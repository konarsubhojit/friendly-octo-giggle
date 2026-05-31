// @vitest-environment jsdom
import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import React from 'react'
import { NumberField } from '@/components/ui/zenput'

describe('NumberField adapter', () => {
  it('renders the underlying zenput NumberInput with its label', () => {
    render(<NumberField label="Stock" value={3} onChange={() => {}} />)
    expect(screen.getByText('Stock')).toBeTruthy()
  })

  it('substitutes the default value when the field is cleared', () => {
    const handleChange = vi.fn<(value: number) => void>()
    render(
      <NumberField
        label="Stock"
        value={7}
        defaultValueOnClear={0}
        onChange={handleChange}
      />
    )

    // Clearing the field causes zenput to fire onChange(undefined). The
    // adapter must coerce that to the default value so consumers can rely on
    // a `(value: number) => void` signature.
    const input = screen.getByRole('spinbutton') as HTMLInputElement
    fireEvent.change(input, { target: { value: '' } })

    expect(handleChange).toHaveBeenCalled()
    for (const call of handleChange.mock.calls) {
      expect(typeof call[0]).toBe('number')
    }
    expect(handleChange.mock.calls.some(([v]) => v === 0)).toBe(true)
  })

  it('respects a custom defaultValueOnClear', () => {
    const handleChange = vi.fn<(value: number) => void>()
    render(
      <NumberField
        label="Stock"
        value={7}
        defaultValueOnClear={-1}
        onChange={handleChange}
      />
    )

    const input = screen.getByRole('spinbutton') as HTMLInputElement
    fireEvent.change(input, { target: { value: '' } })

    expect(handleChange.mock.calls.some(([v]) => v === -1)).toBe(true)
  })

  it('forwards numeric values unchanged', () => {
    const handleChange = vi.fn<(value: number) => void>()
    render(<NumberField label="Stock" value={1} onChange={handleChange} />)

    const input = screen.getByRole('spinbutton') as HTMLInputElement
    fireEvent.change(input, { target: { value: '42' } })

    expect(handleChange).toHaveBeenCalledWith(42)
  })
})
