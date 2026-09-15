import { serve } from 'inngest/next'
import { computeProductAffinityEventFunction } from '@/features/recommendations/inngest/affinity'
import { getFeatureFlags } from '@/lib/edge-config'
import { inngest } from '@/lib/inngest/client'
import {
  cronFunctions,
  cronJobFlags,
  eventFunctions,
  inngestFunctions,
} from '@/lib/inngest/registry'

/**
 * Budget for a single step invocation.
 *
 * Steps are checkpointed independently, so this bounds one step — not the whole
 * pipeline. It is deliberately kept at or below `STALE_PROCESSING_CLAIM_MS`
 * (see `lib/db-queries`) so a claim can never outlive the stale-claim window.
 */
export const maxDuration = 30

type InngestSyncMethod = 'GET' | 'PUT'
type CronFunctionId = keyof typeof cronJobFlags

const functionId = (fn: (typeof cronFunctions)[number]) =>
  (fn as unknown as { opts: { id: CronFunctionId } }).opts.id

const createServeHandler = async () => {
  let enabledCronFunctions: Array<(typeof cronFunctions)[number]> = []

  try {
    const flags = await getFeatureFlags()
    enabledCronFunctions = cronFunctions.filter(
      (fn) => flags[cronJobFlags[functionId(fn)]]
    )
  } catch {
    // Fail closed: event functions remain available, but no schedules are synced.
  }

  const productAffinityEnabled = enabledCronFunctions.some(
    (fn) => functionId(fn) === 'compute-product-affinity'
  )

  return serve({
    client: inngest,
    functions: [
      ...eventFunctions,
      ...(productAffinityEnabled ? [] : [computeProductAffinityEventFunction]),
      ...enabledCronFunctions,
    ],
  })
}

const executionHandler = serve({
  client: inngest,
  functions: [...inngestFunctions],
})

const createSyncMethodHandler =
  (method: InngestSyncMethod): ReturnType<typeof serve>[InngestSyncMethod] =>
  async (request, response) =>
    (await createServeHandler())[method](request, response)

export const GET = createSyncMethodHandler('GET')
export const POST = executionHandler.POST
export const PUT = createSyncMethodHandler('PUT')
