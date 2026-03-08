'use client';

import { createContext, useContext, useState, useCallback, useMemo, type ReactNode } from 'react';

export type CurrencyCode = 'INR' | 'USD' | 'EUR' | 'GBP';

interface CurrencyConfig {
  code: CurrencyCode;
  symbol: string;
  locale: string;
  rate: number; // conversion rate from INR (base); 1 INR = rate units of this currency
}

export const CURRENCIES: Record<CurrencyCode, CurrencyConfig> = {
  INR: { code: 'INR', symbol: '₹', locale: 'en-IN', rate: 1 },
  USD: { code: 'USD', symbol: '$', locale: 'en-US', rate: 1 / 83.5 },
  EUR: { code: 'EUR', symbol: '€', locale: 'de-DE', rate: 0.92 / 83.5 },
  GBP: { code: 'GBP', symbol: '£', locale: 'en-GB', rate: 0.79 / 83.5 },
} as const;

interface CurrencyContextValue {
  currency: CurrencyCode;
  setCurrency: (code: CurrencyCode) => void;
  formatPrice: (priceInINR: number) => string;
  convertPrice: (priceInINR: number) => number;
  currencySymbol: string;
  availableCurrencies: CurrencyCode[];
}

const CurrencyContext = createContext<CurrencyContextValue | null>(null);

export function CurrencyProvider({ children }: Readonly<{ children: ReactNode }>) {
  const [currency, setCurrency] = useState<CurrencyCode>('INR');

  const config = CURRENCIES[currency];

  const convertPrice = useCallback(
    (priceInINR: number): number => {
      return priceInINR * config.rate;
    },
    [config.rate]
  );

  const formatPrice = useCallback(
    (priceInINR: number): string => {
      const converted = priceInINR * config.rate;
      return new Intl.NumberFormat(config.locale, {
        style: 'currency',
        currency: config.code,
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      }).format(converted);
    },
    [config]
  );

  const value: CurrencyContextValue = useMemo(() => ({
    currency,
    setCurrency,
    formatPrice,
    convertPrice,
    currencySymbol: config.symbol,
    availableCurrencies: Object.keys(CURRENCIES) as CurrencyCode[],
  }), [currency, setCurrency, formatPrice, convertPrice, config.symbol]);

  return (
    <CurrencyContext.Provider value={value}>
      {children}
    </CurrencyContext.Provider>
  );
}

export function useCurrency(): CurrencyContextValue {
  const ctx = useContext(CurrencyContext);
  if (!ctx) {
    throw new Error('useCurrency must be used within a CurrencyProvider');
  }
  return ctx;
}
