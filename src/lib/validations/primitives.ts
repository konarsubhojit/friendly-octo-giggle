// Shared primitive regex patterns used across feature validation schemas.
import { MAX_MONEY_AMOUNT, MONEY_DECIMAL_PLACES } from '../money'

/**
 * Money precision guard shared by every schema that accepts a monetary amount.
 * Money is persisted as `numeric(12, 2)`, so anything with more than two
 * decimal places (or outside the column range) must be rejected at the edge
 * rather than silently rounded on write.
 */
export const hasMoneyPrecision = (value: number): boolean => {
  if (!Number.isFinite(value)) return false
  if (Math.abs(value) > MAX_MONEY_AMOUNT) return false
  const scaled = value * 10 ** MONEY_DECIMAL_PLACES
  return Math.abs(scaled - Math.round(scaled)) < 1e-6
}

export const MONEY_PRECISION_MESSAGE = `Amount supports at most ${MONEY_DECIMAL_PLACES} decimal places`

export { MAX_MONEY_AMOUNT }

export const SHORT_ID_REGEX = /^[0-9A-Za-z]{7}$/
export const ORDER_ID_REGEX = /^ORD[0-9A-Za-z]{7}$/
export const URL_REGEX = /^https?:\/\/.+/
export const ISO_DATETIME_REGEX =
  /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d{3})?Z$/
export const EMAIL_REGEX =
  /^[a-zA-Z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(?:\.[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)*$/
// Phone number regex: optional + prefix, country code (1-9), then 6-14 digits
export const PHONE_REGEX = /^\+?[1-9]\d{6,14}$/
// Password must be min 8 chars, with uppercase, lowercase, number, and special char
export const PASSWORD_REGEX =
  /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[!@#$%^&*()_+\-=[\]{};':"\\|,.<>/?]).{8,}$/

// Password requirement descriptions for UI display (auth + account pages).
export const PASSWORD_REQUIREMENTS = [
  { label: 'At least 8 characters', test: (p: string) => p.length >= 8 },
  { label: 'One uppercase letter', test: (p: string) => /[A-Z]/.test(p) },
  { label: 'One lowercase letter', test: (p: string) => /[a-z]/.test(p) },
  { label: 'One number', test: (p: string) => /\d/.test(p) },
  {
    label: 'One special character',
    test: (p: string) => /[!@#$%^&*()_+\-=[\]{};':"\\|,.<>/?]/.test(p),
  },
] as const
