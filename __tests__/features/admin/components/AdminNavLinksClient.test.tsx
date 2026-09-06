import { describe, expect, it } from 'vitest'
import {
  getAllNavItems,
  getVisibleNavGroups,
} from '@/features/admin/components/AdminNavLinksClient'

describe('AdminNavLinksClient command palette filtering', () => {
  it('only includes destinations the current permission set allows', () => {
    const visibleGroups = getVisibleNavGroups(['orders:read', 'products:read'])
    const labels = getAllNavItems(visibleGroups, 0).map((item) => item.label)

    expect(labels).toContain('Orders')
    expect(labels).toContain('Products')
    expect(labels).not.toContain('Users')
    expect(labels).not.toContain('Search')
    expect(labels).not.toContain('Email Failures')
  })
})
