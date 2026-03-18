/**
 * Tests for the account page helper functions and view/edit behaviour.
 * The page component itself is a Next.js Server Component wrapper, so we
 * test the exported pure helper functions directly.
 */
import { describe, it, expect } from 'vitest';
import { validateProfileFields, validatePasswordFields, isPasswordStrong } from '@/app/account/page';
import { PROFILE_ERRORS, PASSWORD_ERRORS } from '@/lib/constants/error-messages';
describe('isPasswordStrong', () => {
  it('returns false for an empty password', () => {
    expect(isPasswordStrong('')).toBe(false);
  });

  it('returns false for a password missing uppercase', () => {
    expect(isPasswordStrong('password1!')).toBe(false);
  });

  it('returns false for a password missing a digit', () => {
    expect(isPasswordStrong('Password!')).toBe(false);
  });

  it('returns false for a password missing a special character', () => {
    expect(isPasswordStrong('Password1')).toBe(false);
  });

  it('returns false for a password that is too short', () => {
    expect(isPasswordStrong('P1!a')).toBe(false);
  });

  it('returns true for a fully valid password', () => {
    expect(isPasswordStrong('SecurePass1!')).toBe(true);
  });
});
describe('validateProfileFields', () => {
  it('returns name error when name is empty', () => {
    const errors = validateProfileFields('', 'user@example.com', '');
    expect(errors.name).toBe(PROFILE_ERRORS.NAME_REQUIRED);
  });

  it('returns email error when email is empty', () => {
    const errors = validateProfileFields('Alice', '', '');
    expect(errors.email).toBe(PROFILE_ERRORS.EMAIL_REQUIRED);
  });

  it('returns email error for an invalid email', () => {
    const errors = validateProfileFields('Alice', 'not-an-email', '');
    expect(errors.email).toBe(PROFILE_ERRORS.EMAIL_INVALID);
  });

  it('returns phone error for an invalid phone number', () => {
    const errors = validateProfileFields('Alice', 'alice@example.com', 'bad-phone');
    expect(errors.phoneNumber).toBe(PROFILE_ERRORS.PHONE_INVALID);
  });

  it('returns no errors for valid name, email and empty phone', () => {
    const errors = validateProfileFields('Alice', 'alice@example.com', '');
    expect(Object.keys(errors)).toHaveLength(0);
  });

  it('returns no errors for valid name, email and valid phone', () => {
    const errors = validateProfileFields('Alice', 'alice@example.com', '+12345678901');
    expect(Object.keys(errors)).toHaveLength(0);
  });

  it('trims whitespace before checking name', () => {
    const errors = validateProfileFields('   ', 'alice@example.com', '');
    expect(errors.name).toBe(PROFILE_ERRORS.NAME_REQUIRED);
  });

  it('allows phone numbers without country code prefix', () => {
    const errors = validateProfileFields('Alice', 'alice@example.com', '1234567890');
    expect(errors.phoneNumber).toBeUndefined();
  });
});
describe('validatePasswordFields', () => {
  it('returns currentPassword error when empty', () => {
    const errors = validatePasswordFields('', 'SecurePass1!', 'SecurePass1!');
    expect(errors.currentPassword).toBe(PASSWORD_ERRORS.CURRENT_REQUIRED);
  });

  it('returns newPassword error when empty', () => {
    const errors = validatePasswordFields('oldPass1!', '', '');
    expect(errors.newPassword).toBe(PASSWORD_ERRORS.NEW_REQUIRED);
  });

  it('returns newPassword error when password is not strong enough', () => {
    const errors = validatePasswordFields('oldPass1!', 'weakpass', 'weakpass');
    expect(errors.newPassword).toBe(PASSWORD_ERRORS.NEW_WEAK);
  });

  it('returns confirmNewPassword error when empty', () => {
    const errors = validatePasswordFields('oldPass1!', 'SecurePass1!', '');
    expect(errors.confirmNewPassword).toBe(PASSWORD_ERRORS.CONFIRM_REQUIRED);
  });

  it("returns confirmNewPassword error when passwords don't match", () => {
    const errors = validatePasswordFields('oldPass1!', 'SecurePass1!', 'DifferentPass1!');
    expect(errors.confirmNewPassword).toBe(PASSWORD_ERRORS.CONFIRM_MISMATCH);
  });

  it('returns no errors for valid inputs', () => {
    const errors = validatePasswordFields('oldPass1!', 'SecurePass1!', 'SecurePass1!');
    expect(Object.keys(errors)).toHaveLength(0);
  });
});
