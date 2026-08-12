import { describe, expect, it } from 'vitest'
import {
  getAllowedActivityEntities,
  normalizeActivityChanges,
} from '@/features/admin/services/admin-activity-query'

describe('getAllowedActivityEntities', () => {
  it('excludes entity types the caller lacks read permission for (FR-D09, scenario 6)', () => {
    const allowed = getAllowedActivityEntities(['orders:read'])

    expect(allowed).toEqual(expect.arrayContaining(['order', 'orders']))
    expect(allowed).not.toEqual(expect.arrayContaining(['review', 'reviews']))
    expect(allowed).not.toEqual(
      expect.arrayContaining(['product', 'products'])
    )
    expect(allowed).not.toEqual(expect.arrayContaining(['user', 'users']))
  })

  it('denies every entity type when the caller holds no admin permissions (fail closed)', () => {
    expect(getAllowedActivityEntities([])).toEqual([])
  })

  it('allows every entity type for a caller holding every permission', () => {
    const allowed = getAllowedActivityEntities([
      'orders:read',
      'products:read',
      'users:read',
      'reviews:moderate',
      'orders:returns',
      'products:write',
      'coupons:manage',
      'system:manage',
    ])

    for (const entity of [
      'order',
      'product',
      'user',
      'review',
      'return',
      'category',
      'coupon',
      'checkout-request',
      'recommendation',
      'email-failure',
      'search',
    ]) {
      expect(allowed).toContain(entity)
    }
  })

  it('combines permissions from multiple entity types additively', () => {
    const allowed = getAllowedActivityEntities([
      'orders:read',
      'reviews:moderate',
    ])

    expect(allowed).toEqual(
      expect.arrayContaining(['order', 'orders', 'review', 'reviews'])
    )
    expect(allowed).not.toEqual(
      expect.arrayContaining(['product', 'products'])
    )
  })
})

describe('normalizeActivityChanges', () => {
  it('converts plain diff values into before/after entries', () => {
    expect(
      normalizeActivityChanges({
        status: 'SHIPPED',
        trackingNumber: 'TRK-1',
      })
    ).toEqual([
      { field: 'status', before: null, after: 'SHIPPED' },
      { field: 'trackingNumber', before: null, after: 'TRK-1' },
    ])
  })

  it('preserves explicit before/after diff objects', () => {
    expect(
      normalizeActivityChanges({
        status: { before: 'PROCESSING', after: 'SHIPPED' },
      })
    ).toEqual([{ field: 'status', before: 'PROCESSING', after: 'SHIPPED' }])
  })
})
