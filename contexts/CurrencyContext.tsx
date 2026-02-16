'use client';

import { createContext, useContext, useState, useCallback, useMemo, type ReactNode } from 'react';

export type CurrencyCode = 'INR' | 'USD' | 'EUR' | 'GBP';

interface CurrencyConfig {
  code: CurrencyCode;
  symbol: string;
  locale: string;
  rate: number; // conversion rate from USD (base)
}

const CURRENCIES: Record<CurrencyCode, CurrencyConfig> = {
  INR: { code: 'INR', symbol: '₹', locale: 'en-IN', rate: 83.5 },
  USD: { code: 'USD', symbol: '$', locale: 'en-US', rate: 1 },
  EUR: { code: 'EUR', symbol: '€', locale: 'de-DE', rate: 0.92 },
  GBP: { code: 'GBP', symbol: '£', locale: 'en-GB', rate: 0.79 },
} as const;

interface CurrencyContextValue {
  currency: CurrencyCode;
  setCurrency: (code: CurrencyCode) => void;
  formatPrice: (priceInUSD: number) => string;
  convertPrice: (priceInUSD: number) => number;
  currencySymbol: string;
  availableCurrencies: CurrencyCode[];
}

const CurrencyContext = createContext<CurrencyContextValue | null>(null);

export function CurrencyProvider({ children }: Readonly<{ children: ReactNode }>) {
  const [currency, setCurrency] = useState<CurrencyCode>('INR');

  const config = CURRENCIES[currency];

  const convertPrice = useCallback(
    (priceInUSD: number): number => {
      return priceInUSD * config.rate;
    },
    [config.rate]
  );

  const formatPrice = useCallback(
    (priceInUSD: number): string => {
      const converted = priceInUSD * config.rate;
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
