'use client'

import { useState } from 'react'

export const useModalState = <T = undefined>(): {
  isOpen: boolean
  data: T | null
  open: (data?: T) => void
  close: () => void
} => {
  const [isOpen, setIsOpen] = useState(false)
  const [data, setData] = useState<T | null>(null)

  const open = (payload?: T) => {
    setData(payload ?? null)
    setIsOpen(true)
  }

  const close = () => {
    setIsOpen(false)
    setData(null)
  }

  return { isOpen, data, open, close }
}
