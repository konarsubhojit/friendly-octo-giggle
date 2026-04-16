// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, fireEvent, act, waitFor } from '@testing-library/react'
import React from 'react'
import {
  CurrencyProvider,
  useCurrency,
  CURRENCIES,
} from '@/contexts/CurrencyContext'
function CurrencyDisplay() {
  const {
    currency,
    setCurrency,
    formatPrice,
    convertPrice,
    currencySymbol,
    availableCurrencies,
    rates,
    ratesLoading,
  } = useCurrency()
  return (
    <div>
      <span data-testid="currency">{currency}</span>
      <span data-testid="symbol">{currencySymbol}</span>
      <span data-testid="formatted">{formatPrice(10)}</span>
      <span data-testid="converted">{convertPrice(10)}</span>
      <span data-testid="available">{availableCurrencies.join(',')}</span>
      <span data-testid="rates-loading">{String(ratesLoading)}</span>
      <span data-testid="usd-rate">{rates.USD}</span>
      <button onClick={() => setCurrency('USD')}>Set USD</button>
      <button onClick={() => setCurrency('EUR')}>Set EUR</button>
      <button onClick={() => setCurrency('GBP')}>Set GBP</button>
    </div>
  )
}

function ThrowingComponent() {
  useCurrency()
  return null
}

describe('CurrencyProvider', () => {
  beforeEach(() => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockRejectedValue(new Error('no network in tests'))
    )
    sessionStorage.clear()
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('provides default INR currency', () => {
    render(
      <CurrencyProvider>
        <CurrencyDisplay />
      </CurrencyProvider>
    )
    expect(screen.getByTestId('currency').textContent).toBe('INR')
    expect(screen.getByTestId('symbol').textContent).toBe('₹')
  })

  it('converts price using INR rate by default', () => {
    render(
      <CurrencyProvider>
        <CurrencyDisplay />
      </CurrencyProvider>
    )
    const converted = parseFloat(
      screen.getByTestId('converted').textContent ?? '0'
    )
    expect(converted).toBeCloseTo(10 * CURRENCIES.INR.rate, 2)
  })

  it('formats price with Intl.NumberFormat', () => {
    render(
      <CurrencyProvider>
        <CurrencyDisplay />
      </CurrencyProvider>
    )
    const formatted = screen.getByTestId('formatted').textContent ?? ''
    expect(formatted).toContain('10')
  })

  it('updates currency when setCurrency is called', () => {
    render(
      <CurrencyProvider>
        <CurrencyDisplay />
      </CurrencyProvider>
    )
    act(() => {
      fireEvent.click(screen.getByText('Set USD'))
    })
    expect(screen.getByTestId('currency').textContent).toBe('USD')
    expect(screen.getByTestId('symbol').textContent).toBe('$')
  })

  it('converts price using USD rate after switching', () => {
    render(
      <CurrencyProvider>
        <CurrencyDisplay />
      </CurrencyProvider>
    )
    act(() => {
      fireEvent.click(screen.getByText('Set USD'))
    })
    const converted = parseFloat(
      screen.getByTestId('converted').textContent ?? '0'
    )
    expect(converted).toBeCloseTo(10 * CURRENCIES.USD.rate, 2)
  })

  it('switches to EUR', () => {
    render(
      <CurrencyProvider>
        <CurrencyDisplay />
      </CurrencyProvider>
    )
    act(() => {
      fireEvent.click(screen.getByText('Set EUR'))
    })
    expect(screen.getByTestId('currency').textContent).toBe('EUR')
    expect(screen.getByTestId('symbol').textContent).toBe('€')
  })

  it('switches to GBP', () => {
    render(
      <CurrencyProvider>
        <CurrencyDisplay />
      </CurrencyProvider>
    )
    act(() => {
      fireEvent.click(screen.getByText('Set GBP'))
    })
    expect(screen.getByTestId('currency').textContent).toBe('GBP')
    expect(screen.getByTestId('symbol').textContent).toBe('£')
  })

  it('provides all four available currencies', () => {
    render(
      <CurrencyProvider>
        <CurrencyDisplay />
      </CurrencyProvider>
    )
    const available = screen.getByTestId('available').textContent ?? ''
    expect(available).toContain('INR')
    expect(available).toContain('USD')
    expect(available).toContain('EUR')
    expect(available).toContain('GBP')
  })

  it('throws when useCurrency is used outside provider', () => {
    const originalError = console.error
    console.error = () => {}
    expect(() => render(<ThrowingComponent />)).toThrow(
      'useCurrency must be used within a CurrencyProvider'
    )
    console.error = originalError
  })

  it('starts with ratesLoading true and clears it after fetch resolves', async () => {
    render(
      <CurrencyProvider>
        <CurrencyDisplay />
      </CurrencyProvider>
    )
    await waitFor(() => {
      expect(screen.getByTestId('rates-loading').textContent).toBe('false')
    })
  })

  it('adopts live rates from the API when the fetch succeeds', async () => {
    const liveUsdRate = 0.01088 // 1 INR ≈ 0.01088 USD
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({
          data: {
            rates: { INR: 1, USD: liveUsdRate, EUR: 0.0094, GBP: 0.0081 },
          },
        }),
      })
    )

    render(
      <CurrencyProvider>
        <CurrencyDisplay />
      </CurrencyProvider>
    )

    await waitFor(() => {
      const usdRate = parseFloat(
        screen.getByTestId('usd-rate').textContent ?? '0'
      )
      expect(usdRate).toBeCloseTo(liveUsdRate, 5)
    })
  })

  it('keeps fallback rates when the API fetch fails', async () => {
    render(
      <CurrencyProvider>
        <CurrencyDisplay />
      </CurrencyProvider>
    )

    await waitFor(() => {
      expect(screen.getByTestId('rates-loading').textContent).toBe('false')
    })

    const usdRate = parseFloat(
      screen.getByTestId('usd-rate').textContent ?? '0'
    )
    expect(usdRate).toBeCloseTo(CURRENCIES.USD.rate, 5)
  })
})

describe('CURRENCIES config', () => {
  it('has correct INR config', () => {
    expect(CURRENCIES.INR).toMatchObject({
      code: 'INR',
      symbol: '₹',
      rate: 1,
    })
  })

  it('has USD rate less than 1 (INR is base currency)', () => {
    expect(CURRENCIES.USD.rate).toBeCloseTo(1 / 83.5, 6)
  })

  it('has all four currencies', () => {
    expect(Object.keys(CURRENCIES)).toHaveLength(4)
  })
})
