import { describe, expect, it } from 'vitest'
import {
  decodeAdminListState,
  encodeAdminListState,
} from '@/features/admin/hooks/useAdminListState'

describe('useAdminListState helpers', () => {
  it('round-trips search, filters, sort, and cursor through URL params', () => {
    const encoded = encodeAdminListState({
      search: 'priority orders',
      filters: {
        status: 'PROCESSING',
        shippingMethod: 'EXPRESS',
      },
      sort: { field: 'createdAt', direction: 'desc' },
      cursor: 'cursor-123',
    })

    expect(decodeAdminListState(encoded)).toEqual({
      search: 'priority orders',
      filters: {
        status: 'PROCESSING',
        shippingMethod: 'EXPRESS',
      },
      sort: { field: 'createdAt', direction: 'desc' },
      cursor: 'cursor-123',
    })
  })

  it('drops empty values from the encoded query string', () => {
    const encoded = encodeAdminListState({
      search: '',
      filters: { status: '', channel: 'online' },
      sort: null,
      cursor: null,
    })

    expect(encoded.toString()).toBe('f_channel=online')
    expect(decodeAdminListState(encoded)).toEqual({
      search: '',
      filters: { channel: 'online' },
      sort: null,
      cursor: null,
    })
  })
})
