/**
 * Tax jurisdictions and their rules.
 *
 * India's GST splits a single rate into CGST + SGST when the supply stays
 * within the origin state, and charges it as a single IGST line otherwise. The
 * total is identical either way; the split matters for the invoice, so it is
 * modelled explicitly rather than collapsed into one number.
 *
 * Dependency-free by design so it can be imported from validation schemas and
 * client bundles.
 */
export const TAX_REGIMES = ['GST', 'NONE'] as const

export type TaxRegimeName = (typeof TAX_REGIMES)[number]

export interface TaxJurisdiction {
  readonly regime: TaxRegimeName
  /** Combined rate as a fraction (0.05 = 5%). */
  readonly rate: number
  /** Component names used when the supply is intra-state. */
  readonly intraStateComponents: readonly string[]
  /** Component name used when the supply crosses state lines. */
  readonly interStateComponent: string
  /** Whether the shipping charge is part of the taxable value. */
  readonly taxesShipping: boolean
}

/**
 * The single jurisdiction the store currently sells from. Adding a market means
 * adding an entry here and resolving it from the destination country.
 */
export const INDIA_GST: TaxJurisdiction = {
  regime: 'GST',
  rate: 0.05,
  intraStateComponents: ['CGST', 'SGST'],
  interStateComponent: 'IGST',
  taxesShipping: true,
}

export const TAX_EXEMPT: TaxJurisdiction = {
  regime: 'NONE',
  rate: 0,
  intraStateComponents: [],
  interStateComponent: '',
  taxesShipping: false,
}

/** Resolve the jurisdiction for a destination. Defaults to the home market. */
export const resolveTaxJurisdiction = (
  countryCode?: string | null
): TaxJurisdiction => {
  const normalized =
    typeof countryCode === 'string' ? countryCode.trim().toUpperCase() : ''

  if (normalized.length === 0 || normalized === 'IN' || normalized === 'IND') {
    return INDIA_GST
  }
  return TAX_EXEMPT
}
