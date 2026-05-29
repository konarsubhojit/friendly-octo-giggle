import { describe, expect, it } from 'vitest'
import {
  getLocaleFromPathname,
  stripLocaleFromPathname,
  toLocalizedPathname,
} from '@/lib/i18n/config'

describe('i18n routing helpers', () => {
  it('extracts locale from locale-prefixed paths', () => {
    expect(getLocaleFromPathname('/en/shop')).toBe('en')
    expect(getLocaleFromPathname('/es/about')).toBe('es')
  })

  it('strips locale prefix while preserving route', () => {
    expect(stripLocaleFromPathname('/en/shop')).toBe('/shop')
    expect(stripLocaleFromPathname('/es')).toBe('/')
  })

  it('adds locale prefix with fallback normalization', () => {
    expect(toLocalizedPathname('/shop', 'en')).toBe('/en/shop')
    expect(toLocalizedPathname('/en/shop', 'es')).toBe('/es/shop')
    expect(toLocalizedPathname('/', 'es')).toBe('/es')
  })
})
