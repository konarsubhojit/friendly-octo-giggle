/**
 * Destination zones used to price shipping.
 *
 * A zone is derived from the destination state (and, for remote territories,
 * the postal code), which keeps the rate table small while still reflecting the
 * real cost difference between a local delivery and one to an island or a
 * north-eastern state.
 *
 * Dependency-free by design — see `./methods` for the same rationale.
 */
export const SHIPPING_ZONES = [
  'LOCAL',
  'REGIONAL',
  'NATIONAL',
  'REMOTE',
] as const

export type ShippingZoneName = (typeof SHIPPING_ZONES)[number]

/** Zone applied when the destination cannot be resolved (fail expensive). */
export const FALLBACK_SHIPPING_ZONE: ShippingZoneName = 'NATIONAL'

/** State the store despatches from; deliveries here are priced as LOCAL. */
export const STORE_ORIGIN_STATE = 'West Bengal'

/**
 * States sharing a despatch corridor with the origin state. Kept explicit
 * rather than derived so the commercial rule is reviewable.
 */
const REGIONAL_STATES = [
  'Bihar',
  'Jharkhand',
  'Odisha',
  'Sikkim',
  'Assam',
] as const

/** Territories that couriers surcharge and where transit is materially slower. */
const REMOTE_STATES = [
  'Andaman and Nicobar Islands',
  'Arunachal Pradesh',
  'Jammu and Kashmir',
  'Ladakh',
  'Lakshadweep',
  'Manipur',
  'Meghalaya',
  'Mizoram',
  'Nagaland',
  'Tripura',
] as const

/** Postal-code prefixes for remote circles, used when the state is missing. */
const REMOTE_PIN_PREFIXES = [
  '180',
  '181',
  '182',
  '190',
  '191',
  '192',
  '193',
  '194',
  '682',
  '744',
  '790',
  '791',
  '792',
  '795',
  '796',
  '797',
  '798',
  '799',
] as const

/** Collapse casing, punctuation and spacing so lookups are forgiving. */
export const normalizeStateName = (value: string | null | undefined): string =>
  typeof value === 'string'
    ? value
        .toLowerCase()
        .replaceAll('&', 'and')
        .replaceAll(/[^a-z]+/g, ' ')
        .trim()
    : ''

const toStateSet = (states: readonly string[]) =>
  new Set(states.map(normalizeStateName))

const REGIONAL_STATE_SET = toStateSet(REGIONAL_STATES)
const REMOTE_STATE_SET = toStateSet(REMOTE_STATES)
const ORIGIN_STATE_KEY = normalizeStateName(STORE_ORIGIN_STATE)

/** Keep only the digits so " 700 001" and "700001" resolve identically. */
const normalizePinCode = (value: string | null | undefined): string =>
  typeof value === 'string' ? value.replace(/\D/g, '') : ''

const isRemotePinCode = (pinCode: string): boolean =>
  pinCode.length === 6 &&
  REMOTE_PIN_PREFIXES.some((prefix) => pinCode.startsWith(prefix))

export interface ShippingDestination {
  readonly state?: string | null
  readonly pinCode?: string | null
}

/**
 * Resolve the zone for a destination. Remote territories win over the origin
 * state so a mis-typed state cannot accidentally price a remote delivery as
 * local. An unresolvable destination falls back to NATIONAL rather than LOCAL
 * so the store never under-charges.
 */
export const resolveShippingZone = (
  destination: ShippingDestination
): ShippingZoneName => {
  const stateKey = normalizeStateName(destination.state)
  const pinCode = normalizePinCode(destination.pinCode)

  if (REMOTE_STATE_SET.has(stateKey) || isRemotePinCode(pinCode)) {
    return 'REMOTE'
  }
  if (stateKey === ORIGIN_STATE_KEY) {
    return 'LOCAL'
  }
  if (REGIONAL_STATE_SET.has(stateKey)) {
    return 'REGIONAL'
  }
  if (stateKey.length === 0) {
    return FALLBACK_SHIPPING_ZONE
  }
  return 'NATIONAL'
}

/** True when the destination is in the same state the store despatches from. */
export const isIntraStateDestination = (
  destination: ShippingDestination
): boolean => normalizeStateName(destination.state) === ORIGIN_STATE_KEY
