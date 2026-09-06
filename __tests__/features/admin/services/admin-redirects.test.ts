import { describe, it, expect } from 'vitest'
import {
  ADMIN_REDIRECT_MAP,
  getAdminRedirect,
} from '@/features/admin/services/admin-redirects'

describe('admin redirects', () => {
  it('redirects /admin/sales to /admin', () => {
    expect(getAdminRedirect('/admin/sales')).toBe('/admin')
  })

  it('returns null for active routes', () => {
    expect(getAdminRedirect('/admin/orders')).toBeNull()
    expect(getAdminRedirect('/admin/products')).toBeNull()
  })

  it('every retired route maps to a survivor', () => {
    for (const [retired, survivor] of Object.entries(ADMIN_REDIRECT_MAP)) {
      expect(retired).toBeTruthy()
      expect(survivor).toBeTruthy()
      expect(retired).not.toEqual(survivor)
    }
  })
})
