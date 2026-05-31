'use client'

import { Product, ProductVariant } from '@/lib/types'
import { VariantButton } from '@/features/product/components/VariantButton'
import {
  buildSelectedOptionValues,
  buildValueMap,
  buildVariantValueIndex,
  deriveOptionsFromSkus,
  getOptionButtonClassName,
  getVariantLabel,
  getVariantOptionValueSet,
  updateValueStatus,
  type OptionValueStatus,
} from '../lib/variant-utils'

/** Variant grid shown when the product has no named options. */
const NoOptionsVariantGrid = ({
  variants,
  selectedVariant,
  formatPrice,
  onSelect,
  cartQuantities,
}: {
  readonly variants: ProductVariant[]
  readonly selectedVariant: ProductVariant | null
  readonly formatPrice: (amount: number) => string
  readonly onSelect: (v: ProductVariant) => void
  readonly cartQuantities: Record<string, number>
}) => (
  <div className="mb-6 space-y-5">
    <span
      className="block text-lg font-semibold text-[var(--foreground)]"
      id="variant-selector-label"
    >
      Choose Your Option
    </span>
    <div className="grid grid-cols-2 gap-3">
      {variants.map((v, idx) => (
        <VariantButton
          key={v.id}
          variant={v}
          label={v.sku ?? `Option ${idx + 1}`}
          isSelected={selectedVariant?.id === v.id}
          formatPrice={formatPrice}
          onSelect={onSelect}
          cartQuantity={cartQuantities[v.id] ?? 0}
        />
      ))}
    </div>
  </div>
)

/** Summary card shown below the option selectors for the selected variant. */
const SelectedVariantSummary = ({
  variant,
  label,
  formattedPrice,
  cartQuantity,
}: {
  readonly variant: ProductVariant
  readonly label: string
  readonly formattedPrice: string
  readonly cartQuantity: number
}) => (
  <div className="p-4 border-2 rounded-xl border-[var(--accent-warm)] bg-[var(--accent-cream)] shadow-warm">
    <div className="text-sm font-bold text-[var(--foreground)]">{label}</div>
    <div className="text-xs font-semibold text-[var(--accent-warm)] mt-1">
      {formattedPrice}
    </div>
    {variant.stock > 0 && variant.stock < 6 && (
      <div className="text-xs text-[var(--accent-rose)] font-medium mt-1">
        Only {variant.stock} left
      </div>
    )}
    {cartQuantity > 0 && (
      <div className="text-xs font-semibold text-blue-600 mt-1">
        {cartQuantity} in cart
      </div>
    )}
  </div>
)

interface VariantSelectorProps {
  readonly product: Product
  readonly selectedVariant: ProductVariant | null
  readonly formatPrice: (amount: number) => string
  readonly onSelect: (v: ProductVariant) => void
  readonly cartQuantities: Record<string, number>
}

export const VariantSelector = ({
  product,
  selectedVariant,
  formatPrice,
  onSelect,
  cartQuantities,
}: VariantSelectorProps) => {
  const rawVariants = product.variants ?? []
  const rawOptions = product.options ?? []

  if (rawVariants.length === 0) return null

  // Derive options from SKU patterns if none are defined
  const derived =
    rawOptions.length === 0 ? deriveOptionsFromSkus(rawVariants) : null

  const variants = derived?.variants ?? rawVariants
  const options = derived?.options ?? rawOptions
  const resolvedSelectedVariant =
    derived && selectedVariant
      ? (derived.variants.find((v) => v.id === selectedVariant.id) ??
        selectedVariant)
      : selectedVariant

  // No options available (derivation also failed) — fall back to grid
  if (options.length === 0) {
    return (
      <NoOptionsVariantGrid
        variants={variants}
        selectedVariant={resolvedSelectedVariant}
        formatPrice={formatPrice}
        onSelect={onSelect}
        cartQuantities={cartQuantities}
      />
    )
  }

  const valueMap = buildValueMap(options)
  const selectedOptionValues = buildSelectedOptionValues(
    resolvedSelectedVariant,
    options
  )
  const variantValueIndex = buildVariantValueIndex(variants)

  /** Collect selected values from options preceding the given index. */
  const getPrecedingSelections = (optionIndex: number): string[] => {
    const selections: string[] = []
    for (let i = 0; i < optionIndex; i++) {
      const selVal = selectedOptionValues.get(options[i].id)
      if (selVal) selections.push(selVal)
    }
    return selections
  }

  const getValueAvailability = (
    optionId: string
  ): Map<string, OptionValueStatus> => {
    const optionIndex = options.findIndex((o) => o.id === optionId)
    if (optionIndex === -1) return new Map()

    const precedingSelections = getPrecedingSelections(optionIndex)
    const option = options[optionIndex]
    const optionValueIds = new Set((option.values ?? []).map((v) => v.id))
    const statusMap = new Map<string, OptionValueStatus>()

    for (const v of variants) {
      const valIds = getVariantOptionValueSet(v, variantValueIndex)
      if (!precedingSelections.every((sel) => valIds.has(sel))) continue
      for (const valId of valIds) {
        if (optionValueIds.has(valId))
          updateValueStatus(statusMap, valId, v.stock)
      }
    }
    return statusMap
  }

  const findMatchingVariant = (
    selections: Map<string, string>
  ): ProductVariant | undefined =>
    variants.find((v) => {
      const valIds = getVariantOptionValueSet(v, variantValueIndex)
      return [...selections.values()].every((sel) => valIds.has(sel))
    })

  const handleOptionChange = (optionId: string, valueId: string) => {
    const newSelections = new Map(selectedOptionValues)
    newSelections.set(optionId, valueId)

    const exactMatch = findMatchingVariant(newSelections)
    if (exactMatch) {
      onSelect(exactMatch)
      return
    }

    const changedIndex = options.findIndex((o) => o.id === optionId)
    for (const opt of options.slice(changedIndex + 1)) {
      newSelections.delete(opt.id)
    }
    const fallbackMatch =
      findMatchingVariant(newSelections) ??
      variants.find((v) =>
        getVariantOptionValueSet(v, variantValueIndex).has(valueId)
      )

    if (fallbackMatch) onSelect(fallbackMatch)
  }

  return (
    <div className="mb-6 space-y-5">
      <span
        className="block text-lg font-semibold text-[var(--foreground)]"
        id="variant-selector-label"
      >
        Choose Your Options
      </span>

      {options.map((option) => {
        const valueAvailability = getValueAvailability(option.id)
        return (
          <div key={option.id}>
            <span className="block text-sm font-semibold text-[var(--text-secondary)] mb-2">
              {option.name}
            </span>
            <div className="flex flex-wrap gap-2">
              {(option.values ?? [])
                .filter((val) => valueAvailability.has(val.id))
                .map((val) => {
                  const isActive =
                    selectedOptionValues.get(option.id) === val.id
                  const isOutOfStock =
                    valueAvailability.get(val.id) === 'outOfStock'
                  return (
                    <button
                      key={val.id}
                      type="button"
                      onClick={() => handleOptionChange(option.id, val.id)}
                      aria-pressed={isActive}
                      aria-label={
                        isOutOfStock ? `${val.value} — Out of stock` : val.value
                      }
                      className={getOptionButtonClassName(
                        isActive,
                        isOutOfStock
                      )}
                      title={
                        isOutOfStock ? `${val.value} — Out of stock` : undefined
                      }
                    >
                      {val.value}
                    </button>
                  )
                })}
            </div>
          </div>
        )
      })}

      {resolvedSelectedVariant && (
        <SelectedVariantSummary
          variant={resolvedSelectedVariant}
          label={getVariantLabel(resolvedSelectedVariant, valueMap)}
          formattedPrice={formatPrice(resolvedSelectedVariant.price)}
          cartQuantity={cartQuantities[resolvedSelectedVariant.id] ?? 0}
        />
      )}
    </div>
  )
}
