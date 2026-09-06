/**
 * Centralised monetary helpers.
 *
 * Money is persisted as exact decimals (`numeric(12, 2)`) rather than floating
 * point, and every calculation in the application goes through these helpers so
 * that totals, payment-gateway amounts, currency conversion and exports all
 * round-trip through the same rounding rules.
 *
 * The canonical in-memory representation stays a JavaScript `number` holding a
 * major-unit amount (e.g. `199.5` rupees). Arithmetic is performed on integer
 * minor units (paise/cents) to avoid binary floating point drift.
 */

/** Number of decimal places persisted for monetary columns. */
export const MONEY_DECIMAL_PLACES = 2

/** Minor units contained in one major unit (100 paise = 1 rupee). */
export const MINOR_UNITS_PER_MAJOR_UNIT = 100

/** Largest amount representable by a `numeric(12, 2)` column. */
export const MAX_MONEY_AMOUNT = 9_999_999_999.99

/** Thrown when an amount cannot be represented exactly as minor units. */
export class MoneyRangeError extends RangeError {
  constructor(message = 'Monetary amount is out of the supported range') {
    super(message)
    this.name = 'MoneyRangeError'
  }
}

const assertSafeMinorUnits = (minorUnits: number): number => {
  if (!Number.isSafeInteger(minorUnits)) {
    throw new MoneyRangeError()
  }
  return minorUnits
}

/**
 * Convert a major-unit amount to integer minor units, rounding to the nearest
 * minor unit. The magnitude is rounded independently of the sign so positive
 * and negative amounts round symmetrically.
 */
export const toMinorUnits = (amount: number): number => {
  if (typeof amount !== 'number' || !Number.isFinite(amount)) {
    throw new MoneyRangeError('Monetary amount must be a finite number')
  }

  // `toFixed` switches to exponential notation above 1e21, which would parse
  // into a completely different (silently wrong) value below.
  if (Math.abs(amount) > MAX_MONEY_AMOUNT) {
    throw new MoneyRangeError()
  }

  const sign = amount < 0 ? -1 : 1
  const [whole, fraction = ''] = Math.abs(amount)
    .toFixed(MONEY_DECIMAL_PLACES)
    .split('.')
  const digits = `${whole}${fraction
    .padEnd(MONEY_DECIMAL_PLACES, '0')
    .slice(0, MONEY_DECIMAL_PLACES)}`

  return assertSafeMinorUnits(sign * Number.parseInt(digits, 10))
}

/** Convert integer minor units back to a major-unit amount. */
export const fromMinorUnits = (minorUnits: number): number => {
  if (typeof minorUnits !== 'number' || !Number.isInteger(minorUnits)) {
    throw new MoneyRangeError('Minor units must be an integer')
  }
  return assertSafeMinorUnits(minorUnits) / MINOR_UNITS_PER_MAJOR_UNIT
}

/** Normalise an amount to the persisted precision. */
export const roundMoney = (amount: number): number =>
  fromMinorUnits(toMinorUnits(amount))

/** Sum amounts without accumulating floating point error. */
export const sumMoney = (amounts: readonly number[]): number =>
  fromMinorUnits(
    amounts.reduce(
      (total, amount) => assertSafeMinorUnits(total + toMinorUnits(amount)),
      0
    )
  )

/** Multiply an amount by an integer quantity (e.g. a line item). */
export const multiplyMoney = (amount: number, quantity: number): number => {
  if (!Number.isInteger(quantity)) {
    throw new MoneyRangeError('Quantity must be an integer')
  }
  return fromMinorUnits(assertSafeMinorUnits(toMinorUnits(amount) * quantity))
}

/**
 * Split an amount across weighted shares so that the parts sum back to the
 * original exactly.
 *
 * Rounding each share independently does not conserve the total: a ₹10.00
 * discount across three equal lines yields 3 × ₹3.33 = ₹9.99, quietly losing a
 * paisa. This uses largest-remainder allocation over integer minor units —
 * each share takes its floor, then the leftover minor units go one apiece to
 * the shares with the largest fractional parts. Ties break by ascending index,
 * so the same input always produces the same split.
 *
 * `sum(allocateMoney(total, weights)) === roundMoney(total)` holds for every
 * input, which is what lets a partial refund reconcile against the amount
 * originally captured.
 *
 * Weights need not sum to anything in particular; only their ratios matter.
 * When every weight is zero there is no proportional signal, so the remainder
 * rule alone distributes the total from the first share onward.
 */
export const allocateMoney = (
  total: number,
  weights: readonly number[]
): number[] => {
  if (weights.length === 0) return []

  const totalMinor = toMinorUnits(total)
  if (totalMinor < 0) {
    throw new MoneyRangeError('Allocation total must not be negative')
  }

  const rawWeights = weights.map((weight) => {
    const value = toMinorUnits(weight)
    if (value < 0) {
      throw new MoneyRangeError('Allocation weights must not be negative')
    }
    return value
  })

  // With no proportional signal, fall back to an even split rather than
  // leaving the remainder loop unable to place more than one minor unit per
  // share — which would silently allocate far less than the total.
  const rawSum = rawWeights.reduce((sum, value) => sum + value, 0)
  const weightMinor = rawSum === 0 ? rawWeights.map(() => 1) : rawWeights
  const weightSum = rawSum === 0 ? weightMinor.length : rawSum

  // Floor each share, tracking the discarded fraction so the leftover minor
  // units can be handed to the shares that lost the most to rounding.
  const shares = weightMinor.map((weight, index) => {
    const exact = (totalMinor * weight) / weightSum
    const floor = Math.floor(exact)
    return { index, floor, remainder: exact - floor }
  })

  const allocated = shares.reduce((sum, share) => sum + share.floor, 0)
  let leftover = totalMinor - allocated

  // Largest remainder first; ascending index breaks ties deterministically.
  const order = [...shares].sort(
    (a, b) => b.remainder - a.remainder || a.index - b.index
  )

  const result = shares.map((share) => share.floor)
  for (const share of order) {
    if (leftover <= 0) break
    result[share.index] += 1
    leftover -= 1
  }

  return result.map(fromMinorUnits)
}

/**
 * Apply a non-integer factor (such as an exchange rate) and round the result
 * back to the persisted precision.
 */
export const convertMoney = (amount: number, rate: number): number => {
  if (!Number.isFinite(rate)) {
    throw new MoneyRangeError('Conversion rate must be a finite number')
  }
  return fromMinorUnits(Math.round(toMinorUnits(amount) * rate))
}

/**
 * Render an amount as a plain, fixed-precision decimal string. Used for CSV
 * exports and any other place that must round-trip exactly.
 */
export const formatMoneyValue = (amount: number): string =>
  (toMinorUnits(amount) / MINOR_UNITS_PER_MAJOR_UNIT).toFixed(
    MONEY_DECIMAL_PLACES
  )

/**
 * Parse a monetary value coming from the database driver, an API payload or a
 * form field. Returns `null` when the value is not a valid amount.
 */
export const parseMoney = (value: unknown): number | null => {
  const raw =
    typeof value === 'number'
      ? value
      : typeof value === 'string' && value.trim()
        ? Number(value.trim())
        : null

  if (raw === null || !Number.isFinite(raw) || !isSupportedMoneyAmount(raw)) {
    return null
  }
  return roundMoney(raw)
}

/** True when the amount fits the persisted `numeric(12, 2)` range. */
export const isSupportedMoneyAmount = (amount: number): boolean => {
  if (!Number.isFinite(amount)) return false
  return Math.abs(amount) <= MAX_MONEY_AMOUNT
}
