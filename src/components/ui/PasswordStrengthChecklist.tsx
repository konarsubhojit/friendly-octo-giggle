'use client'

import { PASSWORD_REQUIREMENTS } from '@/lib/validations/primitives'
import { CheckIcon } from '@/components/icons/CheckIcon'
import { CircleIcon } from '@/components/icons/CircleIcon'

interface PasswordStrengthChecklistProps {
  readonly password: string
}

export function PasswordStrengthChecklist({
  password,
}: PasswordStrengthChecklistProps) {
  if (!password) return null

  return (
    <ul className="mt-2 space-y-1">
      {PASSWORD_REQUIREMENTS.map((req) => {
        const met = req.test(password)
        return (
          <li
            key={req.label}
            className={`text-xs flex items-center gap-1.5 ${met ? 'text-green-600' : 'text-gray-400'}`}
          >
            {met ? <CheckIcon /> : <CircleIcon />}
            {req.label}
          </li>
        )
      })}
    </ul>
  )
}
