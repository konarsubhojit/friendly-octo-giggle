'use client'

import {
  createContext,
  useContext,
  useState,
  useCallback,
  useMemo,
  useEffect,
  type ReactNode,
} from 'react'

export type CurrencyCode = 'INR' | 'USD' | 'EUR' | 'GBP'

interface CurrencyConfig {
  code: CurrencyCode
  symbol: string
  locale: string
  rate: number // fallback conversion rate from INR (base); 1 INR = rate units of this currency
}

export const CURRENCIES: Record<CurrencyCode, CurrencyConfig> = {
  INR: { code: 'INR', symbol: '₹', locale: 'en-IN', rate: 1 },
  USD: { code: 'USD', symbol: '$', locale: 'en-US', rate: 1 / 83.5 },
  EUR: { code: 'EUR', symbol: '€', locale: 'de-DE', rate: 0.92 / 83.5 },
  GBP: { code: 'GBP', symbol: '£', locale: 'en-GB', rate: 0.79 / 83.5 },
} as const

// Hardcoded fallback rates (INR-based) used until live rates are available
const FALLBACK_RATES: Record<CurrencyCode, number> = {
  INR: CURRENCIES.INR.rate,
  USD: CURRENCIES.USD.rate,
  EUR: CURRENCIES.EUR.rate,
  GBP: CURRENCIES.GBP.rate,
}

interface CurrencyContextValue {
  currency: CurrencyCode
  setCurrency: (code: CurrencyCode) => void
  formatPrice: (priceInINR: number) => string
  convertPrice: (priceInINR: number) => number
  currencySymbol: string
  availableCurrencies: CurrencyCode[]
  /** Live INR-based rates (e.g. rates.USD = how many USD per 1 INR). Falls back to hardcoded values. */
  rates: Record<CurrencyCode, number>
  /** True while the first live-rate fetch is in progress. */
  ratesLoading: boolean
}

const CurrencyContext = createContext<CurrencyContextValue | null>(null)

const EXCHANGE_RATES_STORAGE_KEY = 'exchange-rates'
const EXCHANGE_RATES_MAX_AGE_MS = 3600_000 // 1 hour

export function CurrencyProvider({
  children,
}: Readonly<{ children: ReactNode }>) {
  const [currency, setCurrency] = useState<CurrencyCode>('INR')
  const [rates, setRates] =
    useState<Record<CurrencyCode, number>>(FALLBACK_RATES)
  const [ratesLoading, setRatesLoading] = useState(true)

  // Fetch live rates once on mount; use sessionStorage to cache across navigations
  useEffect(() => {
    let cancelled = false

    const STORAGE_KEY = EXCHANGE_RATES_STORAGE_KEY
    const STORAGE_MAX_AGE_MS = EXCHANGE_RATES_MAX_AGE_MS

    // Try sessionStorage first
    try {
      const stored = sessionStorage.getItem(STORAGE_KEY)
      if (stored) {
        const { rates: cached, timestamp } = JSON.parse(stored) as {
          rates: Record<string, number>
          timestamp: number
        }
        if (Date.now() - timestamp < STORAGE_MAX_AGE_MS && cached) {
          // eslint-disable-next-line react-hooks/set-state-in-effect -- reading cached sessionStorage on mount is the intended pattern
          setRates({
            INR: cached['INR'] ?? FALLBACK_RATES.INR,
            USD: cached['USD'] ?? FALLBACK_RATES.USD,
            EUR: cached['EUR'] ?? FALLBACK_RATES.EUR,
            GBP: cached['GBP'] ?? FALLBACK_RATES.GBP,
          })
          setRatesLoading(false)
          return
        }
      }
    } catch {
      // sessionStorage unavailable (e.g. SSR, incognito)
    }

    fetch('/api/exchange-rates')
      .then((res) => {
        if (!res.ok) return null
        return res.json() as Promise<{
          data?: { rates?: Record<string, number> }
        }>
      })
      .then((body) => {
        if (!cancelled && body?.data?.rates) {
          const fetched = body.data.rates
          const newRates = {
            INR: fetched['INR'] ?? FALLBACK_RATES.INR,
            USD: fetched['USD'] ?? FALLBACK_RATES.USD,
            EUR: fetched['EUR'] ?? FALLBACK_RATES.EUR,
            GBP: fetched['GBP'] ?? FALLBACK_RATES.GBP,
          }
          setRates(newRates)
          try {
            sessionStorage.setItem(
              STORAGE_KEY,
              JSON.stringify({ rates: newRates, timestamp: Date.now() })
            )
          } catch {
            // silently ignore storage errors
          }
        }
      })
      .catch(() => {
        // Silently keep the hardcoded fallback rates when the API is unreachable
      })
      .finally(() => {
        if (!cancelled) setRatesLoading(false)
      })

    return () => {
      cancelled = true
    }
  }, [])

  const config = CURRENCIES[currency]

  const convertPrice = useCallback(
    (priceInINR: number): number => {
      return priceInINR * rates[currency]
    },
    [rates, currency]
  )

  const formatPrice = useCallback(
    (priceInINR: number): string => {
      const converted = priceInINR * rates[currency]
      return new Intl.NumberFormat(config.locale, {
        style: 'currency',
        currency: config.code,
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      }).format(converted)
    },
    [config, rates, currency]
  )

  const value: CurrencyContextValue = useMemo(
    () => ({
      currency,
      setCurrency,
      formatPrice,
      convertPrice,
      currencySymbol: config.symbol,
      availableCurrencies: Object.keys(CURRENCIES) as CurrencyCode[],
      rates,
      ratesLoading,
    }),
    [
      currency,
      setCurrency,
      formatPrice,
      convertPrice,
      config.symbol,
      rates,
      ratesLoading,
    ]
  )

  return (
    <CurrencyContext.Provider value={value}>
      {children}
    </CurrencyContext.Provider>
  )
}

export function useCurrency(): CurrencyContextValue {
  const ctx = useContext(CurrencyContext)
  if (!ctx) {
    throw new Error('useCurrency must be used within a CurrencyProvider')
  }
  return ctx
}
