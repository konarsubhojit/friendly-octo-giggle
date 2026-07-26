/**
 * Server-side tax computation.
 *
 * Tax is never taken from the client: it is recomputed from the destination and
 * the priced cart every time an order is created, so the stored tax line and
 * the amount captured by the payment provider always agree.
 */
import { roundMoney, sumMoney } from '@/lib/money'
import {
  isIntraStateDestination,
  type ShippingDestination,
} from '@/lib/shipping'
import {
  resolveTaxJurisdiction,
  type TaxJurisdiction,
  type TaxRegimeName,
} from './jurisdictions'

export {
  TAX_REGIMES,
  INDIA_GST,
  TAX_EXEMPT,
  resolveTaxJurisdiction,
} from './jurisdictions'
export type { TaxJurisdiction, TaxRegimeName } from './jurisdictions'

export interface TaxComponent {
  readonly name: string
  /** Rate as a fraction (0.025 = 2.5%). */
  readonly rate: number
  readonly amount: number
}

export interface TaxBreakdown {
  readonly regime: TaxRegimeName
  /** Combined rate applied to the taxable value. */
  readonly rate: number
  readonly taxableAmount: number
  readonly amount: number
  readonly components: readonly TaxComponent[]
}

export interface TaxCalculationInput {
  readonly subtotal: number
  readonly shippingAmount?: number
  readonly destination: ShippingDestination & {
    readonly country?: string | null
  }
}

/**
 * Split the total tax across its components so the rounded parts always add up
 * to the rounded total (the last component absorbs the rounding remainder).
 */
const splitTaxComponents = (
  names: readonly string[],
  totalRate: number,
  totalAmount: number
): TaxComponent[] => {
  if (names.length === 0) return []

  const componentRate = totalRate / names.length
  const components: TaxComponent[] = []
  let allocated = 0

  names.forEach((name, index) => {
    const isLast = index === names.length - 1
    const amount = isLast
      ? roundMoney(totalAmount - allocated)
      : roundMoney(totalAmount / names.length)
    allocated = roundMoney(allocated + amount)
    components.push({ name, rate: componentRate, amount })
  })

  return components
}

const buildComponents = (
  jurisdiction: TaxJurisdiction,
  destination: ShippingDestination,
  amount: number
): TaxComponent[] => {
  if (jurisdiction.regime === 'NONE' || amount === 0) return []

  return isIntraStateDestination(destination)
    ? splitTaxComponents(
        jurisdiction.intraStateComponents,
        jurisdiction.rate,
        amount
      )
    : splitTaxComponents(
        [jurisdiction.interStateComponent],
        jurisdiction.rate,
        amount
      )
}

/** Compute the tax due on a priced cart. */
export const calculateTax = ({
  subtotal,
  shippingAmount = 0,
  destination,
}: TaxCalculationInput): TaxBreakdown => {
  const jurisdiction = resolveTaxJurisdiction(destination.country)
  const taxableAmount = jurisdiction.taxesShipping
    ? sumMoney([subtotal, shippingAmount])
    : roundMoney(subtotal)
  const amount = roundMoney(taxableAmount * jurisdiction.rate)

  return {
    regime: jurisdiction.regime,
    rate: jurisdiction.rate,
    taxableAmount,
    amount,
    components: buildComponents(jurisdiction, destination, amount),
  }
}
