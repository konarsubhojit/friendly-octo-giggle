/**
 * Server-side currency formatting utilities for emails and other server contexts.
 * Mirrors the client-side CurrencyContext logic without React dependencies.
 */

export type CurrencyCode = 'INR' | 'USD' | 'EUR' | 'GBP'

interface CurrencyConfig {
  code: CurrencyCode
  symbol: string
  locale: string
  rate: number // fallback conversion rate from INR (base)
}

const CURRENCIES: Record<CurrencyCode, CurrencyConfig> = {
  INR: { code: 'INR', symbol: '₹', locale: 'en-IN', rate: 1 },
  USD: { code: 'USD', symbol: '$', locale: 'en-US', rate: 1 / 83.5 },
  EUR: { code: 'EUR', symbol: '€', locale: 'de-DE', rate: 0.92 / 83.5 },
  GBP: { code: 'GBP', symbol: '£', locale: 'en-GB', rate: 0.79 / 83.5 },
} as const

const VALID_CODES = new Set<string>(Object.keys(CURRENCIES))

export function isValidCurrencyCode(code: string): code is CurrencyCode {
  return VALID_CODES.has(code)
}

/**
 * Format a price stored in INR to the target currency string.
 * Uses hardcoded fallback rates (same as the client-side defaults).
 */
export function formatPriceForCurrency(
  priceInINR: number,
  currencyCode: CurrencyCode
): string {
  const config = CURRENCIES[currencyCode]
  const converted = priceInINR * config.rate
  return new Intl.NumberFormat(config.locale, {
    style: 'currency',
    currency: config.code,
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(converted)
}
