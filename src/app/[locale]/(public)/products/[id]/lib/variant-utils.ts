import { Product, ProductVariant } from '@/lib/types'

export const getFirstVariant = (product: Product): ProductVariant | null =>
  product.variants?.[0] ?? null

export const resolveInitialVariant = (
  product: Product,
  variantId: string | null
): ProductVariant | null => {
  const first = getFirstVariant(product)
  if (!variantId) return first
  return product.variants?.find((v) => v.id === variantId) ?? first
}

export const getClampedQtyState = (
  quantity: number,
  stock: number
): { qty: number; message: string } => {
  if (stock === 0) return { qty: quantity, message: '' }
  if (quantity > stock)
    return { qty: stock, message: `Only ${stock} available` }
  return { qty: quantity, message: '' }
}

export type OptionValueStatus = 'available' | 'outOfStock'

const BUTTON_BASE =
  'px-4 py-2 rounded-lg text-sm font-semibold transition-all duration-200'
const BUTTON_OOS_ACTIVE = `${BUTTON_BASE} bg-[var(--surface)] text-[var(--text-muted)] border-2 border-[var(--text-muted)] line-through shadow-sm`
const BUTTON_OOS_INACTIVE = `${BUTTON_BASE} bg-[var(--surface)] text-[var(--text-muted)] border border-[var(--border-warm)] line-through hover:border-[var(--text-muted)]`
const BUTTON_ACTIVE = `${BUTTON_BASE} bg-[var(--accent-warm)] text-white shadow-warm`
const BUTTON_INACTIVE = `${BUTTON_BASE} bg-[var(--accent-cream)] text-[var(--text-secondary)] border border-[var(--border-warm)] hover:border-[var(--accent-warm)]`

/** Resolve the CSS class for an option button based on active & stock state. */
export const getOptionButtonClassName = (
  isActive: boolean,
  isOutOfStock: boolean
): string => {
  if (isOutOfStock) {
    return isActive ? BUTTON_OOS_ACTIVE : BUTTON_OOS_INACTIVE
  }
  return isActive ? BUTTON_ACTIVE : BUTTON_INACTIVE
}

/** Build a lookup from option-value ID → display string. */
export const buildValueMap = (
  options: NonNullable<Product['options']>
): Map<string, string> => {
  const m = new Map<string, string>()
  for (const opt of options) {
    for (const val of opt.values ?? []) {
      m.set(val.id, val.value)
    }
  }
  return m
}

/** Build a human-readable label for a variant from its option values. */
export const getVariantLabel = (
  variant: ProductVariant,
  valueMap: Map<string, string>
): string => {
  const fallback = variant.sku ?? 'Variant'
  if (!variant.optionValues || variant.optionValues.length === 0) {
    return fallback
  }
  const parts = variant.optionValues
    .map((ov) => valueMap.get(ov.id))
    .filter(Boolean)
  return parts.length > 0 ? parts.join(' / ') : fallback
}

/** Map each option ID to the currently-selected option-value ID. */
export const buildSelectedOptionValues = (
  selectedVariant: ProductVariant | null,
  options: NonNullable<Product['options']>
): Map<string, string> => {
  const m = new Map<string, string>()
  if (!selectedVariant?.optionValues) return m
  for (const ov of selectedVariant.optionValues) {
    for (const opt of options) {
      if (opt.values?.some((v) => v.id === ov.id)) {
        m.set(opt.id, ov.id)
      }
    }
  }
  return m
}

/** Pre-index variant option value IDs as Sets for O(1) lookup. */
export const buildVariantValueIndex = (
  variants: ProductVariant[]
): Map<string, Set<string>> =>
  new Map(
    variants.map((v) => [
      v.id,
      new Set(v.optionValues?.map((ov) => ov.id) ?? []),
    ])
  )

export const getVariantOptionValueSet = (
  variant: ProductVariant,
  index: Map<string, Set<string>>
): Set<string> => index.get(variant.id) ?? new Set()

/** Update a status map with a single value's stock status (available wins). */
export const updateValueStatus = (
  statusMap: Map<string, OptionValueStatus>,
  valId: string,
  stock: number
): void => {
  if (statusMap.get(valId) === 'available') return
  statusMap.set(valId, stock > 0 ? 'available' : 'outOfStock')
}

/**
 * Auto-derive ProductOption[] and patch variant optionValues from SKU segments.
 *
 * Given variants with SKUs like "Red-L", "Red-XL", "Blue-L", tries to detect
 * a consistent split pattern and creates synthetic option dimensions. Returns
 * null if SKUs don't form a consistent pattern (varying segment counts, missing
 * SKUs, or only 1 segment).
 */
export const deriveOptionsFromSkus = (
  variants: ProductVariant[],
  delimiter = '-'
): {
  options: NonNullable<Product['options']>
  variants: ProductVariant[]
} | null => {
  if (variants.length === 0) return null

  // Split each variant's SKU
  const parsed: { variant: ProductVariant; segments: string[] }[] = []
  for (const v of variants) {
    if (!v.sku) return null
    const segments = v.sku.split(delimiter).map((s) => s.trim())
    if (segments.length < 2) return null
    parsed.push({ variant: v, segments })
  }

  // Ensure all SKUs split into the same number of segments
  const segmentCount = parsed[0].segments.length
  if (parsed.some((p) => p.segments.length !== segmentCount)) return null

  // Collect unique values per dimension
  const valuesPerDimension: Set<string>[] = Array.from(
    { length: segmentCount },
    () => new Set<string>()
  )
  for (const { segments } of parsed) {
    for (let i = 0; i < segments.length; i++) {
      valuesPerDimension[i].add(segments[i])
    }
  }

  // Only derive if at least one dimension has >1 unique value
  if (valuesPerDimension.every((s) => s.size <= 1)) return null

  // Build synthetic options with stable IDs
  const options: NonNullable<Product['options']> = valuesPerDimension.map(
    (values, dimIdx) => {
      const sortedValues = [...values]
      return {
        id: `_derived_opt_${dimIdx}`,
        productId: '',
        name: `Option ${dimIdx + 1}`,
        sortOrder: dimIdx,
        createdAt: '',
        values: sortedValues.map((value, valIdx) => ({
          id: `_derived_val_${dimIdx}_${valIdx}`,
          optionId: `_derived_opt_${dimIdx}`,
          value,
          sortOrder: valIdx,
          createdAt: '',
        })),
      }
    }
  )

  // Build a value lookup: "dimIdx:segmentValue" → synthetic optionValue id
  const valueLookup = new Map<string, string>()
  for (const opt of options) {
    const dimIdx = options.indexOf(opt)
    for (const val of opt.values) {
      valueLookup.set(`${dimIdx}:${val.value}`, val.id)
    }
  }

  // Patch each variant with synthetic optionValues
  const patchedVariants = parsed.map(({ variant, segments }) => {
    const optionValues = segments
      .map((seg, i) => {
        const valId = valueLookup.get(`${i}:${seg}`)
        if (!valId) return null
        return {
          id: valId,
          optionId: `_derived_opt_${i}`,
          value: seg,
          sortOrder: 0,
          createdAt: '',
        }
      })
      .filter((v): v is NonNullable<typeof v> => v !== null)
    return { ...variant, optionValues }
  })

  return { options, variants: patchedVariants }
}
