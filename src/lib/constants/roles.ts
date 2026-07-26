/**
 * Roles and the permissions they grant.
 *
 * This module is intentionally dependency-free (no env, no database, no auth)
 * so it can be imported from the Drizzle schema, edge middleware, API route
 * guards and client bundles alike, keeping the role list a single source of
 * truth.
 *
 * Authorization is expressed as permissions rather than role comparisons: route
 * guards declare the permission they need and the role map decides who has it,
 * so adding a role never means auditing every `role === 'ADMIN'` check again.
 */
export const USER_ROLES = [
  'CUSTOMER',
  'ADMIN',
  'SUPPORT',
  'FULFILMENT',
] as const

export type UserRole = (typeof USER_ROLES)[number]

/** Every permission an admin-area route or page can require. */
export const ADMIN_PERMISSIONS = [
  'orders:read',
  'orders:update',
  'products:read',
  'products:write',
  'users:read',
  'users:manage',
  'reviews:moderate',
  'coupons:manage',
  'analytics:read',
  'system:manage',
] as const

export type AdminPermission = (typeof ADMIN_PERMISSIONS)[number]

/**
 * Permissions granted per role.
 *
 * - `ADMIN` keeps unrestricted access so existing operators are unaffected.
 * - `FULFILMENT` moves orders through the pipeline (status, tracking) and can
 *   read the catalog for picking, but cannot edit products or prices.
 * - `SUPPORT` answers customer questions: read orders and users, moderate
 *   reviews — but never change roles or catalog data.
 */
export const ROLE_PERMISSIONS: Record<UserRole, readonly AdminPermission[]> = {
  CUSTOMER: [],
  ADMIN: ADMIN_PERMISSIONS,
  SUPPORT: ['orders:read', 'products:read', 'users:read', 'reviews:moderate'],
  FULFILMENT: ['orders:read', 'orders:update', 'products:read'],
}

export const isUserRole = (value: unknown): value is UserRole =>
  typeof value === 'string' && (USER_ROLES as readonly string[]).includes(value)

/**
 * Whether a role grants a permission. Unknown roles are denied (fail closed).
 */
export const hasPermission = (
  role: unknown,
  permission: AdminPermission
): boolean => isUserRole(role) && ROLE_PERMISSIONS[role].includes(permission)

/** Permissions granted to a role; empty for unknown or customer roles. */
export const getRolePermissions = (
  role: unknown
): readonly AdminPermission[] =>
  isUserRole(role) ? ROLE_PERMISSIONS[role] : []

/**
 * Whether a role may enter the admin area at all — i.e. it holds at least one
 * admin permission. Used by middleware and the admin layout.
 */
export const isStaffRole = (role: unknown): boolean =>
  getRolePermissions(role).length > 0

/** Human-readable role names for badges, selects and confirmation copy. */
export const ROLE_LABELS: Record<UserRole, string> = {
  CUSTOMER: 'Customer',
  ADMIN: 'Admin',
  SUPPORT: 'Support',
  FULFILMENT: 'Fulfilment',
}

/** Display label for a role; `null` for unknown roles. */
export const getRoleLabel = (role: unknown): string | null =>
  isUserRole(role) ? ROLE_LABELS[role] : null

/** Roles that may be assigned to a user from the admin users screen. */
export const ASSIGNABLE_USER_ROLES = USER_ROLES
