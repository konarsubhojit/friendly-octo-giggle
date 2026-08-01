import { serve } from 'inngest/next'
import { inngest } from '@/lib/inngest/client'
import { inngestFunctions } from '@/lib/inngest/registry'

export const dynamic = 'force-dynamic'

/**
 * Budget for a single step invocation.
 *
 * Steps are checkpointed independently, so this bounds one step — not the whole
 * pipeline. It is deliberately kept at or below `STALE_PROCESSING_CLAIM_MS`
 * (see `lib/db-queries`) so a claim can never outlive the stale-claim window.
 */
export const maxDuration = 30

export const { GET, POST, PUT } = serve({
  client: inngest,
  functions: [...inngestFunctions],
})
