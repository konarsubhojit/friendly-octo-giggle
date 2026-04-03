import type { ReactNode } from 'react'
import type { FieldDef } from '@/components/ui/DynamicForm'
import { PASSWORD_REQUIREMENTS } from '@/lib/validations/primitives'
import { PROFILE_ERRORS, PASSWORD_ERRORS } from '@/lib/constants/error-messages'

export interface UserProfile {
  id: string
  name: string | null
  email: string
  phoneNumber: string | null
  image: string | null
  role: string
  hasPassword: boolean
  currencyPreference: string
  createdAt: string
}

const EMAIL_RE =
  /^[a-zA-Z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(?:\.[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)*$/
const PHONE_RE = /^\+?[1-9]\d{6,14}$/

export const isPasswordStrong = (password: string): boolean =>
  PASSWORD_REQUIREMENTS.every((requirement) => requirement.test(password))

export const validateProfileFields = (
  name: string,
  email: string,
  phoneNumber: string
): Record<string, string> => {
  const errors: Record<string, string> = {}
  if (!name.trim()) {
    errors.name = PROFILE_ERRORS.NAME_REQUIRED
  }
  if (!email.trim()) {
    errors.email = PROFILE_ERRORS.EMAIL_REQUIRED
  } else if (!EMAIL_RE.test(email)) {
    errors.email = PROFILE_ERRORS.EMAIL_INVALID
  }
  if (phoneNumber && !PHONE_RE.test(phoneNumber)) {
    errors.phoneNumber = PROFILE_ERRORS.PHONE_INVALID
  }
  return errors
}

export const validatePasswordFields = (
  currentPassword: string,
  newPassword: string,
  confirmNewPassword: string
): Record<string, string> => {
  const errors: Record<string, string> = {}
  if (!currentPassword) {
    errors.currentPassword = PASSWORD_ERRORS.CURRENT_REQUIRED
  }
  if (!newPassword) {
    errors.newPassword = PASSWORD_ERRORS.NEW_REQUIRED
  } else if (!isPasswordStrong(newPassword)) {
    errors.newPassword = PASSWORD_ERRORS.NEW_WEAK
  }
  if (!confirmNewPassword) {
    errors.confirmNewPassword = PASSWORD_ERRORS.CONFIRM_REQUIRED
  } else if (newPassword !== confirmNewPassword) {
    errors.confirmNewPassword = PASSWORD_ERRORS.CONFIRM_MISMATCH
  }
  return errors
}

const PHONE_LABEL: ReactNode = (
  <>
    Phone Number <span className="text-[var(--text-muted)]">(optional)</span>
  </>
)

export const PROFILE_FIELDS: ReadonlyArray<FieldDef> = [
  {
    id: 'account-name',
    name: 'name',
    label: 'Name',
    type: 'text',
    placeholder: 'Your full name',
    autoComplete: 'name',
    validate: (value) =>
      value.trim() ? undefined : PROFILE_ERRORS.NAME_REQUIRED,
  },
  {
    id: 'account-email',
    name: 'email',
    label: 'Email',
    type: 'email',
    placeholder: 'you@example.com',
    autoComplete: 'email',
    validate: (value) => {
      if (!value.trim()) return PROFILE_ERRORS.EMAIL_REQUIRED
      if (!EMAIL_RE.test(value)) return PROFILE_ERRORS.EMAIL_INVALID
      return undefined
    },
  },
  {
    id: 'account-phone',
    name: 'phoneNumber',
    label: PHONE_LABEL,
    type: 'tel',
    placeholder: '+1234567890',
    autoComplete: 'tel',
    validate: (value) =>
      value && !PHONE_RE.test(value) ? PROFILE_ERRORS.PHONE_INVALID : undefined,
  },
]

export const PASSWORD_FIELDS: ReadonlyArray<FieldDef> = [
  {
    id: 'current-password',
    name: 'currentPassword',
    label: 'Current Password',
    type: 'password',
    placeholder: 'Enter current password',
    autoComplete: 'current-password',
    showPasswordToggle: true,
    validate: (value) => (value ? undefined : PASSWORD_ERRORS.CURRENT_REQUIRED),
  },
  {
    id: 'new-password',
    name: 'newPassword',
    label: 'New Password',
    type: 'password',
    placeholder: 'Enter new password',
    autoComplete: 'new-password',
    showPasswordToggle: true,
    showStrengthChecklist: true,
    validate: (value) => {
      if (!value) return PASSWORD_ERRORS.NEW_REQUIRED
      if (!isPasswordStrong(value)) return PASSWORD_ERRORS.NEW_WEAK
      return undefined
    },
  },
  {
    id: 'confirm-new-password',
    name: 'confirmNewPassword',
    label: 'Confirm New Password',
    type: 'password',
    placeholder: 'Confirm new password',
    autoComplete: 'new-password',
    validate: (value, allValues) => {
      if (!value) return PASSWORD_ERRORS.CONFIRM_REQUIRED
      if (value !== allValues.newPassword) {
        return PASSWORD_ERRORS.CONFIRM_MISMATCH
      }
      return undefined
    },
    validateOnBlur: true,
  },
]
