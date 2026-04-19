/**
 * Node.js _ErrorEvent has a getter-only `message` property that crashes
 * Sentry/Next.js when they try to set it. Convert to a normal Error first.
 */
export function patchErrorEvent() {
  const originalEmit = process.emit.bind(process)
  process.emit = function patchedEmit(event: string, ...args: unknown[]) {
    if (event === 'uncaughtException') {
      const err = args[0] as Record<string, unknown> | null
      if (err?.constructor?.name === '_ErrorEvent') {
        const inner = err.error as Error | undefined
        const replacement = new Error(
          (err.message as string) ?? inner?.message ?? 'Unknown ErrorEvent'
        )
        if (inner?.stack) replacement.stack = inner.stack
        replacement.name = 'ErrorEvent'
        return originalEmit.call(
          process,
          event,
          replacement,
          ...args.slice(1)
        ) as boolean
      }
    }
    return originalEmit.call(process, event, ...args) as boolean
  } as typeof process.emit
}
