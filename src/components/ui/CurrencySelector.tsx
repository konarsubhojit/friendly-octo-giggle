'use client'

import { useCurrency, type CurrencyCode } from '@/contexts/CurrencyContext'

export default function CurrencySelector() {
  const { currency, setCurrency, availableCurrencies } = useCurrency()

  return (
    <select
      value={currency}
      onChange={(e) => setCurrency(e.target.value as CurrencyCode)}
      className="w-full cursor-pointer rounded-md border border-[var(--border-warm)] bg-[var(--surface)] px-3 py-1.5 text-sm text-[var(--foreground)] focus:outline-none focus:ring-2 focus:ring-[var(--accent-rose)] sm:w-52"
      aria-label="Select currency"
    >
      {availableCurrencies.map((code) => (
        <option key={code} value={code}>
          {code}
        </option>
      ))}
    </select>
  )
}
