import type { AdminPermission } from '@/lib/constants/roles'
import type { AdminResourceKey } from '@/lib/validations/admin'

export const ADMIN_RESOURCE_READ_PERMISSIONS: Record<
  AdminResourceKey,
  AdminPermission
> = {
  orders: 'orders:read',
  products: 'products:read',
  users: 'users:read',
  reviews: 'reviews:moderate',
  returns: 'orders:returns',
  categories: 'products:write',
  coupons: 'coupons:manage',
  'checkout-requests': 'orders:read',
  recommendations: 'system:manage',
  'email-failures': 'system:manage',
  search: 'system:manage',
  activity: 'system:manage',
}

export const ACTIVITY_ENTITY_PERMISSIONS: Record<string, AdminPermission> = {
  order: 'orders:read',
  orders: 'orders:read',
  product: 'products:read',
  products: 'products:read',
  user: 'users:read',
  users: 'users:read',
  review: 'reviews:moderate',
  reviews: 'reviews:moderate',
  return: 'orders:returns',
  returns: 'orders:returns',
  category: 'products:write',
  categories: 'products:write',
  coupon: 'coupons:manage',
  coupons: 'coupons:manage',
  'checkout-request': 'orders:read',
  'checkout-requests': 'orders:read',
  recommendation: 'system:manage',
  recommendations: 'system:manage',
  'email-failure': 'system:manage',
  'email-failures': 'system:manage',
  search: 'system:manage',
}

export const getActivityEntityPermission = (entity: string) =>
  ACTIVITY_ENTITY_PERMISSIONS[entity]
