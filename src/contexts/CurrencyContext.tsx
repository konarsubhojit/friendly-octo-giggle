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
import { useLocale } from '@/contexts/LocaleContext'

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
const EXCHANGE_RATES_MAX_AGE_MS = 3_600_000 // 1 hour
const LOCALE_TO_NUMBER_FORMAT: Record<string, string> = {
  en: 'en-US',
  es: 'es-ES',
}

export function CurrencyProvider({
  children,
}: Readonly<{ children: ReactNode }>) {
  const { locale } = useLocale()
  const [currency, setCurrency] = useState<CurrencyCode>('INR')

  // Synchronously seed rates from sessionStorage on mount so the first paint
  // already has the correct values when the cache is fresh; only fall back to
  // hardcoded FALLBACK_RATES when no fresh cache exists.
  const [{ rates, ratesLoading }, setRatesState] = useState<{
    rates: Record<CurrencyCode, number>
    ratesLoading: boolean
  }>(() => {
    if (typeof globalThis.window === 'undefined') {
      return { rates: FALLBACK_RATES, ratesLoading: true }
    }
    try {
      const stored = sessionStorage.getItem(EXCHANGE_RATES_STORAGE_KEY)
      if (stored) {
        const { rates: cached, timestamp } = JSON.parse(stored) as {
          rates: Record<string, number>
          timestamp: number
        }
        if (cached && Date.now() - timestamp < EXCHANGE_RATES_MAX_AGE_MS) {
          return {
            rates: {
              INR: cached['INR'] ?? FALLBACK_RATES.INR,
              USD: cached['USD'] ?? FALLBACK_RATES.USD,
              EUR: cached['EUR'] ?? FALLBACK_RATES.EUR,
              GBP: cached['GBP'] ?? FALLBACK_RATES.GBP,
            },
            ratesLoading: false,
          }
        }
      }
    } catch {
      // sessionStorage unavailable (e.g. incognito) — fall through.
    }
    return { rates: FALLBACK_RATES, ratesLoading: true }
  })

  // Fetch live rates lazily when no fresh cache was found. Defer the network
  // request to browser idle time so it does not compete with first paint.
  useEffect(() => {
    if (!ratesLoading) return
    let cancelled = false

    const markLoaded = () => {
      if (cancelled) return
      setRatesState((prev) => ({ ...prev, ratesLoading: false }))
    }

    const persistRates = (newRates: Record<CurrencyCode, number>) => {
      try {
        sessionStorage.setItem(
          EXCHANGE_RATES_STORAGE_KEY,
          JSON.stringify({ rates: newRates, timestamp: Date.now() })
        )
      } catch {
        // silently ignore storage errors
      }
    }

    const applyFetchedBody = (
      body: { data?: { rates?: Record<string, number> } } | null
    ) => {
      if (cancelled) return
      if (body?.data?.rates) {
        const fetched = body.data.rates
        const newRates = {
          INR: fetched['INR'] ?? FALLBACK_RATES.INR,
          USD: fetched['USD'] ?? FALLBACK_RATES.USD,
          EUR: fetched['EUR'] ?? FALLBACK_RATES.EUR,
          GBP: fetched['GBP'] ?? FALLBACK_RATES.GBP,
        }
        setRatesState({ rates: newRates, ratesLoading: false })
        persistRates(newRates)
      } else {
        markLoaded()
      }
    }

    const runFetch = () => {
      if (cancelled) return
      fetch('/api/exchange-rates')
        .then((res) => {
          if (!res.ok) return null
          return res.json() as Promise<{
            data?: { rates?: Record<string, number> }
          }>
        })
        .then(applyFetchedBody)
        .catch(markLoaded)
    }

    type IdleScheduler = (
      cb: () => void,
      opts?: { timeout: number }
    ) => number | NodeJS.Timeout
    const ric =
      (typeof globalThis.window !== 'undefined' &&
        (globalThis.window as unknown as { requestIdleCallback?: IdleScheduler })
          .requestIdleCallback) ||
      ((cb: () => void) => setTimeout(cb, 1))
    const handle = ric(runFetch, { timeout: 2000 })

    return () => {
      cancelled = true
      type IdleCanceller = (handle: number | NodeJS.Timeout) => void
      const cic =
        (typeof globalThis.window !== 'undefined' &&
          (globalThis.window as unknown as { cancelIdleCallback?: IdleCanceller })
            .cancelIdleCallback) ||
        ((h: number | NodeJS.Timeout) => clearTimeout(h as NodeJS.Timeout))
      cic(handle)
    }
  }, [ratesLoading])

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
      const numberLocale = LOCALE_TO_NUMBER_FORMAT[locale] ?? config.locale
      return new Intl.NumberFormat(numberLocale, {
        style: 'currency',
        currency: config.code,
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      }).format(converted)
    },
    [config, rates, currency, locale]
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
