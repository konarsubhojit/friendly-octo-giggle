/**
 * Node.js _ErrorEvent has a getter-only `message` property that crashes
 * Sentry/Next.js when they try to set it. Convert to a normal Error first.
 */
const convertErrorEvent = (err: Record<string, unknown>): Error => {
  const inner = err.error as Error | undefined
  const replacement = new Error(
    (err.message as string) ?? inner?.message ?? 'Unknown ErrorEvent'
  )
  if (inner?.stack) replacement.stack = inner.stack
  replacement.name = 'ErrorEvent'
  return replacement
}

const isErrorEvent = (err: unknown): err is Record<string, unknown> =>
  !!err &&
  typeof err === 'object' &&
  (err as { constructor?: { name?: string } }).constructor?.name ===
    '_ErrorEvent'

export const patchErrorEvent = () => {
  const originalEmit = process.emit.bind(process)
  process.emit = function patchedEmit(event: string, ...args: unknown[]) {
    if (
      (event === 'uncaughtException' || event === 'unhandledRejection') &&
      isErrorEvent(args[0])
    ) {
      const replacement = convertErrorEvent(args[0])
      return originalEmit.call(
        process,
        event,
        replacement,
        ...args.slice(1)
      ) as boolean
    }
    return originalEmit.call(process, event, ...args) as boolean
  } as typeof process.emit
}
