import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { patchErrorEvent } from '@/lib/patch-error-event'

describe('patchErrorEvent', () => {
  const originalEmit = process.emit

  beforeEach(() => {
    process.emit = originalEmit
  })

  afterEach(() => {
    process.emit = originalEmit
    vi.restoreAllMocks()
  })

  it('replaces _ErrorEvent objects on uncaughtException', () => {
    const captured: unknown[][] = []
    process.emit = ((event: string, ...args: unknown[]) => {
      captured.push([event, ...args])
      return true
    }) as typeof process.emit

    patchErrorEvent()

    class _ErrorEvent {
      message = 'boom'
      error = Object.assign(new Error('inner'), { stack: 'inner-stack' })
    }
    const eventObj = new _ErrorEvent()

    const result = (
      process.emit as unknown as (event: string, ...args: unknown[]) => boolean
    )('uncaughtException', eventObj)

    expect(result).toBe(true)
    expect(captured).toHaveLength(1)
    const [eventName, payload] = captured[0]
    expect(eventName).toBe('uncaughtException')
    expect(payload).toBeInstanceOf(Error)
    expect((payload as Error).message).toBe('boom')
    expect((payload as Error).name).toBe('ErrorEvent')
    expect((payload as Error).stack).toBe('inner-stack')
  })

  it('falls back to the inner error message and "Unknown ErrorEvent"', () => {
    const captured: unknown[][] = []
    process.emit = ((event: string, ...args: unknown[]) => {
      captured.push([event, ...args])
      return true
    }) as typeof process.emit

    patchErrorEvent()

    class _ErrorEvent {
      // No `message` property at all
      error = new Error('from inner')
    }
    ;(
      process.emit as unknown as (event: string, ...args: unknown[]) => boolean
    )('unhandledRejection', new _ErrorEvent())

    expect((captured[0][1] as Error).message).toBe('from inner')

    // Use a local re-declaration to avoid TS block-scope conflict.
    {
      class _ErrorEvent {}
      ;(
        process.emit as unknown as (
          event: string,
          ...args: unknown[]
        ) => boolean
      )('unhandledRejection', new _ErrorEvent())
    }
    expect((captured[1][1] as Error).message).toBe('Unknown ErrorEvent')
  })

  it('passes through unrelated events unchanged', () => {
    const captured: unknown[][] = []
    process.emit = ((event: string, ...args: unknown[]) => {
      captured.push([event, ...args])
      return true
    }) as typeof process.emit

    patchErrorEvent()

    const payload = { foo: 'bar' }
    ;(
      process.emit as unknown as (event: string, ...args: unknown[]) => boolean
    )('warning', payload)

    expect(captured[0]).toEqual(['warning', payload])
  })

  it('passes through non-_ErrorEvent payloads on uncaughtException', () => {
    const captured: unknown[][] = []
    process.emit = ((event: string, ...args: unknown[]) => {
      captured.push([event, ...args])
      return true
    }) as typeof process.emit

    patchErrorEvent()

    const realError = new Error('regular')
    ;(
      process.emit as unknown as (event: string, ...args: unknown[]) => boolean
    )('uncaughtException', realError)

    expect(captured[0][1]).toBe(realError)
  })
})
