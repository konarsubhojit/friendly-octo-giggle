/**
 * Tests for src/server/pincode-loader.ts
 *
 * Verifies the exported functions behave correctly. The loader forces the CJS
 * build of `india-pincode` (so `__dirname` is always defined at runtime) and
 * re-exports `getIndiaPincode` and `isValidPincode` from it.
 */
import { describe, it, expect } from 'vitest'
import { getIndiaPincode, isValidPincode } from '@/server/pincode-loader'

describe('isValidPincode', () => {
  it('is exported as a function', () => {
    expect(typeof isValidPincode).toBe('function')
  })

  it('returns true for a valid 6-digit pincode', () => {
    expect(isValidPincode('560001')).toBe(true)
  })

  it('returns true for another valid pincode', () => {
    expect(isValidPincode('110001')).toBe(true)
  })

  it('returns false for a 5-digit code (too short)', () => {
    expect(isValidPincode('56000')).toBe(false)
  })

  it('returns false for a 7-digit code (too long)', () => {
    expect(isValidPincode('5600011')).toBe(false)
  })

  it('returns false for a code containing letters', () => {
    expect(isValidPincode('ABCDEF')).toBe(false)
  })

  it('returns false for an empty string', () => {
    expect(isValidPincode('')).toBe(false)
  })

  it('returns false for a code with special characters', () => {
    expect(isValidPincode('56-001')).toBe(false)
  })
})

describe('getIndiaPincode', () => {
  it('is exported as a function', () => {
    expect(typeof getIndiaPincode).toBe('function')
  })

  it('returns an object with a getPincodeSummary method', () => {
    const instance = getIndiaPincode()
    expect(instance).toHaveProperty('getPincodeSummary')
    expect(typeof instance.getPincodeSummary).toBe('function')
  })

  it('returns an instance that can look up a known pincode without __dirname errors', () => {
    const instance = getIndiaPincode()
    const result = instance.getPincodeSummary('110001')
    expect(result.success).toBe(true)
    expect(result.data).toBeTruthy()
  })
})
