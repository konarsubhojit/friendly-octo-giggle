// Shared primitive regex patterns used across feature validation schemas.
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
