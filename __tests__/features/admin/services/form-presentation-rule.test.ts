import { describe, it, expect } from 'vitest'
import {
  getFormPresentation,
  RESOURCE_FORM_PRESENTATIONS,
} from '@/features/admin/services/form-presentation-rule'

describe('form presentation rule', () => {
  it('returns overlay for low-field-count records without nested structure', () => {
    expect(
      getFormPresentation({ fieldCount: 3, hasNestedStructure: false })
    ).toBe('overlay')
  })

  it('returns overlay at the threshold boundary (8 fields)', () => {
    expect(
      getFormPresentation({ fieldCount: 8, hasNestedStructure: false })
    ).toBe('overlay')
  })

  it('returns dedicated-screen above the threshold', () => {
    expect(
      getFormPresentation({ fieldCount: 9, hasNestedStructure: false })
    ).toBe('dedicated-screen')
  })

  it('returns dedicated-screen for nested structure regardless of field count', () => {
    expect(
      getFormPresentation({ fieldCount: 2, hasNestedStructure: true })
    ).toBe('dedicated-screen')
  })

  it('assigns categories to overlay', () => {
    expect(RESOURCE_FORM_PRESENTATIONS.categories).toBe('overlay')
  })

  it('assigns coupons to overlay', () => {
    expect(RESOURCE_FORM_PRESENTATIONS.coupons).toBe('overlay')
  })

  it('assigns products to dedicated-screen', () => {
    expect(RESOURCE_FORM_PRESENTATIONS.products).toBe('dedicated-screen')
  })
})
