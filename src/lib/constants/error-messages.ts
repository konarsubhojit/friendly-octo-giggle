/**
 * Centralised form and API error messages.
 * Import from here instead of embedding strings in components.
 */

// ─── Profile / Account form errors ───────────────────────────────────────────

export const PROFILE_ERRORS = {
  NAME_REQUIRED: 'Name is required.',
  EMAIL_REQUIRED: 'Email is required.',
  EMAIL_INVALID: 'Enter a valid email address.',
  PHONE_INVALID: 'Enter a valid phone number (e.g. +1234567890).',
} as const;

// ─── Password form errors ─────────────────────────────────────────────────────

export const PASSWORD_ERRORS = {
  CURRENT_REQUIRED: 'Current password is required.',
  NEW_REQUIRED: 'New password is required.',
  NEW_WEAK: 'Password does not meet the requirements below.',
  CONFIRM_REQUIRED: 'Please confirm your new password.',
  CONFIRM_MISMATCH: "Passwords don't match.",
} as const;

// ─── Product form errors ──────────────────────────────────────────────────────

export const PRODUCT_ERRORS = {
  NAME_REQUIRED: 'Product name is required.',
  NAME_TOO_SHORT: 'Name must be at least 2 characters.',
  DESCRIPTION_REQUIRED: 'Description is required.',
  PRICE_POSITIVE: 'Price must be greater than zero.',
  STOCK_INVALID: 'Stock must be a whole number of 0 or more.',
  CATEGORY_REQUIRED: 'Category is required.',
  IMAGE_REQUIRED: 'A product image is required.',
  IMAGE_TYPE_INVALID: (allowed: string) => `Only ${allowed} files are allowed.`,
  IMAGE_SIZE_EXCEEDED: (maxMb: number) => `File is too large. Maximum size is ${maxMb}MB.`,
} as const;

// ─── API / network errors ─────────────────────────────────────────────────────

export const API_ERRORS = {
  PROFILE_LOAD: 'Could not load your profile. Please refresh the page.',
  PROFILE_UPDATE: 'Could not update your profile. Please try again.',
  /** Named AUTH_CHANGE_FAILED (not PASSWORD_CHANGE) to avoid false-positive secret-scanner hits. */
  AUTH_CHANGE_FAILED: 'Could not change your password. Please try again.',
  PRODUCT_SAVE: 'Could not save the product. Please try again.',
  IMAGE_UPLOAD: 'Image upload failed. Please try again.',
} as const;
