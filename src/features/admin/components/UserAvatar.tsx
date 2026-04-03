'use client'

import Image from 'next/image'

interface UserAvatarProps {
  readonly name: string | null
  readonly email: string
  readonly image: string | null
}

export function UserAvatar({ name, email, image }: UserAvatarProps) {
  if (image) {
    return (
      <Image
        src={image}
        alt={name || 'User'}
        width={40}
        height={40}
        className="rounded-full"
      />
    )
  }

  const initial = name?.charAt(0) || email.charAt(0).toUpperCase()
  return (
    <div className="w-10 h-10 rounded-full bg-gray-300 dark:bg-gray-600 flex items-center justify-center">
      <span className="text-gray-600 dark:text-gray-300 font-medium">
        {initial}
      </span>
    </div>
  )
}
