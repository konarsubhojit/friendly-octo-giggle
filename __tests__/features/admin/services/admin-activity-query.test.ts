import { describe, expect, it } from 'vitest'
import { normalizeActivityChanges } from '@/features/admin/services/admin-activity-query'

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
