import { describe, it, expect } from 'vitest'
import {
  isPasswordStrong,
  validateProfileFields,
  validatePasswordFields,
  PROFILE_FIELDS,
  PASSWORD_FIELDS,
} from '@/app/account/account-shared'
import { PROFILE_ERRORS, PASSWORD_ERRORS } from '@/lib/constants/error-messages'

describe('account-shared', () => {
  describe('isPasswordStrong', () => {
    it('returns false for empty string', () => {
      expect(isPasswordStrong('')).toBe(false)
    })

    it('returns true for strong password', () => {
      expect(isPasswordStrong('SecurePass1!')).toBe(true)
    })

    it('returns false for weak password', () => {
      expect(isPasswordStrong('weak')).toBe(false)
    })
  })

  describe('validateProfileFields', () => {
    it('returns name error when empty', () => {
      const errors = validateProfileFields('', 'a@b.com', '')
      expect(errors.name).toBe(PROFILE_ERRORS.NAME_REQUIRED)
    })

    it('returns email required when empty', () => {
      const errors = validateProfileFields('Alice', '', '')
      expect(errors.email).toBe(PROFILE_ERRORS.EMAIL_REQUIRED)
    })

    it('returns email invalid for bad format', () => {
      const errors = validateProfileFields('Alice', 'notanemail', '')
      expect(errors.email).toBe(PROFILE_ERRORS.EMAIL_INVALID)
    })

    it('returns phone invalid for bad phone', () => {
      const errors = validateProfileFields('Alice', 'a@b.com', 'bad')
      expect(errors.phoneNumber).toBe(PROFILE_ERRORS.PHONE_INVALID)
    })

    it('returns no errors for valid inputs', () => {
      const errors = validateProfileFields('Alice', 'a@b.com', '+1234567890')
      expect(Object.keys(errors)).toHaveLength(0)
    })

    it('returns no errors for valid inputs without phone', () => {
      const errors = validateProfileFields('Alice', 'a@b.com', '')
      expect(Object.keys(errors)).toHaveLength(0)
    })
  })

  describe('validatePasswordFields', () => {
    it('returns currentPassword error when empty', () => {
      const errors = validatePasswordFields('', 'SecurePass1!', 'SecurePass1!')
      expect(errors.currentPassword).toBe(PASSWORD_ERRORS.CURRENT_REQUIRED)
    })

    it('returns newPassword error when empty', () => {
      const errors = validatePasswordFields('old', '', '')
      expect(errors.newPassword).toBe(PASSWORD_ERRORS.NEW_REQUIRED)
    })

    it('returns newPassword error for weak password', () => {
      const errors = validatePasswordFields('old', 'weak', 'weak')
      expect(errors.newPassword).toBe(PASSWORD_ERRORS.NEW_WEAK)
    })

    it('returns confirmNewPassword error when empty', () => {
      const errors = validatePasswordFields('old', 'SecurePass1!', '')
      expect(errors.confirmNewPassword).toBe(PASSWORD_ERRORS.CONFIRM_REQUIRED)
    })

    it('returns mismatch error when passwords differ', () => {
      const errors = validatePasswordFields(
        'old',
        'SecurePass1!',
        'Different1!'
      )
      expect(errors.confirmNewPassword).toBe(PASSWORD_ERRORS.CONFIRM_MISMATCH)
    })

    it('returns no errors for valid inputs', () => {
      const errors = validatePasswordFields(
        'old',
        'SecurePass1!',
        'SecurePass1!'
      )
      expect(Object.keys(errors)).toHaveLength(0)
    })
  })

  describe('PROFILE_FIELDS', () => {
    it('has three fields: name, email, phoneNumber', () => {
      expect(PROFILE_FIELDS).toHaveLength(3)
      expect(PROFILE_FIELDS.map((f) => f.name)).toEqual([
        'name',
        'email',
        'phoneNumber',
      ])
    })

    it('name validate returns error for empty', () => {
      const nameField = PROFILE_FIELDS.find((f) => f.name === 'name')!
      expect(nameField.validate!('', {})).toBe(PROFILE_ERRORS.NAME_REQUIRED)
    })

    it('name validate returns undefined for valid', () => {
      const nameField = PROFILE_FIELDS.find((f) => f.name === 'name')!
      expect(nameField.validate!('Alice', {})).toBeUndefined()
    })

    it('email validate returns error for empty', () => {
      const emailField = PROFILE_FIELDS.find((f) => f.name === 'email')!
      expect(emailField.validate!('', {})).toBe(PROFILE_ERRORS.EMAIL_REQUIRED)
    })

    it('email validate returns error for invalid', () => {
      const emailField = PROFILE_FIELDS.find((f) => f.name === 'email')!
      expect(emailField.validate!('bad', {})).toBe(PROFILE_ERRORS.EMAIL_INVALID)
    })

    it('email validate returns undefined for valid', () => {
      const emailField = PROFILE_FIELDS.find((f) => f.name === 'email')!
      expect(emailField.validate!('a@b.com', {})).toBeUndefined()
    })

    it('phone validate returns error for invalid', () => {
      const phoneField = PROFILE_FIELDS.find((f) => f.name === 'phoneNumber')!
      expect(phoneField.validate!('bad', {})).toBe(PROFILE_ERRORS.PHONE_INVALID)
    })

    it('phone validate returns undefined for valid phone', () => {
      const phoneField = PROFILE_FIELDS.find((f) => f.name === 'phoneNumber')!
      expect(phoneField.validate!('+1234567890', {})).toBeUndefined()
    })

    it('phone validate returns undefined for empty', () => {
      const phoneField = PROFILE_FIELDS.find((f) => f.name === 'phoneNumber')!
      expect(phoneField.validate!('', {})).toBeUndefined()
    })
  })

  describe('PASSWORD_FIELDS', () => {
    it('has three fields', () => {
      expect(PASSWORD_FIELDS).toHaveLength(3)
      expect(PASSWORD_FIELDS.map((f) => f.name)).toEqual([
        'currentPassword',
        'newPassword',
        'confirmNewPassword',
      ])
    })

    it('currentPassword validate returns error for empty', () => {
      const field = PASSWORD_FIELDS.find((f) => f.name === 'currentPassword')!
      expect(field.validate!('', {})).toBe(PASSWORD_ERRORS.CURRENT_REQUIRED)
    })

    it('currentPassword validate returns undefined for non-empty', () => {
      const field = PASSWORD_FIELDS.find((f) => f.name === 'currentPassword')!
      expect(field.validate!('something', {})).toBeUndefined()
    })

    it('newPassword validate returns error for empty', () => {
      const field = PASSWORD_FIELDS.find((f) => f.name === 'newPassword')!
      expect(field.validate!('', {})).toBe(PASSWORD_ERRORS.NEW_REQUIRED)
    })

    it('newPassword validate returns error for weak', () => {
      const field = PASSWORD_FIELDS.find((f) => f.name === 'newPassword')!
      expect(field.validate!('weak', {})).toBe(PASSWORD_ERRORS.NEW_WEAK)
    })

    it('newPassword validate returns undefined for strong', () => {
      const field = PASSWORD_FIELDS.find((f) => f.name === 'newPassword')!
      expect(field.validate!('SecurePass1!', {})).toBeUndefined()
    })

    it('confirmNewPassword validate returns error for empty', () => {
      const field = PASSWORD_FIELDS.find(
        (f) => f.name === 'confirmNewPassword'
      )!
      expect(field.validate!('', { newPassword: 'SecurePass1!' })).toBe(
        PASSWORD_ERRORS.CONFIRM_REQUIRED
      )
    })

    it('confirmNewPassword validate returns mismatch error', () => {
      const field = PASSWORD_FIELDS.find(
        (f) => f.name === 'confirmNewPassword'
      )!
      expect(
        field.validate!('Different1!', { newPassword: 'SecurePass1!' })
      ).toBe(PASSWORD_ERRORS.CONFIRM_MISMATCH)
    })

    it('confirmNewPassword validate returns undefined when matching', () => {
      const field = PASSWORD_FIELDS.find(
        (f) => f.name === 'confirmNewPassword'
      )!
      expect(
        field.validate!('SecurePass1!', { newPassword: 'SecurePass1!' })
      ).toBeUndefined()
    })
  })
})
