/* eslint-disable no-console */

/**
 * Measure the product-affinity scoring pipeline against real data.
 *
 * Runs the same service functions the Inngest cron function calls, in the same
 * order, and reports the wall time of each phase plus what the run produced.
 * This is the evidence for SC-006 ("the scoring job completes within its
 * scheduled window on a representative data volume") without needing an
 * Inngest dev server in the loop.
 *
 * Usage: npx tsx scripts/measure-affinity-scoring.ts
 */

import process from 'node:process'

import { config } from 'dotenv'

config({ path: '.env.local' })
config({ path: '.env', override: false })

const {
  batchAnchors,
  collectPurchasePairs,
  collectSharePairs,
  collectWishlistPairs,
  mergeSignals,
  resolveWindowStart,
  truncateByAnchor,
  writeAffinityBatch,
} = await import('../src/features/recommendations/services/scoring')

const { AFFINITY_WINDOW_DAYS, MIN_SUPPORT, MAX_PAIRS_PER_ANCHOR } =
  await import('../src/features/recommendations/constants')

const timed = async <T>(label: string, run: () => Promise<T>) => {
  const startedAt = Date.now()
  const value = await run()
  const durationMs = Date.now() - startedAt
  const size = Array.isArray(value) ? ` (${value.length} pairs)` : ''
  console.log(
    `  ${label.padEnd(24)} ${String(durationMs).padStart(7)} ms${size}`
  )
  return { value, durationMs }
}

const main = async () => {
  console.log(
    `Window: ${AFFINITY_WINDOW_DAYS} days | minimum support: ${MIN_SUPPORT} | cap: ${MAX_PAIRS_PER_ANCHOR} pairs per anchor\n`
  )

  const totalStart = Date.now()
  const windowStart = resolveWindowStart()

  console.log('Collection phases:')
  const purchase = await timed('collect-purchase-pairs', () =>
    collectPurchasePairs(windowStart)
  )
  const wishlist = await timed('collect-wishlist-pairs', () =>
    collectWishlistPairs(windowStart)
  )
  const share = await timed('collect-share-pairs', () =>
    collectSharePairs(windowStart)
  )

  const mergeStart = Date.now()
  const merged = mergeSignals({
    purchase: purchase.value,
    wishlist: wishlist.value,
    share: share.value,
  })
  const byAnchor = truncateByAnchor(merged)
  const anchors = [...byAnchor.keys()].sort((a, b) => a.localeCompare(b))
  const batches = batchAnchors(anchors)
  const mergeMs = Date.now() - mergeStart
  console.log(
    `\n  ${'merge + truncate'.padEnd(24)} ${String(mergeMs).padStart(7)} ms`
  )
  console.log(
    `  ${'anchors'.padEnd(24)} ${String(anchors.length).padStart(7)} across ${batches.length} write batch(es)`
  )

  const computedAt = new Date()
  const writeStart = Date.now()
  let pairCount = 0
  for (const batch of batches) {
    pairCount += await writeAffinityBatch(batch, byAnchor, computedAt)
  }
  const writeMs = Date.now() - writeStart
  console.log(
    `  ${'write batches'.padEnd(24)} ${String(writeMs).padStart(7)} ms (${pairCount} rows)`
  )

  const totalMs = Date.now() - totalStart
  console.log(`\nTotal: ${totalMs} ms (${(totalMs / 1000).toFixed(1)} s)`)

  if (pairCount === 0) {
    console.log(
      '\nNo pairs cleared the support floor. Every rail will serve bestsellers.'
    )
  }
}

try {
  await main()
  process.exit(0)
} catch (error) {
  console.error(
    'Measurement failed:',
    error instanceof Error ? error.message : error
  )
  process.exit(1)
}
