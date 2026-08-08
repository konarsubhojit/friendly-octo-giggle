'use client'

import { useId } from 'react'
import type { ShippingMethodOption } from '@/lib/shipping'
import type { ShippingMethodName } from '@/lib/shipping/methods'

interface ShippingMethodSelectorProps {
  readonly options: readonly ShippingMethodOption[]
  readonly value: ShippingMethodName
  readonly onChange: (method: ShippingMethodName) => void
  readonly formatPrice: (amount: number) => string
  /** False while the destination is incomplete, so rates are still indicative. */
  readonly hasDestination: boolean
  readonly className?: string
}

const formatEstimate = (days: number) =>
  days === 1 ? 'Arrives in about 1 day' : `Arrives in about ${days} days`

export function ShippingMethodSelector({
  options,
  value,
  onChange,
  formatPrice,
  hasDestination,
  className,
}: ShippingMethodSelectorProps) {
  const groupName = useId()

  return (
    <fieldset className={className}>
      <legend className="text-sm font-semibold text-[var(--foreground)]">
        Delivery speed
      </legend>
      <p className="mt-1 text-xs text-[var(--text-muted)]">
        {hasDestination
          ? 'Rates are based on your delivery address and parcel weight.'
          : 'Enter your pin code and state to see exact delivery charges.'}
      </p>
      <div className="mt-3 space-y-2">
        {options.map((option) => {
          const inputId = `${groupName}-${option.method}`
          const isSelected = option.method === value

          return (
            <label
              key={option.method}
              htmlFor={inputId}
              className={`flex cursor-pointer items-start gap-3 rounded-2xl border p-3 transition-colors ${
                isSelected
                  ? 'border-[var(--accent-rose)] bg-[var(--accent-blush)]/40'
                  : 'border-[var(--border-warm)] hover:border-[var(--accent-rose)]'
              }`}
            >
              <input
                id={inputId}
                type="radio"
                name={groupName}
                value={option.method}
                checked={isSelected}
                onChange={() => onChange(option.method)}
                className="mt-1 h-4 w-4 accent-[var(--accent-rose)]"
              />
              <span className="flex flex-1 flex-wrap items-baseline justify-between gap-x-3">
                <span className="text-sm font-medium text-[var(--foreground)]">
                  {option.label}
                </span>
                <span className="text-sm font-semibold text-[var(--accent-sage)]">
                  {option.amount === 0 ? 'Free' : formatPrice(option.amount)}
                </span>
                <span className="mt-0.5 block w-full text-xs text-[var(--text-secondary)]">
                  {option.description}
                </span>
                <span className="mt-0.5 block w-full text-xs text-[var(--text-muted)]">
                  {formatEstimate(option.estimatedDays)}
                </span>
              </span>
            </label>
          )
        })}
      </div>
    </fieldset>
  )
}
