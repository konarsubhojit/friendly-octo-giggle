import { drizzleDb } from '@/lib/db'
import { adminAuditLogs } from '@/lib/schema'
import { isUserRole, type UserRole } from '@/lib/constants/roles'
import { logError } from '@/lib/logger'

interface AdminAuditLogInput {
  readonly userId: string
  /** Role the actor held when performing the action. */
  readonly role?: UserRole | null
  readonly entity: string
  readonly entityId: string
  readonly action: string
  readonly diff?: Record<string, unknown>
}

const REDACTED_AUDIT_VALUE = '[REDACTED]'

const SENSITIVE_AUDIT_KEY_FRAGMENTS = [
  'password',
  'token',
  'secret',
  'signature',
  'otp',
  'paymentid',
  'cardnumber',
  'creditcard',
  'cvv',
  'cvc',
  'accountnumber',
  'routingnumber',
] as const

const isPlainObject = (value: unknown): value is Record<string, unknown> => {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) {
    return false
  }

  const prototype = Object.getPrototypeOf(value) as unknown
  return prototype === Object.prototype || prototype === null
}

const shouldRedactAuditKey = (key: string): boolean => {
  const normalized = key.toLowerCase().replace(/[^a-z0-9]/g, '')
  return SENSITIVE_AUDIT_KEY_FRAGMENTS.some((fragment) =>
    normalized.includes(fragment)
  )
}

const sanitizeAuditValue = (value: unknown): unknown => {
  if (Array.isArray(value)) {
    return value.map(sanitizeAuditValue)
  }

  if (isPlainObject(value)) {
    return sanitizeAuditDiff(value)
  }

  return value
}

export const sanitizeAuditDiff = (
  diff: Record<string, unknown>
): Record<string, unknown> => {
  const sanitized: Record<string, unknown> = {}

  for (const [key, value] of Object.entries(diff)) {
    sanitized[key] = shouldRedactAuditKey(key)
      ? REDACTED_AUDIT_VALUE
      : sanitizeAuditValue(value)
  }

  return sanitized
}

export const recordAdminAuditLog = async ({
  userId,
  role,
  entity,
  entityId,
  action,
  diff = {},
}: AdminAuditLogInput): Promise<void> => {
  if (!userId || !entity || !entityId || !action) {
    return
  }

  try {
    await drizzleDb.insert(adminAuditLogs).values({
      userId,
      role: isUserRole(role) ? role : null,
      entity,
      entityId,
      action,
      diff: sanitizeAuditDiff(diff),
    })
  } catch (error) {
    logError({
      error,
      context: 'admin_audit_log_failure',
      userId,
      additionalInfo: { role, entity, entityId, action },
    })
  }
}
