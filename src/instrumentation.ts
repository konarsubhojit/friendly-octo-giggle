export async function register() {
  if (process.env.NEXT_RUNTIME === 'nodejs') {
    // Node.js `ErrorEvent` (internal class `_ErrorEvent`) has a getter-only
    // `message` property.  When an Azure Blob SDK (or similar) emits an
    // ErrorEvent as an uncaught exception, downstream handlers (Sentry,
    // Next.js) crash trying to set `.message` on it.
    //
    // Prepend a handler that converts `_ErrorEvent` into a normal `Error`
    // before other listeners (Sentry, Next.js) attempt to write `.message`.
    const originalEmit = process.emit.bind(process) as typeof process.emit
    process.emit = function patchedEmit(event: string, ...args: unknown[]) {
      if (event === 'uncaughtException') {
        const err = args[0]
        if (
          err &&
          typeof err === 'object' &&
          (err as Record<string, unknown>).constructor?.name === '_ErrorEvent'
        ) {
          const ee = err as Record<string, unknown>
          const innerError = ee.error as Error | undefined
          const replacement = new Error(
            (ee.message as string) ??
              innerError?.message ??
              'Unknown ErrorEvent'
          )
          if (innerError?.stack) replacement.stack = innerError.stack
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
}
