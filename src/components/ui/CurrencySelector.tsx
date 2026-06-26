'use client'

import { useCurrency, type CurrencyCode } from '@/contexts/CurrencyContext'
import { HeaderSelect } from '@/components/ui/HeaderSelect'

export default function CurrencySelector() {
  const { currency, setCurrency, availableCurrencies } = useCurrency()

  return (
    <HeaderSelect
      value={currency}
      onChange={(e) => setCurrency(e.target.value as CurrencyCode)}
      className="w-full sm:w-52"
      aria-label="Select currency"
    >
      {availableCurrencies.map((code) => (
        <option key={code} value={code}>
          {code}
        </option>
      ))}
    </HeaderSelect>
  )
}
