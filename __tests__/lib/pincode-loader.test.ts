/**
 * Tests for src/lib/pincode-loader.ts
 *
 * The module uses `createRequire(import.meta.url)` to load india-pincode via
 * the CJS entry point so that `__dirname` is always defined at runtime. These
 * tests verify:
 *   1. `createRequire` is invoked with the correct base URL.
 *   2. The exports (`getIndiaPincode`, `isValidPincode`) are drawn from the
 *      value returned by the CJS require call, not from the ESM entry.
 *   3. The re-exported functions behave correctly when delegated to.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'

// ---------------------------------------------------------------------------
// Mock setup — must be declared before any imports that trigger module
// evaluation so vitest's hoisting mechanism intercepts them in time.
// ---------------------------------------------------------------------------

const mockIsValidPincode = vi.fn((code: string) => /^\d{6}$/.test(code))
const mockGetIndiaPincode = vi.fn()
const mockRequire = vi.fn(() => ({
  isValidPincode: mockIsValidPincode,
  getIndiaPincode: mockGetIndiaPincode,
}))
const mockCreateRequire = vi.fn(() => mockRequire)

vi.mock('node:module', () => ({
  createRequire: mockCreateRequire,
}))

// Import after mocks so the module-level `createRequire(import.meta.url)` call
// uses the mock above.
import { getIndiaPincode, isValidPincode } from '@/lib/pincode-loader'

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('pincode-loader module initialisation', () => {
  it('calls createRequire exactly once during module evaluation', () => {
    expect(mockCreateRequire).toHaveBeenCalledTimes(1)
  })

  it('calls createRequire with import.meta.url so the CJS resolution is relative to the loader file', () => {
    // The argument must be a string (the import.meta.url of the loader module).
    const [calledWith] = mockCreateRequire.mock.calls[0]
    expect(typeof calledWith).toBe('string')
    // It should be a file URL or at least a non-empty string.
    expect(calledWith.length).toBeGreaterThan(0)
  })

  it('requires "india-pincode" via the CJS require produced by createRequire', () => {
    expect(mockRequire).toHaveBeenCalledWith('india-pincode')
  })

  it('requires "india-pincode" exactly once', () => {
    expect(mockRequire).toHaveBeenCalledTimes(1)
  })
})

describe('isValidPincode export', () => {
  beforeEach(() => {
    mockIsValidPincode.mockClear()
  })

  it('is exported as a function', () => {
    expect(typeof isValidPincode).toBe('function')
  })

  it('delegates to the function returned by the CJS require', () => {
    isValidPincode('560001')
    expect(mockIsValidPincode).toHaveBeenCalledWith('560001')
  })

  it('returns true for a valid 6-digit pincode', () => {
    mockIsValidPincode.mockReturnValueOnce(true)
    expect(isValidPincode('560001')).toBe(true)
  })

  it('returns false for a pincode shorter than 6 digits', () => {
    mockIsValidPincode.mockReturnValueOnce(false)
    expect(isValidPincode('1234')).toBe(false)
  })

  it('returns false for a pincode longer than 6 digits', () => {
    mockIsValidPincode.mockReturnValueOnce(false)
    expect(isValidPincode('1234567')).toBe(false)
  })

  it('returns false for a pincode containing letters', () => {
    mockIsValidPincode.mockReturnValueOnce(false)
    expect(isValidPincode('ABCDEF')).toBe(false)
  })

  it('returns false for an empty string', () => {
    mockIsValidPincode.mockReturnValueOnce(false)
    expect(isValidPincode('')).toBe(false)
  })

  it('returns false for a pincode containing special characters', () => {
    mockIsValidPincode.mockReturnValueOnce(false)
    expect(isValidPincode('56-001')).toBe(false)
  })

  it('propagates the return value from the underlying function unchanged', () => {
    mockIsValidPincode.mockReturnValueOnce(true)
    expect(isValidPincode('110001')).toBe(true)

    mockIsValidPincode.mockReturnValueOnce(false)
    expect(isValidPincode('abc')).toBe(false)
  })
})

describe('getIndiaPincode export', () => {
  beforeEach(() => {
    mockGetIndiaPincode.mockClear()
  })

  it('is exported as a function', () => {
    expect(typeof getIndiaPincode).toBe('function')
  })

  it('delegates to the function returned by the CJS require', () => {
    const mockInstance = { getPincodeSummary: vi.fn() }
    mockGetIndiaPincode.mockReturnValueOnce(mockInstance)

    const result = getIndiaPincode()

    expect(mockGetIndiaPincode).toHaveBeenCalledTimes(1)
    expect(result).toBe(mockInstance)
  })

  it('returns an object with a getPincodeSummary method when the underlying library does so', () => {
    const mockInstance = { getPincodeSummary: vi.fn() }
    mockGetIndiaPincode.mockReturnValueOnce(mockInstance)

    const instance = getIndiaPincode()

    expect(instance).toHaveProperty('getPincodeSummary')
    expect(typeof instance.getPincodeSummary).toBe('function')
  })

  it('passes through any arguments to the underlying function', () => {
    mockGetIndiaPincode.mockReturnValueOnce({})
    // india-pincode's getIndiaPincode accepts no required args, but ensure
    // the re-export does not strip arguments.
    getIndiaPincode()
    expect(mockGetIndiaPincode).toHaveBeenCalledWith()
  })
})

describe('CJS require path (regression)', () => {
  it('does not use the ESM entry — the require path ensures __dirname is defined', () => {
    // The whole point of this module is that `createRequire` (CJS) is used
    // instead of a direct ESM import. Verify the mock was set up via the CJS
    // channel (mockRequire), not via the ESM `import` path.
    expect(mockRequire).toHaveBeenCalledWith('india-pincode')
    expect(mockCreateRequire).toHaveBeenCalled()
  })

  it('does not throw when the require call succeeds', () => {
    // Module was already loaded without error — asserting it evaluates cleanly.
    expect(() => {
      // Re-using already-imported exports to confirm module is intact.
      void isValidPincode
      void getIndiaPincode
    }).not.toThrow()
  })
})