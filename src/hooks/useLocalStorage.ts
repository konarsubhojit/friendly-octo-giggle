'use client'

import { useState, useCallback, useSyncExternalStore } from 'react'
import { logError } from '@/lib/logger'

export const useLocalStorage = <T>(
  key: string,
  initialValue: T
): [T, (value: T | ((val: T) => T)) => void] => {
  // Cache the serialized initial value for the server snapshot.
  const [serializedInitial] = useState(() => JSON.stringify(initialValue))

  const subscribe = useCallback(
    (onStoreChange: () => void) => {
      const handler = (e: StorageEvent) => {
        if (e.key === key) onStoreChange()
      }
      globalThis.window?.addEventListener('storage', handler)
      return () => globalThis.window?.removeEventListener('storage', handler)
    },
    [key]
  )

  const getSnapshot = useCallback(() => {
    try {
      return globalThis.localStorage.getItem(key) ?? serializedInitial
    } catch {
      return serializedInitial
    }
  }, [key, serializedInitial])

  const raw = useSyncExternalStore(
    subscribe,
    getSnapshot,
    () => serializedInitial
  )

  let storedValue: T
  try {
    storedValue = JSON.parse(raw) as T
  } catch {
    storedValue = initialValue
  }

  const setValue = useCallback(
    (value: T | ((val: T) => T)) => {
      try {
        const current = (() => {
          try {
            const item = globalThis.localStorage.getItem(key)
            return item
              ? (JSON.parse(item) as T)
              : (JSON.parse(serializedInitial) as T)
          } catch {
            return JSON.parse(serializedInitial) as T
          }
        })()

        const valueToStore =
          typeof value === 'function'
            ? (value as (val: T) => T)(current)
            : value

        globalThis.localStorage.setItem(key, JSON.stringify(valueToStore))
        // Dispatch a storage event so useSyncExternalStore re-renders
        globalThis.window?.dispatchEvent(new StorageEvent('storage', { key }))
      } catch (error) {
        logError({ error, context: 'useLocalStorage:write' })
      }
    },
    [key, serializedInitial]
  )

  return [storedValue, setValue]
}
