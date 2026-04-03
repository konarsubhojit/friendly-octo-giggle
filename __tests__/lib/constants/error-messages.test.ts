import { describe, it, expect } from 'vitest'
import {
  PROFILE_ERRORS,
  PASSWORD_ERRORS,
  PRODUCT_ERRORS,
  API_ERRORS,
} from '@/lib/constants/error-messages'

describe('PROFILE_ERRORS', () => {
  it('has NAME_REQUIRED message', () => {
    expect(PROFILE_ERRORS.NAME_REQUIRED).toBe('Name is required.')
  })
  it('has EMAIL_REQUIRED message', () => {
    expect(PROFILE_ERRORS.EMAIL_REQUIRED).toBe('Email is required.')
  })
  it('has EMAIL_INVALID message', () => {
    expect(PROFILE_ERRORS.EMAIL_INVALID).toBe('Enter a valid email address.')
  })
  it('has PHONE_INVALID message', () => {
    expect(PROFILE_ERRORS.PHONE_INVALID).toContain('+1234567890')
  })
})

describe('PASSWORD_ERRORS', () => {
  it('has CURRENT_REQUIRED message', () => {
    expect(PASSWORD_ERRORS.CURRENT_REQUIRED).toBeTruthy()
  })
  it('has NEW_REQUIRED message', () => {
    expect(PASSWORD_ERRORS.NEW_REQUIRED).toBeTruthy()
  })
  it('has NEW_WEAK message', () => {
    expect(PASSWORD_ERRORS.NEW_WEAK).toBeTruthy()
  })
  it('has CONFIRM_REQUIRED message', () => {
    expect(PASSWORD_ERRORS.CONFIRM_REQUIRED).toBeTruthy()
  })
  it('has CONFIRM_MISMATCH message', () => {
    expect(PASSWORD_ERRORS.CONFIRM_MISMATCH).toContain('match')
  })
})

describe('PRODUCT_ERRORS', () => {
  it('has NAME_REQUIRED', () => {
    expect(PRODUCT_ERRORS.NAME_REQUIRED).toBeTruthy()
  })
  it('has NAME_TOO_SHORT', () => {
    expect(PRODUCT_ERRORS.NAME_TOO_SHORT).toContain('2')
  })
  it('has IMAGE_REQUIRED', () => {
    expect(PRODUCT_ERRORS.IMAGE_REQUIRED).toBeTruthy()
  })
  it('IMAGE_TYPE_INVALID is a function returning a message', () => {
    const msg = PRODUCT_ERRORS.IMAGE_TYPE_INVALID('JPG, PNG')
    expect(msg).toContain('JPG, PNG')
  })
  it('IMAGE_SIZE_EXCEEDED is a function returning a message with the limit', () => {
    const msg = PRODUCT_ERRORS.IMAGE_SIZE_EXCEEDED(5)
    expect(msg).toContain('5MB')
  })
})

describe('API_ERRORS', () => {
  it('has PROFILE_LOAD message', () => {
    expect(API_ERRORS.PROFILE_LOAD).toBeTruthy()
  })
  it('has PROFILE_UPDATE message', () => {
    expect(API_ERRORS.PROFILE_UPDATE).toBeTruthy()
  })
  it('has AUTH_CHANGE_FAILED message', () => {
    expect(API_ERRORS.AUTH_CHANGE_FAILED).toBeTruthy()
  })
  it('has PRODUCT_SAVE message', () => {
    expect(API_ERRORS.PRODUCT_SAVE).toBeTruthy()
  })
  it('has IMAGE_UPLOAD message', () => {
    expect(API_ERRORS.IMAGE_UPLOAD).toBeTruthy()
  })
})
